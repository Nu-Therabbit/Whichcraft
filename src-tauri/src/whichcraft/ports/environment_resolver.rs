use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedTool {
    pub tool: ToolKind,
    pub executable_path: Option<String>,
}

pub trait EnvironmentResolver: Send + Sync {
    fn resolve_effective(&self, tool: ToolKind) -> Result<ResolvedTool, EnvarlyError>;
}
