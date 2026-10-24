//! The use cases the app offers, each one call. `App` holds one implementation of every port; the
//! composition root builds it from the Windows adapters and tests build it from fakes (ADR-0005).

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::application::path_cleanup::{build_path_cleanup_plan, PathCleanupPlan};
use crate::whichcraft::application::profiles::{plan_profile_apply, profile_status};
use crate::whichcraft::application::recovery::{inspect_pending, resume_pending, roll_back_pending, RecoveryView};
use crate::whichcraft::application::supplemental_inventory::{
    android_inventory, msvc_inventory, python_supplemental, AndroidInventory, MsvcInventory, PythonSupplementalView,
};
use crate::whichcraft::application::terminal::{open_terminal, shell_check, ShellCheck};
use crate::whichcraft::application::tool_apply::{apply_tool_plan, apply_tool_plan_elevated, create_tool_plan, ApplyToolResult};
use crate::whichcraft::application::tool_inventory::{list_tool_installations, with_missing_selection};
use crate::whichcraft::application::undo::{undo_last_apply, UndoResult};
use crate::whichcraft::application::uninstall::{
    dismiss_unfinished_uninstall, plan_uninstall, protected_folders, uninstall, unfinished_uninstalls, PlanInputs,
    UninstallPlan, UninstallPorts,
};
use crate::whichcraft::application::update::{install_and_plan, UpdateResult};
use crate::whichcraft::domain::profiles::{missing_pins, profiles_using, repoint_profiles, MissingPin, ProfileMatchStatus, ToolProfile};
use crate::whichcraft::domain::settings::WhichcraftSettings;
use crate::whichcraft::domain::uninstall::{UninstallOutcome, UninstallRecord};
use crate::whichcraft::domain::versions::{estimated_disk_bytes, update_candidates, RemoteVersion, UpdateCandidate};
use crate::whichcraft::domain::{ToolApplyPlan, ToolInstallation, ToolInstallationView, ToolKind};
use crate::whichcraft::ports::elevator::Elevator;
use crate::whichcraft::ports::installer_lifecycle::{InstallerLifecycle, MiseStatus};
use crate::whichcraft::ports::installer_catalog::InstallerCatalogSource;
use crate::whichcraft::ports::machine::Machine;
use crate::whichcraft::ports::process::ProcessRunner;
use crate::whichcraft::ports::sdk::SdkProbe;
use crate::whichcraft::ports::store::Store;
use crate::whichcraft::ports::tool_manager::{ToolManager, ToolManagers};
use crate::whichcraft::ports::uninstaller::Uninstaller;
use crate::whichcraft::ports::operation_ids::OperationIds;
use crate::whichcraft::ports::usage_probe::UsageProbe;

const ALL_TOOLS: [ToolKind; 6] = [ToolKind::Java, ToolKind::Node, ToolKind::Python, ToolKind::Go, ToolKind::Flutter, ToolKind::Git];

pub struct App<B: EnvBackend> {
    pub env: B,
    pub store: Box<dyn Store>,
    pub machine: Box<dyn Machine>,
    pub catalogs: Box<dyn InstallerCatalogSource>,
    pub tools: Box<dyn ToolManagers>,
    pub elevator: Box<dyn Elevator>,
    pub usage: Box<dyn UsageProbe>,
    pub uninstaller: Box<dyn Uninstaller>,
    pub sdk: Box<dyn SdkProbe>,
    pub processes: Box<dyn ProcessRunner>,
    pub ids: Box<dyn OperationIds>,
    pub installer_lifecycle: Box<dyn InstallerLifecycle>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSize {
    /// `None` when it cannot be known before installing.
    pub download_bytes: Option<u64>,
    /// Estimated space once unpacked, where known (Flutter, I-9).
    pub disk_bytes: Option<u64>,
}

/// Takes the caller's settings but keeps the store history on disk: a changed store is
/// switched to (the old one stays listed), and a missing history is not taken as "forget it".
pub fn merge_settings(current: WhichcraftSettings, incoming: WhichcraftSettings) -> WhichcraftSettings {
    let mut merged = current;
    merged.install_store_confirmed |= incoming.install_store_confirmed;
    merged.switch_install_store(incoming.install_store);
    merged.scan_roots = incoming.scan_roots;
    merged.terminal = incoming.terminal;
    merged
}

impl<B: EnvBackend> App<B> {
    // --- pinned mise lifecycle (install page / prepare-on-start) ---

    pub fn mise_status(&self) -> Result<MiseStatus, EnvarlyError> {
        self.installer_lifecycle.mise_status()
    }

