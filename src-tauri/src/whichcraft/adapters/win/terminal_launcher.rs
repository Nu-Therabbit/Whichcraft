use std::collections::HashMap;
use std::process::Command;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::terminal_launcher::{TerminalKind, TerminalLauncher};

pub struct WinTerminalLauncher;

impl TerminalLauncher for WinTerminalLauncher {
    fn launch(
        &self,
        kind: TerminalKind,
        working_dir: &str,
        environment: &HashMap<String, String>,
    ) -> Result<(), EnvarlyError> {
        match kind {
            TerminalKind::WindowsTerminal => {
                let mut cmd = Command::new("wt.exe");
                cmd.arg("new-tab");
                cmd.arg("--startingDirectory").arg(working_dir);
                let inner = "powershell -NoExit";
                cmd.arg(escape_wt_command(inner));
                for (k, v) in environment {
                    cmd.env(k, v);
                }
                cmd.spawn()
                    .map_err(|e| EnvarlyError::InvalidInput(format!("wt launch: {e}")))?;
            }
            TerminalKind::PowerShell => {
                let mut cmd = Command::new("powershell.exe");
                cmd.args(["-NoExit"]).current_dir(working_dir);
                for (k, v) in environment {
                    cmd.env(k, v);
                }
                cmd.spawn()
                    .map_err(|e| EnvarlyError::InvalidInput(format!("powershell launch: {e}")))?;
            }
            TerminalKind::Cmd => {
                let mut cmd = Command::new("cmd.exe");
                cmd.arg("/K").current_dir(working_dir);
                for (k, v) in environment {
                    cmd.env(k, v);
                }
                cmd.spawn()
                    .map_err(|e| EnvarlyError::InvalidInput(format!("cmd launch: {e}")))?;
            }
        }
        Ok(())
    }
}

fn escape_wt_command(command: &str) -> String {
    command.replace(';', "\\;")
}
