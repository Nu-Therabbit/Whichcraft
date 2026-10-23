use std::path::PathBuf;

use crate::env_backend::WinregBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::ToolKind;
use crate::whichcraft::mise::MiseToolManager;
use crate::whichcraft::persistence::{load_settings, load_tool_selection, save_settings, WhichcraftSettings};
use crate::whichcraft::ports::tool_manager::ToolManager;
use crate::whichcraft::services::elevation::WinElevator;
use crate::whichcraft::services::path_cleanup::{build_path_cleanup_plan, PathCleanupPlan};
use crate::whichcraft::services::profiles::{apply_profile, load_profiles, profile_status, save_profiles as persist_profiles, plan_profile_apply};
use crate::whichcraft::domain::profiles::{missing_pins, repoint_profiles, MissingPin, ProfileMatchStatus, ToolProfile};
use crate::whichcraft::domain::ToolInstallation;
use crate::whichcraft::services::supplemental_inventory::{
    android_inventory, msvc_inventory, python_supplemental, AndroidInventory, MsvcInventory,
    PythonSupplementalView,
};
use crate::whichcraft::services::tool_apply::{
    apply_tool_plan, apply_tool_plan_elevated, create_tool_plan, ApplyToolResult,
};
use crate::whichcraft::services::recovery::{
    inspect_pending, resume_pending, roll_back_pending, RecoveryView,
};
use crate::whichcraft::services::tool_inventory::{list_tool_installations};
use crate::whichcraft::domain::{ToolInstallationView};
use crate::whichcraft::domain::ToolApplyPlan;
use crate::whichcraft::services::undo::{undo_last_apply, UndoResult};
use crate::whichcraft::services::update::{install_and_plan, UpdateResult};
use crate::whichcraft::domain::versions::{update_candidates, UpdateCandidate};
use crate::whichcraft::services::uninstall::{dismiss_unfinished_uninstall, plan_uninstall, protected_folders, unfinished_uninstalls, uninstall, PlanInputs, UninstallPlan, UninstallRecord};
use crate::whichcraft::domain::uninstall::{UninstallOutcome};
/// Runs blocking work (UAC prompts, downloads, child processes) off the UI thread. Sync Tauri
/// commands run on the main thread, so waiting there froze the window.
async fn off_main<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, EnvarlyError> + Send + 'static,
) -> Result<T, EnvarlyError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| EnvarlyError::InvalidInput(format!("background task failed: {e}")))?
}

#[tauri::command]
pub async fn whichcraft_list_tools(tool: ToolKind) -> Result<Vec<ToolInstallationView>, EnvarlyError> {
    off_main(move || {
        let backend = WinregBackend;
        let selection = load_tool_selection(tool)?;
        let views = list_tool_installations(&backend, tool, selection.as_ref().map(|s| s.root.as_path()))?;
        Ok(crate::whichcraft::services::tool_inventory::with_missing_selection(views, selection.as_ref()))
    })
    .await
}

#[tauri::command]
pub fn whichcraft_get_settings() -> Result<WhichcraftSettings, EnvarlyError> {
    load_settings()
}

#[tauri::command]
pub fn whichcraft_save_settings(settings: WhichcraftSettings) -> Result<(), EnvarlyError> {
    save_settings(&merge_settings(load_settings()?, settings))
}

