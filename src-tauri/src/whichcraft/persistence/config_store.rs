use std::path::PathBuf;

use super::whichcraft_data_dir;
use crate::error::WhichcraftError;
use crate::whichcraft::domain::settings::WhichcraftSettings;

/// Where installs go until the user picks a folder: `%LOCALAPPDATA%\Whichcraft\installs`.
pub fn default_install_store() -> PathBuf {
    dirs_next::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Whichcraft")
        .join("installs")
}

fn settings_path() -> Result<PathBuf, WhichcraftError> {
    Ok(whichcraft_data_dir()?.join("settings.json"))
}

pub fn load_settings() -> Result<WhichcraftSettings, WhichcraftError> {
    let path = settings_path()?;
    let mut settings = if path.is_file() {
        let text = std::fs::read_to_string(&path)
            .map_err(|e| WhichcraftError::Snapshot(format!("read settings: {e}")))?;
        serde_json::from_str(&text)
            .map_err(|e| WhichcraftError::Snapshot(format!("parse settings: {e}")))?
    } else {
        WhichcraftSettings::default()
    };
    if settings.install_store.as_os_str().is_empty() {
        settings.install_store = default_install_store();
    }
    Ok(settings)
}

pub fn save_settings(settings: &WhichcraftSettings) -> Result<(), WhichcraftError> {
    let path = settings_path()?;
    let text = serde_json::to_string_pretty(settings)
        .map_err(|e| WhichcraftError::Snapshot(format!("serialize settings: {e}")))?;
    std::fs::write(&path, text)
        .map_err(|e| WhichcraftError::Snapshot(format!("write settings: {e}")))
}
