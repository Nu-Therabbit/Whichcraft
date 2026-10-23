use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::tool_manager::{RemoteVersion, ToolManager};

pub struct FakeToolManager;

impl ToolManager for FakeToolManager {
    fn list_installed(&self, _tool: ToolKind) -> Result<Vec<String>, EnvarlyError> {
        Ok(Vec::new())
    }

    fn list_remote(&self, _tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError> {
        Ok(Vec::new())
    }
}