/// Takes the caller's settings but keeps the store history on disk: a changed store is
/// switched to (the old one stays listed), and a missing history is not taken as "forget it".
fn merge_settings(current: WhichcraftSettings, incoming: WhichcraftSettings) -> WhichcraftSettings {
    let mut merged = current;
    merged.install_store_confirmed |= incoming.install_store_confirmed;
    merged.switch_install_store(incoming.install_store);
    merged.scan_roots = incoming.scan_roots;
    merged.terminal = incoming.terminal;
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saving_settings_without_store_history_keeps_it() {
        let mut current = WhichcraftSettings { install_store: "C:\\a".into(), ..Default::default() };
        current.switch_install_store("C:\\b".into());
        let incoming = WhichcraftSettings { install_store: "C:\\b".into(), ..Default::default() };
        let merged = merge_settings(current, incoming);
        assert_eq!(merged.all_install_stores(), vec![PathBuf::from("C:\\b"), PathBuf::from("C:\\a")]);
    }

    #[test]
    fn saving_a_new_store_keeps_the_old_one_listed() {
        let current = WhichcraftSettings { install_store: "C:\\a".into(), ..Default::default() };
        let incoming = WhichcraftSettings { install_store: "D:\\tools".into(), ..Default::default() };
        let merged = merge_settings(current, incoming);
        assert_eq!(merged.install_store, PathBuf::from("D:\\tools"));
        assert_eq!(merged.previous_install_stores, vec![PathBuf::from("C:\\a")]);
    }

    #[test]
    fn nothing_installs_until_the_install_folder_is_confirmed() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let err = installing_manager().err().expect("refused before confirming");
        assert!(err.to_string().contains("Choose where"));
        save_settings(&WhichcraftSettings { install_store_confirmed: true, ..load_settings().unwrap() }).unwrap();
        assert!(installing_manager().is_ok());
    }

    #[test]
    fn a_confirmed_install_folder_stays_confirmed() {
        let current = WhichcraftSettings { install_store_confirmed: true, ..Default::default() };
        let incoming = WhichcraftSettings::default();
        assert!(merge_settings(current, incoming).install_store_confirmed);
        let unconfirmed = WhichcraftSettings::default();
        let confirming = WhichcraftSettings { install_store_confirmed: true, ..Default::default() };
        assert!(merge_settings(unconfirmed, confirming).install_store_confirmed);
    }
}

