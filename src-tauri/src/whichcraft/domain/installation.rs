//! A tool installation, how it was installed, and how it stands on this machine.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::tool::ToolKind;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInstallation {
    pub tool: ToolKind,
    pub vendor: String,
    pub version: String,
    pub root: PathBuf,
    pub managed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallerKind {
    Msi,
    InnoSetup,
    PythonInstallManager,
    ManagedByOtherTool,
    FolderOnly,
    ManagedByWhichcraft,
}

/// An installation as the tools panel shows it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInstallationView {
    #[serde(flatten)]
    pub installation: ToolInstallation,
    pub effective: bool,
    pub selected: bool,
    pub available: bool,
    pub installer_kind: InstallerKind,
    pub mismatch_reason: Option<String>,
}