    pub fn prepare_mise(&self) -> Result<bool, EnvarlyError> {
        self.installer_lifecycle.prepare_mise()
    }

    // --- inventory and settings ---

    /// The installations of `tool`, with the remembered choice shown even if it vanished (D-5).
    pub fn list_tools(&self, tool: ToolKind) -> Result<Vec<ToolInstallationView>, EnvarlyError> {
        let selection = self.store.selection(tool)?;
        let catalog = self.catalogs.load()?;
        let views = list_tool_installations(
            &self.env,
            &*self.store,
            &*self.machine,
            &*catalog,
            tool,
            selection.as_ref().map(|s| s.root.as_path()),
        )?;
        Ok(with_missing_selection(views, selection.as_ref()))
    }

    pub fn settings(&self) -> Result<WhichcraftSettings, EnvarlyError> {
        self.store.settings()
    }

    pub fn save_settings(&self, incoming: WhichcraftSettings) -> Result<(), EnvarlyError> {
        self.store.save_settings(&merge_settings(self.store.settings()?, incoming))
    }

    // --- switching, Undo, recovery ---

    pub fn plan_switch(&self, tool: ToolKind, root: &Path) -> Result<ToolApplyPlan, EnvarlyError> {
        let installation = self
            .list_tools(tool)?
            .into_iter()
            .find(|v| v.installation.root == root)
            .map(|v| v.installation)
            .ok_or_else(|| EnvarlyError::InvalidInput(format!("unknown {tool:?} root: {}", root.display())))?;
        create_tool_plan(&self.env, &*self.machine, &installation, &*self.ids)
    }

    /// Applies a plan; with `elevate`, the System part goes through UAC.
    pub fn apply(&self, plan: &ToolApplyPlan, elevate: bool) -> Result<ApplyToolResult, EnvarlyError> {
        if elevate {
            apply_tool_plan_elevated(&self.env, &*self.store, &*self.ids, &*self.elevator, plan)
        } else {
            apply_tool_plan(&self.env, &*self.store, &*self.ids, plan)
        }
    }

    pub fn undo(&self) -> Result<UndoResult, EnvarlyError> {
        undo_last_apply(&self.env, &*self.store, Some(&*self.elevator))
    }

    pub fn recovery_status(&self) -> Result<Option<RecoveryView>, EnvarlyError> {
        inspect_pending(&self.env, &*self.store)
    }

    pub fn resume(&self, journal_id: &str) -> Result<(), EnvarlyError> {
        resume_pending(&self.env, &*self.store, Some(&*self.elevator), journal_id)
    }

    pub fn roll_back(&self, journal_id: &str) -> Result<UndoResult, EnvarlyError> {
        roll_back_pending(&self.env, &*self.store, Some(&*self.elevator), journal_id)
    }

    pub fn plan_path_cleanup(&self) -> Result<PathCleanupPlan, EnvarlyError> {
        build_path_cleanup_plan(&self.env, &*self.machine, &*self.ids)
    }

    // --- terminal ---

    fn home(&self) -> PathBuf {
        self.machine.env_var("USERPROFILE").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("C:\\"))
    }

    /// Opens the configured terminal with the environment a new process gets from the registry.
    pub fn open_terminal(&self) -> Result<(), EnvarlyError> {
        let kind = self.store.settings()?.terminal;
        open_terminal(&*self.processes, kind, &self.home(), self.processes.fresh_environment()?)
    }

    /// What the configured shell runs for `tool` after loading its profile, next to the effective one.
    pub fn shell_check(&self, tool: ToolKind) -> Result<ShellCheck, EnvarlyError> {
        let kind = self.store.settings()?.terminal;
        let env = self.processes.fresh_environment()?;
        shell_check(&self.env, &*self.machine, &*self.processes, kind, tool, env, &self.home())
    }

    pub fn open_folder(&self, folder: &Path) -> Result<(), EnvarlyError> {
        self.processes.open_folder(folder)
    }

    // --- installing and updating ---

    fn tool_manager(&self) -> Result<Box<dyn ToolManager>, EnvarlyError> {
        Ok(self.tools.for_store(&self.store.settings()?.install_store))
    }

    /// The installer for anything that downloads into the install store. Every install path goes
    /// through here, so none can skip asking where installed tools go (I-5).
    fn installing_manager(&self) -> Result<Box<dyn ToolManager>, EnvarlyError> {
        let settings = self.store.settings()?;
        if !settings.install_store_confirmed {
            return Err(EnvarlyError::InvalidInput(
                "Choose where Whichcraft keeps the tools it installs before installing".into(),
            ));
        }
        Ok(self.tools.for_store(&settings.install_store))
    }

