use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::shell_probe::{ShellProbe, ShellResolution};

pub struct FakeShellProbe;

impl ShellProbe for FakeShellProbe {
    fn probe(&self, tool: ToolKind) -> Result<ShellResolution, EnvarlyError> {
        Ok(ShellResolution {
            tool,
            executable_path: None,
        })
    }
}
