//! Opening a terminal with the registry's environment, and checking what a shell resolves after
//! its profile runs (ticket 09, spike 2).
//!
//! The app's own environment goes stale after an apply, and Windows Terminal keeps using the
//! launching process's environment even when it is already running. So every launch passes a
//! freshly built environment and clears the inherited one.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::whichcraft::ports::machine::Machine;
use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::path_manage;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::domain::settings::TerminalKind;
use crate::whichcraft::domain::env::get_var;
use crate::whichcraft::tools::command_name;

/// A process to start: program, arguments, the complete environment it gets, and its folder.
#[derive(Debug, Clone, PartialEq)]
pub struct ProcessSpec {
    pub program: String,
    pub args: Vec<String>,
    /// The whole environment; nothing is inherited from this app.
    pub env: HashMap<String, String>,
    pub cwd: PathBuf,
}

pub trait ProcessRunner {
    /// Starts a visible process and returns without waiting.
    fn spawn(&self, spec: &ProcessSpec) -> Result<(), EnvarlyError>;
    /// Runs a hidden process to completion and returns its stdout.
    fn output(&self, spec: &ProcessSpec) -> Result<String, EnvarlyError>;
}

/// `wt.exe` treats `;` as a command separator, so it must be escaped in anything passed to it (T-3).
pub fn escape_wt(arg: &str) -> String {
    arg.replace(';', "\\;")
}

pub fn terminal_spec(kind: TerminalKind, dir: &Path, env: HashMap<String, String>) -> ProcessSpec {
    let (program, args): (&str, Vec<String>) = match kind {
        // A new window with the user's default profile, started in `dir`.
        TerminalKind::WindowsTerminal => (
            "wt.exe",
            vec![
                "-w".into(),
                "new".into(),
                "new-tab".into(),
                "--startingDirectory".into(),
                escape_wt(&dir.to_string_lossy()),
            ],
        ),
        TerminalKind::PowerShell => ("powershell.exe", vec!["-NoExit".into()]),
        TerminalKind::Cmd => ("cmd.exe", vec!["/K".into()]),
    };
    ProcessSpec {
        program: program.into(),
        args,
        env,
        cwd: dir.to_path_buf(),
    }
}

/// Opens the configured terminal with `env`, the environment a new process gets from the registry.
pub fn open_terminal(
    runner: &dyn ProcessRunner,
    kind: TerminalKind,
    dir: &Path,
    env: HashMap<String, String>,
) -> Result<(), EnvarlyError> {
    runner.spawn(&terminal_spec(kind, dir, env))
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShellCheck {
    pub tool: ToolKind,
    pub shell: TerminalKind,
    /// What the registry environment resolves (the Effective Installation's executable).
    pub effective_path: Option<String>,
    /// What the shell resolves after loading its profile (Shell Resolution).
    pub shell_path: Option<String>,
    pub matches: bool,
}

/// The executable a new process would run for `tool`: System PATH first, then User.
pub fn effective_executable<B: EnvBackend>(backend: &B, machine: &dyn Machine, tool: ToolKind) -> Result<Option<String>, EnvarlyError> {
    let user = backend.read_user()?;
    let system = backend.read_system()?;
    let path = |m: &HashMap<String, crate::model::EnvValue>, n: &str| get_var(m, n).map(|v| v.value.clone()).unwrap_or_default();
    let pathext = get_var(&user, "PATHEXT").or_else(|| get_var(&system, "PATHEXT")).map(|v| v.value.clone());
    let expand = crate::whichcraft::services::registry_expander(&user, &system, machine);
    let result = path_manage::check_command_with(
        command_name(tool),
        &path(&user, "Path"),
        &path(&system, "Path"),
        pathext.as_deref().unwrap_or(".COM;.EXE;.BAT;.CMD"),
        &expand,
        |p: &str| machine.dir_exists(p),
    );
    Ok(result.hits.first().map(|h| {
        let dir = PathBuf::from(expand(&h.directory));
        // The hit spells the extension from PATHEXT ("node.EXE"); show the file's real name.
        let name = machine
            .entries(&dir)
            .into_iter()
            .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()))
            .find(|n| n.eq_ignore_ascii_case(&h.matched_file))
            .unwrap_or_else(|| h.matched_file.clone());
        dir.join(name).to_string_lossy().into_owned()
    }))
}

/// The hidden command that asks a shell, with its profile loaded, what `command` runs.
/// Windows Terminal is checked with its default shell, Windows PowerShell.
pub fn shell_probe_spec(kind: TerminalKind, command: &str, env: HashMap<String, String>, dir: &Path) -> ProcessSpec {
    let (program, args): (&str, Vec<String>) = match kind {
        TerminalKind::Cmd => ("cmd.exe", vec!["/c".into(), "where".into(), command.into()]),
        // No -NoProfile: the point is to see what the profile does to PATH.
        TerminalKind::PowerShell | TerminalKind::WindowsTerminal => (
            "powershell.exe",
            vec![
                "-NoLogo".into(),
                "-NonInteractive".into(),
                "-Command".into(),
                format!(
                    "(Get-Command {command} -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source"
                ),
            ],
        ),
    };
    ProcessSpec {
        program: program.into(),
        args,
        env,
        cwd: dir.to_path_buf(),
    }
}

