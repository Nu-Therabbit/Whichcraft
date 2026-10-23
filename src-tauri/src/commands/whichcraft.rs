use std::path::PathBuf;

use crate::env_backend::WinregBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::ToolKind;
use crate::whichcraft::mise::MiseToolManager;
use crate::whichcraft::persistence::{
    load_java_selection, load_settings, load_tool_selection, save_settings, WhichcraftSettings,
};
use crate::whichcraft::ports::tool_manager::ToolManager;
use crate::whichcraft::services::elevation::WinElevator;
use crate::whichcraft::services::java_inventory::{list_java_installations, JavaInstallationView};
use crate::whichcraft::services::path_cleanup::{build_path_cleanup_plan, PathCleanupPlan};
use crate::whichcraft::services::profiles::{
    apply_profile, load_profiles, profile_status, save_profiles as persist_profiles, plan_profile_apply,
    ProfileMatchStatus, ToolProfile,
};
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
use crate::whichcraft::services::tool_inventory::{list_tool_installations, ToolInstallationView};
use crate::whichcraft::services::tool_plan::ToolApplyPlan;
use crate::whichcraft::services::undo::{undo_last_apply, UndoResult};
use crate::whichcraft::{CoreHealth, WhichcraftCore};

#[tauri::command]
pub fn whichcraft_health() -> CoreHealth {
    WhichcraftCore::with_fakes().health()
}

#[tauri::command]
pub fn whichcraft_list_java() -> Result<Vec<JavaInstallationView>, EnvarlyError> {
    let backend = WinregBackend;
    let selected = load_java_selection()?.map(|s| s.root);
    list_java_installations(&backend, selected.as_deref())
}

#[tauri::command]
pub fn whichcraft_list_tools(tool: ToolKind) -> Result<Vec<ToolInstallationView>, EnvarlyError> {
    let backend = WinregBackend;
    let selection = load_tool_selection(tool)?;
    let views = list_tool_installations(&backend, tool, selection.as_ref().map(|s| s.root.as_path()))?;
    Ok(crate::whichcraft::services::tool_inventory::with_missing_selection(views, selection.as_ref()))
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
}

/// Java goes through the same plan as every other tool (JAVA_HOME + PATH, System shadowing).
#[tauri::command]
pub fn whichcraft_plan_java(root: String) -> Result<ToolApplyPlan, EnvarlyError> {
    let backend = WinregBackend;
    let views = list_java_installations(&backend, None)?;
    let java = views
        .into_iter()
        .find(|v| v.installation.root == PathBuf::from(&root))
        .map(|v| v.installation)
        .ok_or_else(|| EnvarlyError::InvalidInput(format!("unknown java root: {root}")))?;
    let installation = crate::whichcraft::ports::installation_probe::ToolInstallation {
        tool: ToolKind::Java,
        vendor: java.vendor,
        version: java.version,
        root: java.root,
        managed: java.managed,
    };
    create_tool_plan(&backend, &installation)
}

#[tauri::command]
pub fn whichcraft_plan_tool(root: String, tool: ToolKind) -> Result<ToolApplyPlan, EnvarlyError> {
    let backend = WinregBackend;
    let views = list_tool_installations(&backend, tool, None)?;
    let installation = views
        .into_iter()
        .find(|v| v.installation.root == PathBuf::from(&root))
        .map(|v| v.installation)
        .ok_or_else(|| EnvarlyError::InvalidInput(format!("unknown {tool:?} root: {root}")))?;
    create_tool_plan(&backend, &installation)
}

#[tauri::command]
pub fn whichcraft_apply_java_plan(plan: ToolApplyPlan) -> Result<ApplyToolResult, EnvarlyError> {
    apply_tool_plan_elevated(&WinregBackend, &WinElevator, &plan)
}

#[tauri::command]
pub fn whichcraft_apply_tool_plan(plan: ToolApplyPlan) -> Result<ApplyToolResult, EnvarlyError> {
    apply_tool_plan(&WinregBackend, &plan)
}

