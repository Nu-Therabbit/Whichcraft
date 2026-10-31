//! Checking whether an installation is in use, and removing it (tickets 14 and 15).

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};

use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::mise::manager::{MiseToolManager, ProcessMiseRunner};
use crate::whichcraft::ports::tool_manager::ToolManager;
use crate::whichcraft::ports::uninstaller::{RunOutcome, Uninstaller};
use crate::whichcraft::ports::usage_probe::{UsageProbe, UsageReport};

const ERROR_MORE_DATA: u32 = 234;
const ERROR_SUCCESS_REBOOT_INITIATED: i32 = 1641;
const ERROR_SUCCESS_REBOOT_REQUIRED: i32 = 3010;
const ERROR_INSTALL_USEREXIT: i32 = 1602;
/// Executables and libraries checked with Restart Manager; a JDK has a few hundred.
const MAX_FILES: usize = 2000;
/// Deep enough for Flutter's `bin\cache\dart-sdk\bin\dart.exe`.
const MAX_DEPTH: usize = 5;

fn wide(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(std::iter::once(0)).collect()
}

fn binaries(root: &Path) -> Vec<PathBuf> {
    fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            if out.len() >= MAX_FILES {
                return;
            }
            let path = entry.path();
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_dir() && !kind.is_symlink() && depth < MAX_DEPTH {
                walk(&path, depth + 1, out);
            } else if kind.is_file()
                && path
                    .extension()
                    .is_some_and(|e| e.eq_ignore_ascii_case("exe") || e.eq_ignore_ascii_case("dll"))
            {
                out.push(path);
            }
        }
    }
    let mut out = Vec::new();
    walk(root, 1, &mut out);
    out
}

/// Names of the processes that have any of the files open, from Restart Manager.
fn processes_using(files: &[PathBuf]) -> Result<Vec<String>, EnvarlyError> {
    use windows_sys::Win32::System::RestartManager::{
        RmEndSession, RmGetList, RmRegisterResources, RmStartSession, CCH_RM_SESSION_KEY,
        RM_PROCESS_INFO,
    };
    if files.is_empty() {
        return Ok(Vec::new());
    }
    let mut session = 0u32;
    let mut key = [0u16; CCH_RM_SESSION_KEY as usize + 1];
    if unsafe { RmStartSession(&mut session, 0, key.as_mut_ptr()) } != 0 {
        return Err(EnvarlyError::InvalidInput(
            "Restart Manager session failed".into(),
        ));
    }
    let names: Vec<Vec<u16>> = files.iter().map(|f| wide(f.as_os_str())).collect();
    let ptrs: Vec<*const u16> = names.iter().map(|n| n.as_ptr()).collect();
    let result = (|| {
        if unsafe {
            RmRegisterResources(
                session,
                ptrs.len() as u32,
                ptrs.as_ptr(),
                0,
                std::ptr::null(),
                0,
                std::ptr::null(),
            )
        } != 0
        {
            return Err(EnvarlyError::InvalidInput(
                "Restart Manager could not register the files".into(),
            ));
        }
        let mut needed = 0u32;
        let mut count = 0u32;
        let mut reasons = 0u32;
        let mut infos: Vec<RM_PROCESS_INFO> = Vec::new();
        loop {
            let rc = unsafe {
                RmGetList(
                    session,
                    &mut needed,
                    &mut count,
                    infos.as_mut_ptr(),
                    &mut reasons,
                )
            };
            match rc {
                0 => break,
                ERROR_MORE_DATA => {
                    infos = vec![unsafe { std::mem::zeroed() }; needed as usize];
                    count = needed;
                }
                _ => {
                    return Err(EnvarlyError::InvalidInput(format!(
                        "Restart Manager list failed ({rc})"
                    )))
                }
            }
        }
        let mut names: Vec<String> = infos[..count as usize]
            .iter()
            .map(|i| {
                let len = i
                    .strAppName
                    .iter()
                    .position(|c| *c == 0)
                    .unwrap_or(i.strAppName.len());
                format!(
                    "{} (PID {})",
                    String::from_utf16_lossy(&i.strAppName[..len]),
                    i.Process.dwProcessId
                )
            })
            .collect();
        names.sort();
        names.dedup();
        Ok(names)
    })();
    unsafe { RmEndSession(session) };
    result
}