fn same_file(a: &str, b: &str) -> bool {
    let norm = |s: &str| s.trim().trim_end_matches(['\\', '/']).to_ascii_lowercase();
    norm(a) == norm(b)
}

pub fn shell_check<B: EnvBackend>(
    backend: &B,
    machine: &dyn Machine,
    runner: &dyn ProcessRunner,
    kind: TerminalKind,
    tool: ToolKind,
    env: HashMap<String, String>,
    dir: &Path,
) -> Result<ShellCheck, EnvarlyError> {
    let effective_path = effective_executable(backend, machine, tool)?;
    let stdout = runner.output(&shell_probe_spec(kind, command_name(tool), env, dir))?;
    let shell_path = stdout
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .map(str::to_string);
    let matches = match (&effective_path, &shell_path) {
        (Some(a), Some(b)) => same_file(a, b),
        (None, None) => true,
        _ => false,
    };
    Ok(ShellCheck {
        tool,
        shell: kind,
        effective_path,
        shell_path,
        matches,
    })
}

#[cfg(test)]
mod tests {
    use crate::whichcraft::adapters::local::LocalMachine;
    use super::*;
    use crate::env_store::MemBackend;
    use std::sync::Mutex;

    #[derive(Default)]
    struct FakeRunner {
        spawned: Mutex<Vec<ProcessSpec>>,
        ran: Mutex<Vec<ProcessSpec>>,
        stdout: String,
    }

    impl ProcessRunner for FakeRunner {
        fn spawn(&self, spec: &ProcessSpec) -> Result<(), EnvarlyError> {
            self.spawned.lock().unwrap().push(spec.clone());
            Ok(())
        }
        fn output(&self, spec: &ProcessSpec) -> Result<String, EnvarlyError> {
            self.ran.lock().unwrap().push(spec.clone());
            Ok(self.stdout.clone())
        }
    }

    fn fresh_env() -> HashMap<String, String> {
        HashMap::from([("Path".to_string(), "C:\\node22;C:\\Windows".to_string())])
    }

    #[test]
    fn the_terminal_gets_exactly_the_fresh_environment() {
        let runner = FakeRunner::default();
        open_terminal(&runner, TerminalKind::PowerShell, Path::new("C:\\Users\\me"), fresh_env()).unwrap();
        let spawned = runner.spawned.lock().unwrap();
        assert_eq!(spawned[0].program, "powershell.exe");
        assert_eq!(spawned[0].env, fresh_env());
    }

    #[test]
    fn windows_terminal_opens_a_new_window_and_escapes_semicolons() {
        let spec = terminal_spec(TerminalKind::WindowsTerminal, Path::new("C:\\a;b"), fresh_env());
        assert_eq!(spec.program, "wt.exe");
        assert_eq!(spec.args, vec!["-w", "new", "new-tab", "--startingDirectory", "C:\\a\\;b"]);
        assert_eq!(terminal_spec(TerminalKind::Cmd, Path::new("C:\\"), fresh_env()).args, vec!["/K"]);
    }

    fn node_on_disk() -> (tempfile::TempDir, String, &'static str) {
        let dir = tempfile::tempdir().unwrap();
        let bin = dir.path().join("node24");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join("node.exe"), b"").unwrap();
        let exe = bin.join("node.exe").to_string_lossy().into_owned();
        let path: &'static str = Box::leak(bin.to_string_lossy().into_owned().into_boxed_str());
        (dir, exe, path)
    }

    #[test]
    fn shell_check_reports_a_profile_that_puts_another_node_first() {
        let (_dir, exe, path) = node_on_disk();
        let backend = MemBackend::new().with_system([("Path", path), ("PATHEXT", ".EXE")]);
        let runner = FakeRunner { stdout: "C:\\profile\\node22\\node.exe\r\n".into(), ..Default::default() };
        let check = shell_check(&backend, &LocalMachine, &runner, TerminalKind::PowerShell, ToolKind::Node, fresh_env(), Path::new("C:\\")).unwrap();
        assert_eq!(check.effective_path.as_deref(), Some(exe.as_str()));
        assert_eq!(check.shell_path.as_deref(), Some("C:\\profile\\node22\\node.exe"));
        assert!(!check.matches);
        // The probe loads the profile and runs with the fresh environment.
        let ran = runner.ran.lock().unwrap();
        assert!(!ran[0].args.iter().any(|a| a.eq_ignore_ascii_case("-NoProfile")));
        assert_eq!(ran[0].env, fresh_env());
    }

    #[test]
    fn shell_check_matches_when_the_shell_agrees() {
        let (_dir, exe, path) = node_on_disk();
        let backend = MemBackend::new().with_system([("Path", path), ("PATHEXT", ".EXE")]);
        let runner = FakeRunner { stdout: format!("{}\n", exe.to_uppercase()), ..Default::default() };
        let check = shell_check(&backend, &LocalMachine, &runner, TerminalKind::Cmd, ToolKind::Node, fresh_env(), Path::new("C:\\")).unwrap();
        assert!(check.matches);
        assert_eq!(runner.ran.lock().unwrap()[0].args, vec!["/c", "where", "node"]);
    }
}
