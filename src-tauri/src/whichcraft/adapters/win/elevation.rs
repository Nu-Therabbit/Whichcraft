//! The `Elevator` port through UAC: a copy of this exe runs elevated with the request file and
//! its hash, and its exit code says what happened.

use crate::error::WhichcraftError;
use crate::whichcraft::application::elevation::{
    encode_request, run_elevated_request, EXIT_APPLIED, EXIT_FAILED, EXIT_STALE,
};
use crate::whichcraft::ports::elevator::{ElevatedOutcome, ElevatedRequest, Elevator};

/// Entry point of `whichcraft-elevated-apply <payload> <sha256>`; returns the process exit code.
pub fn elevated_helper_main(payload: &std::path::Path, sha256: &str) -> i32 {
    let bytes = match std::fs::read(payload) {
        Ok(b) => b,
        Err(_) => return EXIT_FAILED,
    };
    match run_elevated_request(&crate::env_backend::WinregBackend, &bytes, sha256) {
        ElevatedOutcome::Applied => EXIT_APPLIED,
        ElevatedOutcome::Stale => EXIT_STALE,
        ElevatedOutcome::Cancelled | ElevatedOutcome::Failed(_) => EXIT_FAILED,
    }
}

/// Launches this exe elevated through UAC and waits for it to finish.
pub struct WinElevator;

impl Elevator for WinElevator {
    fn apply_system(&self, request: &ElevatedRequest) -> Result<ElevatedOutcome, WhichcraftError> {
        let exe = std::env::current_exe()
            .map_err(|e| WhichcraftError::InvalidInput(format!("current_exe: {e}")))?;
        elevate_with(&exe, request)
    }
}

/// Like `WinElevator`, but runs a given Whichcraft exe as the helper. Contract tests use it,
/// since the test binary itself has no `whichcraft-elevated-apply` command.
#[cfg(test)]
pub struct HelperExeElevator(pub std::path::PathBuf);

#[cfg(test)]
impl Elevator for HelperExeElevator {
    fn apply_system(&self, request: &ElevatedRequest) -> Result<ElevatedOutcome, WhichcraftError> {
        elevate_with(&self.0, request)
    }
}

fn elevate_with(
    exe: &std::path::Path,
    request: &ElevatedRequest,
) -> Result<ElevatedOutcome, WhichcraftError> {
    let (bytes, hash) = encode_request(request)?;
    let path = crate::whichcraft::persistence::whichcraft_data_dir()?
        .join(format!("elevation-{}.json", &hash[..16]));
    std::fs::write(&path, &bytes)
        .map_err(|e| WhichcraftError::Snapshot(format!("write elevation request: {e}")))?;
    let outcome = run_elevated_and_wait(exe, &path, &hash);
    let _ = std::fs::remove_file(&path);
    outcome
}

#[cfg(windows)]
fn run_elevated_and_wait(
    exe: &std::path::Path,
    payload: &std::path::Path,
    hash: &str,
) -> Result<ElevatedOutcome, WhichcraftError> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_CANCELLED};
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, WaitForSingleObject, INFINITE,
    };
    use windows_sys::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

    fn wide(s: &OsStr) -> Vec<u16> {
        s.encode_wide().chain(std::iter::once(0)).collect()
    }

    let verb = wide(OsStr::new("runas"));
    let file = wide(exe.as_os_str());
    let params = wide(OsStr::new(&format!(
        "whichcraft-elevated-apply \"{}\" {hash}",
        payload.display()
    )));

    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.lpVerb = verb.as_ptr();
    info.lpFile = file.as_ptr();
    info.lpParameters = params.as_ptr();
    info.nShow = SW_HIDE;

    if unsafe { ShellExecuteExW(&mut info) } == 0 {
        if unsafe { GetLastError() } == ERROR_CANCELLED {
            return Ok(ElevatedOutcome::Cancelled);
        }
        return Err(WhichcraftError::InvalidInput(
            "could not start the elevated helper".into(),
        ));
    }
    let mut code: u32 = EXIT_FAILED as u32;
    unsafe {
        WaitForSingleObject(info.hProcess, INFINITE);
        GetExitCodeProcess(info.hProcess, &mut code);
        CloseHandle(info.hProcess);
    }
    Ok(match code as i32 {
        EXIT_APPLIED => ElevatedOutcome::Applied,
        EXIT_STALE => ElevatedOutcome::Stale,
        other => ElevatedOutcome::Failed(format!("elevated helper exited with code {other}")),
    })
}

#[cfg(not(windows))]
fn run_elevated_and_wait(
    _exe: &std::path::Path,
    _payload: &std::path::Path,
    _hash: &str,
) -> Result<ElevatedOutcome, WhichcraftError> {
    Err(WhichcraftError::InvalidInput(
        "elevation is only supported on Windows".into(),
    ))
}
