use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;

/// Who is using an installation (spike 7).
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageReport {
    /// Processes holding the installation's files, by name (Restart Manager).
    pub processes: Vec<String>,
    /// The folder itself cannot be renamed, e.g. a terminal has it as its working directory,
    /// which Restart Manager does not see.
    pub folder_locked: bool,
}

impl UsageReport {
    pub fn in_use(&self) -> bool {
        !self.processes.is_empty() || self.folder_locked
    }
}

pub trait UsageProbe: Send + Sync {
    fn probe(&self, tool: ToolKind, install_root: &Path) -> Result<UsageReport, EnvarlyError>;
}
