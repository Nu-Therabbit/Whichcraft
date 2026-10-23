use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::whichcraft_data_dir;
use crate::error::EnvarlyError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WhichcraftSettings {
    #[serde(default = "default_install_store")]
    pub install_store: PathBuf,
    #[serde(default)]
    pub scan_roots: Vec<PathBuf>,
    #[serde(default = "default_terminal")]
    pub terminal: TerminalKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TerminalKind {
    #[default]
    WindowsTerminal,
    PowerShell,
    Cmd,
}

fn default_terminal() -> TerminalKind {
    TerminalKind::WindowsTerminal
}

fn default_install_store() -> PathBuf {
    dirs_next::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Whichcraft")
        .join("installs")
}

impl Default for WhichcraftSettings {
    fn default() -> Self {
        Self {
            install_store: default_install_store(),
            scan_roots: Vec::new(),
            terminal: TerminalKind::WindowsTerminal,
        }
    }
}

fn settings_path() -> Result<PathBuf, EnvarlyError> {
    Ok(whichcraft_data_dir()?.join("settings.json"))
}

pub fn load_settings() -> Result<WhichcraftSettings, EnvarlyError> {
    let path = settings_path()?;
    if !path.is_file() {
        return Ok(WhichcraftSettings::default());
    }
    let text = std::fs::read_to_string(&path)
        .map_err(|e| EnvarlyError::Snapshot(format!("read settings: {e}")))?;
    serde_json::from_str(&text)
        .map_err(|e| EnvarlyError::Snapshot(format!("parse settings: {e}")))
}

pub fn save_settings(settings: &WhichcraftSettings) -> Result<(), EnvarlyError> {
    let path = settings_path()?;
    let text = serde_json::to_string_pretty(settings)
        .map_err(|e| EnvarlyError::Snapshot(format!("serialize settings: {e}")))?;
    std::fs::write(&path, text)
        .map_err(|e| EnvarlyError::Snapshot(format!("write settings: {e}")))
}
