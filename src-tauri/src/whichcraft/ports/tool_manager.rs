use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::domain::versions::RemoteVersion;

pub trait ToolManager: Send + Sync {
    /// Installs `version` into the install store and returns the installation's root.
    fn install(&self, tool: ToolKind, version: &str) -> Result<std::path::PathBuf, EnvarlyError>;
    /// Removes one installed version; `version` may be spelled the way the installer stored it.
    fn uninstall(&self, tool: ToolKind, version: &str) -> Result<(), EnvarlyError>;
    fn list_remote(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError>;
}