#[tauri::command]
pub async fn whichcraft_plan_tool(root: String, tool: ToolKind) -> Result<ToolApplyPlan, EnvarlyError> {
    off_main(move || {
        let backend = WinregBackend;
        let views = list_tool_installations(&backend, tool, None)?;
        let installation = views
            .into_iter()
            .find(|v| v.installation.root == PathBuf::from(&root))
            .map(|v| v.installation)
            .ok_or_else(|| EnvarlyError::InvalidInput(format!("unknown {tool:?} root: {root}")))?;
        create_tool_plan(&backend, &installation)
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_apply_tool_plan(plan: ToolApplyPlan) -> Result<ApplyToolResult, EnvarlyError> {
    off_main(move || {
        apply_tool_plan(&WinregBackend, &plan)
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_apply_tool_plan_with_uac(plan: ToolApplyPlan) -> Result<ApplyToolResult, EnvarlyError> {
    off_main(move || {
        apply_tool_plan_elevated(&WinregBackend, &WinElevator, &plan)
    })
    .await
}

#[tauri::command]
pub fn whichcraft_plan_path_cleanup() -> Result<PathCleanupPlan, EnvarlyError> {
    build_path_cleanup_plan(&WinregBackend)
}

#[tauri::command]
pub async fn whichcraft_undo_last_apply() -> Result<UndoResult, EnvarlyError> {
    off_main(move || {
        undo_last_apply(&WinregBackend, Some(&WinElevator))
    })
    .await
}

fn home_dir() -> PathBuf {
    std::env::var_os("USERPROFILE").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("C:\\"))
}

/// Opens the configured terminal with the environment a new process gets from the registry.
#[tauri::command]
pub fn whichcraft_open_terminal() -> Result<(), EnvarlyError> {
    use crate::whichcraft::adapters::win::process::{fresh_environment, WinProcessRunner};
    let kind = load_settings()?.terminal;
    crate::whichcraft::services::terminal::open_terminal(&WinProcessRunner, kind, &home_dir(), fresh_environment()?)
}

/// What the configured shell runs for `tool` after loading its profile, next to the effective one.
#[tauri::command]
pub async fn whichcraft_shell_check(
    tool: ToolKind,
) -> Result<crate::whichcraft::services::terminal::ShellCheck, EnvarlyError> {
    off_main(move || {
        use crate::whichcraft::adapters::win::process::{fresh_environment, WinProcessRunner};
        let kind = load_settings()?.terminal;
        crate::whichcraft::services::terminal::shell_check(
            &WinregBackend,
            &WinProcessRunner,
            kind,
            tool,
            fresh_environment()?,
            &home_dir(),
        )
    })
    .await
}

/// An apply that never finished (the app stopped mid-way), with each change's real state.
#[tauri::command]
pub fn whichcraft_recovery_status() -> Result<Option<RecoveryView>, EnvarlyError> {
    inspect_pending(&WinregBackend)
}

#[tauri::command]
pub async fn whichcraft_resume_apply(journal_id: String) -> Result<(), EnvarlyError> {
    off_main(move || {
        resume_pending(&WinregBackend, Some(&WinElevator), &journal_id)
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_roll_back_apply(journal_id: String) -> Result<UndoResult, EnvarlyError> {
    off_main(move || {
        roll_back_pending(&WinregBackend, Some(&WinElevator), &journal_id)
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_list_remote_versions(
    tool: ToolKind,
) -> Result<Vec<crate::whichcraft::domain::versions::RemoteVersion>, EnvarlyError> {
    off_main(move || {
        let mgr = MiseToolManager::new()?;
        mgr.list_remote(tool)
    })
    .await
}

/// Whether the pinned mise still has to be downloaded before the first install, and its size.
#[tauri::command]
pub fn whichcraft_mise_status() -> Result<crate::whichcraft::mise::manager::MiseStatus, EnvarlyError> {
    crate::whichcraft::mise::manager::mise_status()
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSize {
    /// `None` when it cannot be known before installing.
    pub download_bytes: Option<u64>,
    /// Estimated space once unpacked, where known (Flutter, I-9).
    pub disk_bytes: Option<u64>,
}

/// Download size of one version, and the space it takes once unpacked where that is known.
#[tauri::command]
pub async fn whichcraft_download_size(tool: ToolKind, version: String) -> Result<DownloadSize, EnvarlyError> {
    use crate::whichcraft::mise::sizes::{download_size, estimated_disk_bytes, http_content_length};
    off_main(move || {
        let download_bytes = download_size(tool, &version, http_content_length)?;
        Ok(DownloadSize { download_bytes, disk_bytes: download_bytes.and_then(|b| estimated_disk_bytes(tool, b)) })
    })
    .await
}

/// The mise manager for anything that downloads into the install store. Every install path goes
/// through here, so none can skip asking where installed tools go (I-5).
fn installing_manager() -> Result<MiseToolManager<crate::whichcraft::mise::manager::ProcessMiseRunner>, EnvarlyError> {
    if !load_settings()?.install_store_confirmed {
        return Err(EnvarlyError::InvalidInput(
            "Choose where Whichcraft keeps the tools it installs before installing".into(),
        ));
    }
    MiseToolManager::new()
}

#[tauri::command]
pub async fn whichcraft_install_managed(
    tool: ToolKind,
    version: String,
) -> Result<String, EnvarlyError> {
    off_main(move || {
        let mgr = installing_manager()?;
        let path = mgr.install(tool, &version)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}

#[tauri::command]
pub fn whichcraft_list_profiles() -> Result<Vec<ToolProfile>, EnvarlyError> {
    load_profiles()
}

#[tauri::command]
pub fn whichcraft_save_profiles(profiles: Vec<ToolProfile>) -> Result<(), EnvarlyError> {
    persist_profiles(&profiles)
}

#[tauri::command]
pub async fn whichcraft_profile_status(profile: ToolProfile) -> Result<ProfileMatchStatus, EnvarlyError> {
    off_main(move || {
        profile_status(&WinregBackend, &profile)
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_apply_profile(profile: ToolProfile) -> Result<ApplyToolResult, EnvarlyError> {
    off_main(move || {
        apply_profile(&WinregBackend, Some(&WinElevator), &profile)
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_plan_profile(profile: ToolProfile) -> Result<ToolApplyPlan, EnvarlyError> {
    off_main(move || {
        plan_profile_apply(&WinregBackend, &profile)
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_python_supplemental() -> Result<PythonSupplementalView, EnvarlyError> {
    off_main(move || {
        python_supplemental()
    })
    .await
}

#[tauri::command]
pub async fn whichcraft_android_inventory() -> Result<AndroidInventory, EnvarlyError> {
    off_main(move || {
        let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
        android_inventory(&WinregBackend, local.as_deref())
    })
    .await
}

#[tauri::command]
pub fn whichcraft_msvc_inventory() -> MsvcInventory {
    msvc_inventory()
}

fn build_uninstall_plan(tool: ToolKind, root: &str) -> Result<UninstallPlan, EnvarlyError> {
    use crate::whichcraft::adapters::win::installer_catalog::WinInstallerCatalog;
    use crate::whichcraft::adapters::win::uninstall::WinUsageProbe;
    use crate::whichcraft::ports::installer_catalog::InstallerCatalog;
    let backend = WinregBackend;
    let selection = load_tool_selection(tool)?;
    let views = crate::whichcraft::services::tool_inventory::with_missing_selection(
        list_tool_installations(&backend, tool, selection.as_ref().map(|s| s.root.as_path()))?,
        selection.as_ref(),
    );
    let root = PathBuf::from(root);
    let view = views
        .iter()
        .find(|v| v.installation.root == root)
        .ok_or_else(|| EnvarlyError::InvalidInput(format!("unknown {tool:?} root: {}", root.display())))?;
    let catalog = WinInstallerCatalog::load()?.entries_for_root(&root)?.into_iter().next();
    let settings = load_settings()?;
    // Only a plain folder (no registered uninstaller) needs every other tool's roots for Q26.
    let mut other_tool_roots = Vec::new();
    if catalog.is_none() {
        for other in [ToolKind::Java, ToolKind::Node, ToolKind::Python, ToolKind::Go, ToolKind::Flutter, ToolKind::Git] {
            if other != tool {
                other_tool_roots.extend(list_tool_installations(&backend, other, None)?.into_iter().map(|v| v.installation.root));
            }
        }
    }
    plan_uninstall(
        PlanInputs {
            view,
            all: &views,
            catalog,
            stores: &settings.all_install_stores(),
            scan_roots: &settings.scan_roots,
            protected: &protected_folders(),
            profiles: &load_profiles()?,
            other_tool_roots: &other_tool_roots,
        },
        &WinUsageProbe,
    )
}

/// Everything the uninstall dialog shows before the user confirms: method, usage, replacement.
#[tauri::command]
pub async fn whichcraft_plan_uninstall(tool: ToolKind, root: String) -> Result<UninstallPlan, EnvarlyError> {
    off_main(move || build_uninstall_plan(tool, &root)).await
}

/// Plans again from the installation itself (the program to run never comes from the UI), switches
/// to `replacement` first when the installation is selected or effective, then removes it.
#[tauri::command]
pub async fn whichcraft_uninstall(
    tool: ToolKind,
    root: String,
    replacement: Option<ToolApplyPlan>,
) -> Result<UninstallOutcome, EnvarlyError> {
    use crate::whichcraft::adapters::win::uninstall::{WinUninstaller, WinUsageProbe};
    off_main(move || {
        let plan = build_uninstall_plan(tool, &root)?;
        uninstall(&plan, replacement.as_ref(), &WinregBackend, &WinElevator, &WinUsageProbe, &WinUninstaller)
    })
    .await
}

/// Newer releases in the same line as the installations of `tool` (ticket 16).
#[tauri::command]
pub async fn whichcraft_update_candidates(tool: ToolKind) -> Result<Vec<UpdateCandidate>, EnvarlyError> {
    off_main(move || {
        let views = list_tool_installations(&WinregBackend, tool, None)?;
        let remote = MiseToolManager::new()?.list_remote(tool)?;
        Ok(update_candidates(tool, &views, &remote))
    })
    .await
}

/// Installs the newer release beside the old one and returns the plan to switch to it.
#[tauri::command]
pub async fn whichcraft_update_installation(tool: ToolKind, version: String) -> Result<UpdateResult, EnvarlyError> {
    off_main(move || {
        let mgr = installing_manager()?;
        install_and_plan(&WinregBackend, tool, &version, |tool, version| mgr.install(tool, version))
    })
    .await
}

/// Started once when the app opens: fetches a newly pinned mise in the background when an older
/// one is on disk, then removes the older one (ticket 17).
#[tauri::command]
pub async fn whichcraft_prepare_mise() -> Result<bool, EnvarlyError> {
    off_main(crate::whichcraft::mise::manager::prepare_mise).await
}

fn missing_for(profile: &ToolProfile) -> Result<Vec<MissingPin>, EnvarlyError> {
    let status = profile_status(&WinregBackend, profile)?;
    if status.unavailable.is_empty() {
        return Ok(Vec::new());
    }
    let mgr = MiseToolManager::new()?;
    missing_pins(
        &status.unavailable,
        |tool| mgr.list_remote(tool),
        |tool, version| {
            crate::whichcraft::mise::sizes::download_size(tool, version, crate::whichcraft::mise::sizes::http_content_length)
                .ok()
                .flatten()
        },
    )
}

/// The unavailable pins of a profile and what Whichcraft would install for each (F-3).
#[tauri::command]
pub async fn whichcraft_profile_missing(profile: ToolProfile) -> Result<Vec<MissingPin>, EnvarlyError> {
    off_main(move || missing_for(&profile)).await
}

/// Installs every missing pin; the caller then plans and applies the profile as usual.
#[tauri::command]
pub async fn whichcraft_install_missing(profile: ToolProfile) -> Result<(), EnvarlyError> {
    off_main(move || {
        let missing = missing_for(&profile)?;
        let not_installable: Vec<String> = missing
            .iter()
            .filter(|m| m.install_version.is_none())
            .map(|m| format!("{:?} {} {}", m.pin.tool, m.pin.vendor, m.pin.version))
            .collect();
        if !not_installable.is_empty() {
            return Err(EnvarlyError::InvalidInput(format!(
                "Whichcraft cannot install: {}",
                not_installable.join(", ")
            )));
        }
        let mgr = installing_manager()?;
        for m in &missing {
            mgr.install(m.pin.tool, m.install_version.as_deref().unwrap_or_default())?;
        }
        Ok(())
    })
    .await
}

/// Names of the profiles that use this installation, offered for repointing when it is updated (F-5).
#[tauri::command]
pub fn whichcraft_profiles_using(installation: ToolInstallation) -> Result<Vec<String>, EnvarlyError> {
    Ok(crate::whichcraft::domain::profiles::profiles_using(&load_profiles()?, &installation))
}

/// Points the profiles that use `from` at `to` (F-5); returns the names that changed.
#[tauri::command]
pub fn whichcraft_repoint_profiles(from: ToolInstallation, to: ToolInstallation) -> Result<Vec<String>, EnvarlyError> {
    let mut profiles = load_profiles()?;
    let changed = repoint_profiles(&mut profiles, &from, &to);
    if !changed.is_empty() {
        persist_profiles(&profiles)?;
    }
    Ok(changed)
}

/// Uninstalls that started but were never seen to finish.
#[tauri::command]
pub fn whichcraft_unfinished_uninstalls() -> Result<Vec<UninstallRecord>, EnvarlyError> {
    unfinished_uninstalls()
}

/// Records what the disk shows now for an uninstall that was cut short.
#[tauri::command]
pub fn whichcraft_dismiss_unfinished_uninstall(id: String) -> Result<(), EnvarlyError> {
    dismiss_unfinished_uninstall(&id)
}

/// Opens a folder in Explorer, e.g. what an uninstaller left behind.
#[tauri::command]
pub fn whichcraft_open_folder(path: String) -> Result<(), EnvarlyError> {
    // Explorer opens (runs) a file it is given, so only folders are accepted.
    if !std::path::Path::new(&path).is_dir() {
        return Err(EnvarlyError::InvalidInput(format!("not a folder: {path}")));
    }
    std::process::Command::new("explorer.exe")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| EnvarlyError::InvalidInput(format!("open {path}: {e}")))
}