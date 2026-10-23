//! The environment a newly started process gets, and running processes with exactly that.

use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;

use crate::error::EnvarlyError;
use crate::whichcraft::services::terminal::{ProcessRunner, ProcessSpec};

const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// What Windows builds from the registry for this user (CreateEnvironmentBlock without
/// inheritance), i.e. what a process started from Explorer would get after an apply.
pub fn fresh_environment() -> Result<HashMap<String, String>, EnvarlyError> {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::TOKEN_QUERY;
    use windows_sys::Win32::System::Environment::{CreateEnvironmentBlock, DestroyEnvironmentBlock};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    let mut token: HANDLE = std::ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err(EnvarlyError::InvalidInput("OpenProcessToken failed".into()));
    }
    let mut block: *mut std::ffi::c_void = std::ptr::null_mut();
    let ok = unsafe { CreateEnvironmentBlock(&mut block, token, 0) };
    unsafe { CloseHandle(token) };
    if ok == 0 {
        return Err(EnvarlyError::InvalidInput("CreateEnvironmentBlock failed".into()));
    }
    let mut env = HashMap::new();
    let mut p = block as *const u16;
    unsafe {
        loop {
            let mut len = 0;
            while *p.add(len) != 0 {
                len += 1;
            }
            if len == 0 {
                break;
            }
            let entry = String::from_utf16_lossy(std::slice::from_raw_parts(p, len));
            // Skip the leading '=' of hidden per-drive entries such as "=C:=C:\".
            if let Some(eq) = entry[1..].find('=').map(|i| i + 1) {
                env.insert(entry[..eq].to_string(), entry[eq + 1..].to_string());
            }
            p = p.add(len + 1);
        }
        DestroyEnvironmentBlock(block);
    }
    Ok(env)
}

fn command(spec: &ProcessSpec) -> Command {
    let mut cmd = Command::new(&spec.program);
    cmd.args(&spec.args)
        .env_clear()
        .envs(&spec.env)
        .current_dir(&spec.cwd);
    cmd
}

pub struct WinProcessRunner;

impl ProcessRunner for WinProcessRunner {
    fn spawn(&self, spec: &ProcessSpec) -> Result<(), EnvarlyError> {
        command(spec)
            .creation_flags(CREATE_NEW_CONSOLE)
            .spawn()
            .map(|_| ())
            .map_err(|e| EnvarlyError::InvalidInput(format!("start {}: {e}", spec.program)))
    }

    fn output(&self, spec: &ProcessSpec) -> Result<String, EnvarlyError> {
        let out = command(spec)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| EnvarlyError::InvalidInput(format!("run {}: {e}", spec.program)))?;
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    }
}

#[cfg(test)]
mod tests {
    use crate::whichcraft::adapters::local::LocalMachine;
    use super::*;
    use crate::whichcraft::domain::ToolKind;
    use crate::whichcraft::domain::settings::TerminalKind;
    use crate::whichcraft::services::terminal::shell_check;

    /// Reads the registry and runs hidden shells (no writes). `cargo test contract_shell -- --ignored --nocapture`
    #[test]
    #[ignore = "contract: builds the real environment and runs PowerShell and cmd"]
    fn contract_shell_check_on_this_machine() {
        let env = fresh_environment().unwrap();
        assert!(env.keys().any(|k| k.eq_ignore_ascii_case("Path")));
        let home = std::env::var("USERPROFILE").unwrap();
        for shell in [TerminalKind::PowerShell, TerminalKind::Cmd] {
            let check = shell_check(
                &crate::env_backend::WinregBackend,
                &LocalMachine, &WinProcessRunner,
                shell,
                ToolKind::Node,
                env.clone(),
                std::path::Path::new(&home),
            )
            .unwrap();
            println!("{check:?}");
            assert!(check.matches, "{shell:?}: {check:?}");
        }
    }
}