    pub fn remote_versions(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError> {
        self.tool_manager()?.list_remote(tool)
    }

    pub fn download_size(&self, tool: ToolKind, version: &str) -> Result<DownloadSize, EnvarlyError> {
        let download_bytes = self.tool_manager()?.download_size(tool, version)?;
        Ok(DownloadSize { download_bytes, disk_bytes: download_bytes.and_then(|b| estimated_disk_bytes(tool, b)) })
    }

    pub fn install(&self, tool: ToolKind, version: &str) -> Result<PathBuf, EnvarlyError> {
        self.installing_manager()?.install(tool, version)
    }

    /// Newer releases in the same line as the installations of `tool` (ticket 16).
    pub fn update_candidates(&self, tool: ToolKind) -> Result<Vec<UpdateCandidate>, EnvarlyError> {
        let views = self.list_tools(tool)?;
        let remote = self.tool_manager()?.list_remote(tool)?;
        Ok(update_candidates(tool, &views, &remote))
    }

    /// Installs the newer release beside the old one and returns the plan to switch to it.
    pub fn update(&self, tool: ToolKind, version: &str) -> Result<UpdateResult, EnvarlyError> {
        let manager = self.installing_manager()?;
        install_and_plan(&self.env, &*self.machine, &*self.ids, tool, version, |tool, version| {
            manager.install(tool, version)
        })
    }

    // --- profiles ---

    pub fn profiles(&self) -> Result<Vec<ToolProfile>, EnvarlyError> {
        self.store.profiles()
    }

    pub fn save_profiles(&self, profiles: &[ToolProfile]) -> Result<(), EnvarlyError> {
        self.store.save_profiles(profiles)
    }

    pub fn profile_status(&self, profile: &ToolProfile) -> Result<ProfileMatchStatus, EnvarlyError> {
        let catalog = self.catalogs.load()?;
        profile_status(&self.env, &*self.store, &*self.machine, &*catalog, profile)
    }

    pub fn plan_profile(&self, profile: &ToolProfile) -> Result<ToolApplyPlan, EnvarlyError> {
        let catalog = self.catalogs.load()?;
        plan_profile_apply(&self.env, &*self.store, &*self.machine, &*catalog, profile, &*self.ids)
    }

    /// The unavailable pins of a profile and what Whichcraft would install for each (F-3).
    pub fn profile_missing(&self, profile: &ToolProfile) -> Result<Vec<MissingPin>, EnvarlyError> {
        let status = self.profile_status(profile)?;
        if status.unavailable.is_empty() {
            return Ok(Vec::new());
        }
        let manager = self.tool_manager()?;
        missing_pins(&status.unavailable, |tool| manager.list_remote(tool), |tool, version| {
            manager.download_size(tool, version).ok().flatten()
        })
    }

    /// Installs every missing pin; the caller then plans and applies the profile as usual.
    pub fn install_missing(&self, profile: &ToolProfile) -> Result<(), EnvarlyError> {
        let missing = self.profile_missing(profile)?;
        let not_installable: Vec<String> = missing
            .iter()
            .filter(|m| m.install_version.is_none())
            .map(|m| format!("{:?} {} {}", m.pin.tool, m.pin.vendor, m.pin.version))
            .collect();
        if !not_installable.is_empty() {
            return Err(EnvarlyError::InvalidInput(format!("Whichcraft cannot install: {}", not_installable.join(", "))));
        }
        let manager = self.installing_manager()?;
        for m in &missing {
            manager.install(m.pin.tool, m.install_version.as_deref().unwrap_or_default())?;
        }
        Ok(())
    }

    /// Names of the profiles that use this installation, offered for repointing when it is updated (F-5).
    pub fn profiles_using(&self, installation: &ToolInstallation) -> Result<Vec<String>, EnvarlyError> {
        Ok(profiles_using(&self.store.profiles()?, installation))
    }

    /// Points the profiles that use `from` at `to` (F-5); returns the names that changed.
    pub fn repoint_profiles(&self, from: &ToolInstallation, to: &ToolInstallation) -> Result<Vec<String>, EnvarlyError> {
        let mut profiles = self.store.profiles()?;
        let changed = repoint_profiles(&mut profiles, from, to);
        if !changed.is_empty() {
            self.store.save_profiles(&profiles)?;
        }
        Ok(changed)
    }

    // --- read-only SDK inventory ---

    pub fn python_supplemental(&self) -> Result<PythonSupplementalView, EnvarlyError> {
        python_supplemental(&*self.sdk)
    }

    pub fn android_inventory(&self) -> Result<AndroidInventory, EnvarlyError> {
        let local = self.machine.env_var("LOCALAPPDATA").map(PathBuf::from);
        android_inventory(&self.env, &*self.machine, local.as_deref())
    }

    pub fn msvc_inventory(&self) -> MsvcInventory {
        msvc_inventory(&*self.machine, &*self.sdk)
    }

    // --- uninstalling ---

    /// Everything the uninstall dialog shows before the user confirms: method, usage, replacement.
    pub fn plan_uninstall(&self, tool: ToolKind, root: &Path) -> Result<UninstallPlan, EnvarlyError> {
        let views = self.list_tools(tool)?;
        let view = views
            .iter()
            .find(|v| v.installation.root == root)
            .ok_or_else(|| EnvarlyError::InvalidInput(format!("unknown {tool:?} root: {}", root.display())))?;
        let catalog = self.catalogs.load()?;
        let entry = catalog.entries_for_root(root)?.into_iter().next();
        let settings = self.store.settings()?;
        // Only a plain folder (no registered uninstaller) needs every other tool's roots for Q26.
        let mut other_tool_roots = Vec::new();
        if entry.is_none() {
            for other in ALL_TOOLS.into_iter().filter(|t| *t != tool) {
                let list = list_tool_installations(&self.env, &*self.store, &*self.machine, &*catalog, other, None)?;
                other_tool_roots.extend(list.into_iter().map(|v| v.installation.root));
            }
        }
        plan_uninstall(
            PlanInputs {
                machine: &*self.machine,
                view,
                all: &views,
                catalog: entry,
                stores: &settings.all_install_stores(),
                scan_roots: &settings.scan_roots,
                protected: &protected_folders(&*self.machine),
                profiles: &self.store.profiles()?,
                other_tool_roots: &other_tool_roots,
            },
            &*self.usage,
        )
    }

    /// Plans again from the installation itself (the program to run never comes from the UI),
    /// switches to `replacement` first when the installation is selected or effective, then
    /// removes it.
    pub fn uninstall(&self, tool: ToolKind, root: &Path, replacement: Option<&ToolApplyPlan>) -> Result<UninstallOutcome, EnvarlyError> {
        let plan = self.plan_uninstall(tool, root)?;
        uninstall(
            &plan,
            replacement,
            &UninstallPorts {
                backend: &self.env,
                store: &*self.store,
                ids: &*self.ids,
                machine: &*self.machine,
                elevator: &*self.elevator,
                usage: &*self.usage,
                uninstaller: &*self.uninstaller,
            },
        )
    }

    pub fn unfinished_uninstalls(&self) -> Result<Vec<UninstallRecord>, EnvarlyError> {
        unfinished_uninstalls(&*self.store)
    }

    pub fn dismiss_unfinished_uninstall(&self, id: &str) -> Result<(), EnvarlyError> {
        dismiss_unfinished_uninstall(&*self.store, &*self.machine, &*self.ids, id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saving_settings_without_store_history_keeps_it() {
        let mut current = WhichcraftSettings { install_store: r"C:\a".into(), ..Default::default() };
        current.switch_install_store(r"C:\b".into());
        let incoming = WhichcraftSettings { install_store: r"C:\b".into(), ..Default::default() };
        let merged = merge_settings(current, incoming);
        assert_eq!(merged.all_install_stores(), vec![PathBuf::from(r"C:\b"), PathBuf::from(r"C:\a")]);
    }

    #[test]
    fn saving_a_new_store_keeps_the_old_one_listed() {
        let current = WhichcraftSettings { install_store: r"C:\a".into(), ..Default::default() };
        let incoming = WhichcraftSettings { install_store: r"D:\tools".into(), ..Default::default() };
        let merged = merge_settings(current, incoming);
        assert_eq!(merged.install_store, PathBuf::from(r"D:\tools"));
        assert_eq!(merged.previous_install_stores, vec![PathBuf::from(r"C:\a")]);
    }

    #[test]
    fn a_confirmed_install_folder_stays_confirmed() {
        let current = WhichcraftSettings { install_store_confirmed: true, ..Default::default() };
        assert!(merge_settings(current, WhichcraftSettings::default()).install_store_confirmed);
        let confirming = WhichcraftSettings { install_store_confirmed: true, ..Default::default() };
        assert!(merge_settings(WhichcraftSettings::default(), confirming).install_store_confirmed);
    }
}
