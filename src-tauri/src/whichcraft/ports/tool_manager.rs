use crate::error::WhichcraftError;
use crate::whichcraft::domain::versions::RemoteVersion;
use crate::whichcraft::domain::ToolKind;

pub trait ToolManager: Send + Sync {
    /// Installs `version` into the install store and returns the installation's root.
    fn install(&self, tool: ToolKind, version: &str)
        -> Result<std::path::PathBuf, WhichcraftError>;
    /// Removes one installed version; `version` may be spelled the way the installer stored it.
    fn uninstall(&self, tool: ToolKind, version: &str) -> Result<(), WhichcraftError>;
    /// The download for `version` in bytes, or `None` when it cannot be known before installing.
    fn download_size(&self, tool: ToolKind, version: &str) -> Result<Option<u64>, WhichcraftError>;
    fn list_remote(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, WhichcraftError>;
}

/// The installer for one install store; which store depends on the settings at the time.
pub trait ToolManagers: Send + Sync {
    fn for_store(&self, install_store: &std::path::Path) -> Box<dyn ToolManager>;
}
