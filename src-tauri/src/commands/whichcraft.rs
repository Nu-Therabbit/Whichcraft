use std::path::PathBuf;

use crate::env_backend::WinregBackend;
use crate::whichcraft::services::java_inventory::{list_java_installations, JavaInstallationView};
use crate::whichcraft::{CoreHealth, WhichcraftCore};

#[tauri::command]
pub fn whichcraft_health() -> CoreHealth {
    WhichcraftCore::with_fakes().health()
}

#[tauri::command]
pub fn whichcraft_list_java(selected_root: Option<String>) -> Result<Vec<JavaInstallationView>, String> {
    let backend = WinregBackend;
    let selected = selected_root.map(PathBuf::from);
    list_java_installations(&backend, selected.as_deref()).map_err(|e| e.to_string())
}