#[tauri::command]
pub fn whichcraft_apply_tool_plan_with_uac(plan: ToolApplyPlan) -> Result<ApplyToolResult, EnvarlyError> {
    apply_tool_plan_elevated(&WinregBackend, &WinElevator, &plan)
}

#[tauri::command]
pub fn whichcraft_plan_path_cleanup() -> Result<PathCleanupPlan, EnvarlyError> {
    build_path_cleanup_plan(&WinregBackend)
}

#[tauri::command]
pub fn whichcraft_undo_last_apply() -> Result<UndoResult, EnvarlyError> {
    undo_last_apply(&WinregBackend, Some(&WinElevator))
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
pub fn whichcraft_shell_check(
    tool: ToolKind,
) -> Result<crate::whichcraft::services::terminal::ShellCheck, EnvarlyError> {
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
}

/// An apply that never finished (the app stopped mid-way), with each change's real state.
#[tauri::command]
pub fn whichcraft_recovery_status() -> Result<Option<RecoveryView>, EnvarlyError> {
    inspect_pending(&WinregBackend)
}

#[tauri::command]
pub fn whichcraft_resume_apply(journal_id: String) -> Result<(), EnvarlyError> {
    resume_pending(&WinregBackend, Some(&WinElevator), &journal_id)
}

#[tauri::command]
pub fn whichcraft_roll_back_apply(journal_id: String) -> Result<UndoResult, EnvarlyError> {
    roll_back_pending(&WinregBackend, Some(&WinElevator), &journal_id)
}

#[tauri::command]
pub fn whichcraft_get_java_selection(
) -> Result<Option<crate::whichcraft::persistence::JavaSelection>, EnvarlyError> {
    load_java_selection()
}

#[tauri::command]
pub fn whichcraft_list_remote_versions(
    tool: ToolKind,
) -> Result<Vec<crate::whichcraft::ports::tool_manager::RemoteVersion>, EnvarlyError> {
    let mgr = MiseToolManager::new()?;
    mgr.list_remote(tool)
}

/// Download size in bytes for one version, or `None` when it cannot be known before installing.
#[tauri::command]
pub fn whichcraft_download_size(tool: ToolKind, version: String) -> Result<Option<u64>, EnvarlyError> {
    crate::whichcraft::mise::sizes::download_size(
        tool,
        &version,
        crate::whichcraft::mise::sizes::http_content_length,
    )
}

#[tauri::command]
pub fn whichcraft_install_managed(
    tool: ToolKind,
    version: String,
) -> Result<String, EnvarlyError> {
    let mgr = MiseToolManager::new()?;
    let path = mgr.install(tool, &version)?;
    Ok(path.to_string_lossy().into_owned())
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
pub fn whichcraft_profile_status(profile: ToolProfile) -> Result<ProfileMatchStatus, EnvarlyError> {
    profile_status(&WinregBackend, &profile)
}

#[tauri::command]
pub fn whichcraft_apply_profile(profile: ToolProfile) -> Result<ApplyToolResult, EnvarlyError> {
    apply_profile(&WinregBackend, Some(&WinElevator), &profile)
}

#[tauri::command]
pub fn whichcraft_plan_profile(profile: ToolProfile) -> Result<ToolApplyPlan, EnvarlyError> {
    plan_profile_apply(&WinregBackend, &profile)
}

#[tauri::command]
pub fn whichcraft_python_supplemental() -> Result<PythonSupplementalView, EnvarlyError> {
    python_supplemental()
}

#[tauri::command]
pub fn whichcraft_android_inventory() -> Result<AndroidInventory, EnvarlyError> {
    let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    android_inventory(&WinregBackend, local.as_deref())
}

#[tauri::command]
pub fn whichcraft_msvc_inventory() -> MsvcInventory {
    msvc_inventory()
}
