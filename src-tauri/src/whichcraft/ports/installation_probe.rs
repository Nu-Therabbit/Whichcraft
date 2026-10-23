use std::path::PathBuf;

use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolInstallation {
    pub tool: ToolKind,
    pub vendor: String,
    pub version: String,
    pub root: PathBuf,
    pub managed: bool,
}

pub trait InstallationProbe: Send + Sync {
    fn probe_root(&self, tool: ToolKind, root: &std::path::Path)
        -> Result<Option<ToolInstallation>, EnvarlyError>;
}
