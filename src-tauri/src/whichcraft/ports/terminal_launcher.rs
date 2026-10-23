use std::collections::HashMap;

use crate::error::EnvarlyError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TerminalKind {
    WindowsTerminal,
    PowerShell,
    Cmd,
}

pub trait TerminalLauncher: Send + Sync {
    fn launch(
        &self,
        kind: TerminalKind,
        working_dir: &str,
        environment: &HashMap<String, String>,
    ) -> Result<(), EnvarlyError>;
}
