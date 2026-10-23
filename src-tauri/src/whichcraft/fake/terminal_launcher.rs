use std::collections::HashMap;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::terminal_launcher::{TerminalKind, TerminalLauncher};

pub struct FakeTerminalLauncher;

impl TerminalLauncher for FakeTerminalLauncher {
    fn launch(
        &self,
        _kind: TerminalKind,
        _working_dir: &str,
        _environment: &HashMap<String, String>,
    ) -> Result<(), EnvarlyError> {
        Ok(())
    }
}