fn under_protected_root(root: &Path) -> bool {
    [
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramW6432",
        "SystemRoot",
    ]
    .iter()
    .filter_map(std::env::var_os)
    .any(|p| root.starts_with(PathBuf::from(p)))
}

/// A terminal or Explorer window inside the folder holds no file open, but it does stop the
/// folder from being renamed. Only tried where the user may rename without UAC.
fn folder_locked(root: &Path) -> Result<bool, EnvarlyError> {
    if under_protected_root(root) {
        return Ok(false);
    }
    let Some(name) = root.file_name() else {
        return Ok(false);
    };
    let mut probe_name = name.to_os_string();
    probe_name.push(".whichcraft-probe");
    let probe = root.with_file_name(probe_name);
    if probe.exists() {
        return Ok(false);
    }
    if std::fs::rename(root, &probe).is_err() {
        return Ok(true);
    }
    for _ in 0..20 {
        if std::fs::rename(&probe, root).is_ok() {
            return Ok(false);
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    Err(EnvarlyError::InvalidInput(format!(
        "could not rename {} back to {}; rename it back by hand",
        probe.display(),
        root.display()
    )))
}

pub struct WinUsageProbe;

impl UsageProbe for WinUsageProbe {
    fn probe(&self, _tool: ToolKind, install_root: &Path) -> Result<UsageReport, EnvarlyError> {
        let processes = processes_using(&binaries(install_root))?;
        // Renaming while a process runs from the folder would fail anyway; skip the second probe.
        let folder_locked = processes.is_empty() && folder_locked(install_root)?;
        Ok(UsageReport {
            processes,
            folder_locked,
        })
    }
}

fn quote_args(args: &[String]) -> String {
    args.iter()
        .map(|a| {
            if a.contains(' ') && !a.starts_with('"') {
                format!("\"{a}\"")
            } else {
                a.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn outcome_for_exit(code: i32) -> RunOutcome {
    match code {
        0 | ERROR_SUCCESS_REBOOT_REQUIRED | ERROR_SUCCESS_REBOOT_INITIATED => RunOutcome::Finished,
        ERROR_INSTALL_USEREXIT => RunOutcome::Cancelled,
        other => RunOutcome::Failed(other),
    }
}

pub struct WinUninstaller;

impl Uninstaller for WinUninstaller {
    /// Started through the shell so an uninstaller whose manifest asks for administrator rights
    /// gets its UAC prompt, then waited on. Declining that prompt counts as cancelled.
    fn run_uninstaller(&self, program: &str, args: &[String]) -> Result<RunOutcome, EnvarlyError> {
        use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_CANCELLED};
        use windows_sys::Win32::System::Threading::{
            GetExitCodeProcess, WaitForSingleObject, INFINITE,
        };
        use windows_sys::Win32::UI::Shell::{
            ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let file = wide(OsStr::new(program));
        let params = wide(OsStr::new(&quote_args(args)));
        let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        info.fMask = SEE_MASK_NOCLOSEPROCESS;
        info.lpFile = file.as_ptr();
        info.lpParameters = params.as_ptr();
        info.nShow = SW_SHOWNORMAL;
        if unsafe { ShellExecuteExW(&mut info) } == 0 {
            if unsafe { GetLastError() } == ERROR_CANCELLED {
                return Ok(RunOutcome::Cancelled);
            }
            return Err(EnvarlyError::InvalidInput(format!(
                "could not start {program}"
            )));
        }
        let mut code = 1u32;
        unsafe {
            WaitForSingleObject(info.hProcess, INFINITE);
            GetExitCodeProcess(info.hProcess, &mut code);
            CloseHandle(info.hProcess);
        }
        Ok(outcome_for_exit(code as i32))
    }

    fn recycle_folder(&self, folder: &Path) -> Result<(), EnvarlyError> {
        use windows_sys::Win32::UI::Shell::{
            SHFileOperationW, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI, FOF_SILENT,
            FO_DELETE, SHFILEOPSTRUCTW,
        };
        // SHFileOperation takes a list ended by an extra NUL.
        let mut from = wide(folder.as_os_str());
        from.push(0);
        let mut op: SHFILEOPSTRUCTW = unsafe { std::mem::zeroed() };
        op.wFunc = FO_DELETE;
        op.pFrom = from.as_ptr();
        op.fFlags = (FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT) as u16;
        let rc = unsafe { SHFileOperationW(&mut op) };
        if rc != 0 || op.fAnyOperationsAborted != 0 {
            return Err(EnvarlyError::InvalidInput(format!(
                "could not move {} to the Recycle Bin ({rc:#x})",
                folder.display()
            )));
        }
        Ok(())
    }

    fn uninstall_managed(
        &self,
        store: &Path,
        tool: ToolKind,
        mise_version: &str,
    ) -> Result<(), EnvarlyError> {
        let manager = MiseToolManager::with_runner(ProcessMiseRunner::for_maintenance(store));
        ToolManager::uninstall(&manager, tool, mise_version)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn msi_exit_codes_map_to_outcomes() {
        assert_eq!(outcome_for_exit(0), RunOutcome::Finished);
        assert_eq!(outcome_for_exit(3010), RunOutcome::Finished);
        assert_eq!(outcome_for_exit(1602), RunOutcome::Cancelled);
        assert_eq!(outcome_for_exit(1603), RunOutcome::Failed(1603));
    }

    #[test]
    fn arguments_with_spaces_are_quoted_again() {
        assert_eq!(quote_args(&["/x".into(), "{ABC}".into()]), "/x {ABC}");
        assert_eq!(
            quote_args(&["--dir".into(), "C:\\a b".into()]),
            "--dir \"C:\\a b\""
        );
    }

    #[test]
    fn a_running_program_is_reported_and_a_free_folder_is_not() {
        let dir = tempfile::tempdir().unwrap();
        let bin = dir.path().join("bin");
        std::fs::create_dir_all(&bin).unwrap();
        let exe = bin.join("probe-target.exe");
        std::fs::copy(
            std::env::var_os("ComSpec").map(PathBuf::from).unwrap(),
            &exe,
        )
        .unwrap();
        assert_eq!(
            WinUsageProbe.probe(ToolKind::Node, dir.path()).unwrap(),
            UsageReport::default()
        );

        let mut child = std::process::Command::new(&exe)
            .args(["/c", "ping", "-n", "30", "127.0.0.1"])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(300));
        let report = WinUsageProbe.probe(ToolKind::Node, dir.path()).unwrap();
        child.kill().unwrap();
        let _ = child.wait();
        assert!(report.in_use(), "{report:?}");
        assert!(
            report
                .processes
                .iter()
                .any(|p| p.contains(&child.id().to_string())),
            "{report:?}"
        );
    }

    /// Moves a throwaway folder into the real Recycle Bin. `cargo test contract_recycle -- --ignored`
    #[test]
    #[ignore = "contract: puts a test folder in this user's Recycle Bin"]
    fn contract_recycle_moves_a_folder_to_the_recycle_bin() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("whichcraft-recycle-contract");
        std::fs::create_dir_all(root.join("bin")).unwrap();
        std::fs::write(root.join("bin").join("tool.exe"), b"").unwrap();
        WinUninstaller.recycle_folder(&root).unwrap();
        assert!(!root.exists());
    }

    #[test]
    fn a_process_working_inside_the_folder_locks_it() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("tool");
        std::fs::create_dir_all(&root).unwrap();
        // `ping` itself rather than `cmd /c ping`, so killing it leaves no child inside the folder.
        let mut child = std::process::Command::new("ping")
            .args(["-n", "30", "127.0.0.1"])
            .current_dir(&root)
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(300));
        let locked = folder_locked(&root).unwrap();
        child.kill().unwrap();
        let _ = child.wait();
        assert!(locked);
        assert!(root.exists());
        assert!(!folder_locked(&root).unwrap());
        assert!(root.exists());
    }
}
