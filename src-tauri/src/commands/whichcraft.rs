//! Tauri commands: each one parses its input, calls one use case on the app the composition root
//! builds, and returns the result. No decisions are made here (ADR-0005).

use std::path::{Path, PathBuf};

use crate::error::EnvarlyError;
use crate::whichcraft::application::app::DownloadSize;
use crate::whichcraft::application::path_cleanup::PathCleanupPlan;
use crate::whichcraft::application::recovery::RecoveryView;
use crate::whichcraft::application::supplemental_inventory::{AndroidInventory, MsvcInventory, PythonSupplementalView};
use crate::whichcraft::application::terminal::ShellCheck;
use crate::whichcraft::application::tool_apply::ApplyToolResult;
use crate::whichcraft::application::undo::UndoResult;
use crate::whichcraft::application::uninstall::UninstallPlan;
use crate::whichcraft::application::update::UpdateResult;
use crate::whichcraft::compose::windows_app;
use crate::whichcraft::domain::profiles::{MissingPin, ProfileMatchStatus, ToolProfile};
use crate::whichcraft::domain::settings::WhichcraftSettings;
use crate::whichcraft::domain::uninstall::{UninstallOutcome, UninstallRecord};
use crate::whichcraft::domain::versions::{RemoteVersion, UpdateCandidate};
use crate::whichcraft::domain::{ToolApplyPlan, ToolInstallation, ToolInstallationView, ToolKind};

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
    off_main(move || windows_app().list_tools(tool)).await
}

#[tauri::command]
pub fn whichcraft_get_settings() -> Result<WhichcraftSettings, EnvarlyError> {
    windows_app().settings()
}

#[tauri::command]
pub fn whichcraft_save_settings(settings: WhichcraftSettings) -> Result<(), EnvarlyError> {
    windows_app().save_settings(settings)
}

#[tauri::command]
pub async fn whichcraft_plan_tool(root: String, tool: ToolKind) -> Result<ToolApplyPlan, EnvarlyError> {
    off_main(move || windows_app().plan_switch(tool, Path::new(&root))).await
}

#[tauri::command]
pub async fn whichcraft_apply_tool_plan(plan: ToolApplyPlan) -> Result<ApplyToolResult, EnvarlyError> {
    off_main(move || windows_app().apply(&plan, false)).await
}

#[tauri::command]
pub async fn whichcraft_apply_tool_plan_with_uac(plan: ToolApplyPlan) -> Result<ApplyToolResult, EnvarlyError> {
    off_main(move || windows_app().apply(&plan, true)).await
}

#[tauri::command]
pub fn whichcraft_plan_path_cleanup() -> Result<PathCleanupPlan, EnvarlyError> {
    windows_app().plan_path_cleanup()
}

#[tauri::command]
pub async fn whichcraft_undo_last_apply() -> Result<UndoResult, EnvarlyError> {
    off_main(move || windows_app().undo()).await
}

#[tauri::command]
pub fn whichcraft_open_terminal() -> Result<(), EnvarlyError> {
    windows_app().open_terminal()
}

#[tauri::command]
pub async fn whichcraft_shell_check(tool: ToolKind) -> Result<ShellCheck, EnvarlyError> {
    off_main(move || windows_app().shell_check(tool)).await
}

#[tauri::command]
pub fn whichcraft_recovery_status() -> Result<Option<RecoveryView>, EnvarlyError> {
    windows_app().recovery_status()
}

#[tauri::command]
pub async fn whichcraft_resume_apply(journal_id: String) -> Result<(), EnvarlyError> {
    off_main(move || windows_app().resume(&journal_id)).await
}

#[tauri::command]
pub async fn whichcraft_roll_back_apply(journal_id: String) -> Result<UndoResult, EnvarlyError> {
    off_main(move || windows_app().roll_back(&journal_id)).await
}

