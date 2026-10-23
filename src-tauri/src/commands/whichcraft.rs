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
use crate::whichcraft::services::java_apply::{
    apply_java_plan, create_java_plan, incomplete_apply_journal, ApplyJavaResult,
};
use crate::whichcraft::services::java_inventory::{list_java_installations, JavaInstallationView};
use crate::whichcraft::services::java_plan::JavaApplyPlan;
use crate::whichcraft::services::path_cleanup::{build_path_cleanup_plan, PathCleanupPlan};
use crate::whichcraft::services::profiles::{
    apply_profile, load_profiles, profile_status, save_profiles as persist_profiles, plan_profile_apply,
    ProfileMatchStatus, ToolProfile,
};
use crate::whichcraft::services::supplemental_inventory::{
    android_read_only, msvc_read_only, python_supplemental, PythonSupplementalView,
    ReadOnlyInventorySection,
};
use crate::whichcraft::services::tool_apply::{
    apply_tool_plan, apply_tool_plan_elevated, create_tool_plan, ApplyToolResult,
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
    let selected = load_tool_selection(tool)?.map(|s| s.root);
    list_tool_installations(&backend, tool, selected.as_deref())
}

#[tauri::command]
pub fn whichcraft_get_settings() -> Result<WhichcraftSettings, EnvarlyError> {
    load_settings()
}

#[tauri::command]
pub fn whichcraft_save_settings(settings: WhichcraftSettings) -> Result<(), EnvarlyError> {
    save_settings(&settings)
}

#[tauri::command]
pub fn whichcraft_plan_java(root: String) -> Result<JavaApplyPlan, EnvarlyError> {
    let backend = WinregBackend;
    let views = list_java_installations(&backend, None)?;
    let installation = views
        .into_iter()
        .find(|v| v.installation.root == PathBuf::from(&root))
        .map(|v| v.installation)
        .ok_or_else(|| EnvarlyError::InvalidInput(format!("unknown java root: {root}")))?;
    create_java_plan(&backend, &installation)
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
pub fn whichcraft_apply_java_plan(plan: JavaApplyPlan) -> Result<ApplyJavaResult, EnvarlyError> {
    apply_java_plan(&WinregBackend, &plan)
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

#[tauri::command]
pub fn whichcraft_incomplete_journal(
) -> Result<Option<crate::whichcraft::persistence::WhichcraftJournal>, EnvarlyError> {
    incomplete_apply_journal()
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
pub fn whichcraft_android_inventory() -> ReadOnlyInventorySection {
    android_read_only()
}

#[tauri::command]
pub fn whichcraft_msvc_inventory() -> ReadOnlyInventorySection {
    msvc_read_only()
}
