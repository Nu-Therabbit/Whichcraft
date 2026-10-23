use std::path::PathBuf;

use crate::env_backend::WinregBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::java::JavaInstallation;
use crate::whichcraft::persistence::load_java_selection;
use crate::whichcraft::services::java_apply::{
    apply_java_plan, create_java_plan, incomplete_apply_journal, ApplyJavaResult,
};
use crate::whichcraft::services::java_inventory::{list_java_installations, JavaInstallationView};
use crate::whichcraft::services::java_plan::JavaApplyPlan;
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
pub fn whichcraft_apply_java_plan(plan: JavaApplyPlan) -> Result<ApplyJavaResult, EnvarlyError> {
    apply_java_plan(&WinregBackend, &plan)
}

#[tauri::command]
pub fn whichcraft_undo_last_apply() -> Result<UndoResult, EnvarlyError> {
    undo_last_apply(&WinregBackend)
}

#[tauri::command]
pub fn whichcraft_incomplete_journal() -> Result<Option<crate::whichcraft::persistence::WhichcraftJournal>, EnvarlyError> {
    incomplete_apply_journal()
}

#[tauri::command]
pub fn whichcraft_get_java_selection() -> Result<Option<crate::whichcraft::persistence::JavaSelection>, EnvarlyError> {
    load_java_selection()
}
