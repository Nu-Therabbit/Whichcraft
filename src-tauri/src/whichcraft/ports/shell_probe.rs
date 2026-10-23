use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellResolution {
    pub tool: ToolKind,
    pub executable_path: Option<String>,
}

pub trait ShellProbe: Send + Sync {
    fn probe(&self, tool: ToolKind) -> Result<ShellResolution, EnvarlyError>;
}
