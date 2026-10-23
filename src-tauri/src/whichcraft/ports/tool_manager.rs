use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::domain::versions::RemoteVersion;

pub trait ToolManager: Send + Sync {
    fn list_remote(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError>;
}