#[tauri::command]
pub async fn whichcraft_list_remote_versions(tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError> {
    off_main(move || windows_app().remote_versions(tool)).await
}

/// Whether the pinned mise still has to be downloaded before the first install, and its size.
#[tauri::command]
pub fn whichcraft_mise_status() -> Result<crate::whichcraft::ports::installer_lifecycle::MiseStatus, EnvarlyError> {
    windows_app().mise_status()
}

#[tauri::command]
pub async fn whichcraft_download_size(tool: ToolKind, version: String) -> Result<DownloadSize, EnvarlyError> {
    off_main(move || windows_app().download_size(tool, &version)).await
}

#[tauri::command]
pub async fn whichcraft_install_managed(tool: ToolKind, version: String) -> Result<String, EnvarlyError> {
    off_main(move || Ok(windows_app().install(tool, &version)?.to_string_lossy().into_owned())).await
}

#[tauri::command]
pub fn whichcraft_list_profiles() -> Result<Vec<ToolProfile>, EnvarlyError> {
    windows_app().profiles()
}

#[tauri::command]
pub fn whichcraft_save_profiles(profiles: Vec<ToolProfile>) -> Result<(), EnvarlyError> {
    windows_app().save_profiles(&profiles)
}

#[tauri::command]
pub async fn whichcraft_profile_status(profile: ToolProfile) -> Result<ProfileMatchStatus, EnvarlyError> {
    off_main(move || windows_app().profile_status(&profile)).await
}

#[tauri::command]
pub async fn whichcraft_plan_profile(profile: ToolProfile) -> Result<ToolApplyPlan, EnvarlyError> {
    off_main(move || windows_app().plan_profile(&profile)).await
}

#[tauri::command]
pub async fn whichcraft_python_supplemental() -> Result<PythonSupplementalView, EnvarlyError> {
    off_main(move || windows_app().python_supplemental()).await
}

#[tauri::command]
pub async fn whichcraft_android_inventory() -> Result<AndroidInventory, EnvarlyError> {
    off_main(move || windows_app().android_inventory()).await
}

#[tauri::command]
pub fn whichcraft_msvc_inventory() -> MsvcInventory {
    windows_app().msvc_inventory()
}

#[tauri::command]
pub async fn whichcraft_plan_uninstall(tool: ToolKind, root: String) -> Result<UninstallPlan, EnvarlyError> {
    off_main(move || windows_app().plan_uninstall(tool, Path::new(&root))).await
}

#[tauri::command]
pub async fn whichcraft_uninstall(
    tool: ToolKind,
    root: String,
    replacement: Option<ToolApplyPlan>,
) -> Result<UninstallOutcome, EnvarlyError> {
    off_main(move || windows_app().uninstall(tool, Path::new(&root), replacement.as_ref())).await
}

#[tauri::command]
pub async fn whichcraft_update_candidates(tool: ToolKind) -> Result<Vec<UpdateCandidate>, EnvarlyError> {
    off_main(move || windows_app().update_candidates(tool)).await
}

#[tauri::command]
pub async fn whichcraft_update_installation(tool: ToolKind, version: String) -> Result<UpdateResult, EnvarlyError> {
    off_main(move || windows_app().update(tool, &version)).await
}

/// Started once when the app opens: fetches a newly pinned mise in the background when an older
/// one is on disk, then removes the older one (ticket 17).
#[tauri::command]
pub async fn whichcraft_prepare_mise() -> Result<bool, EnvarlyError> {
    off_main(|| windows_app().prepare_mise()).await
}

#[tauri::command]
pub async fn whichcraft_profile_missing(profile: ToolProfile) -> Result<Vec<MissingPin>, EnvarlyError> {
    off_main(move || windows_app().profile_missing(&profile)).await
}

#[tauri::command]
pub async fn whichcraft_install_missing(profile: ToolProfile) -> Result<(), EnvarlyError> {
    off_main(move || windows_app().install_missing(&profile)).await
}

#[tauri::command]
pub fn whichcraft_profiles_using(installation: ToolInstallation) -> Result<Vec<String>, EnvarlyError> {
    windows_app().profiles_using(&installation)
}

#[tauri::command]
pub fn whichcraft_repoint_profiles(from: ToolInstallation, to: ToolInstallation) -> Result<Vec<String>, EnvarlyError> {
    windows_app().repoint_profiles(&from, &to)
}

#[tauri::command]
pub fn whichcraft_unfinished_uninstalls() -> Result<Vec<UninstallRecord>, EnvarlyError> {
    windows_app().unfinished_uninstalls()
}

#[tauri::command]
pub fn whichcraft_dismiss_unfinished_uninstall(id: String) -> Result<(), EnvarlyError> {
    windows_app().dismiss_unfinished_uninstall(&id)
}

#[tauri::command]
pub fn whichcraft_open_folder(path: String) -> Result<(), EnvarlyError> {
    windows_app().open_folder(&PathBuf::from(path))
}
