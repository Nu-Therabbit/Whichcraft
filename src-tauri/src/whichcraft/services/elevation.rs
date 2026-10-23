use std::path::PathBuf;

use crate::error::EnvarlyError;
use crate::model::EnvChange;

pub fn write_elevation_request(changes: &[EnvChange]) -> Result<PathBuf, EnvarlyError> {
    let dir = crate::whichcraft::persistence::whichcraft_data_dir()?;
    let path = dir.join("pending_elevated_apply.json");
    std::fs::write(
        &path,
        serde_json::to_string_pretty(changes)
            .map_err(|e| EnvarlyError::Snapshot(format!("serialize elevation payload: {e}")))?,
    )
    .map_err(|e| EnvarlyError::Snapshot(format!("write elevation payload: {e}")))?;
    Ok(path)
}

#[cfg(windows)]
pub fn spawn_elevated_helper(payload: &PathBuf) -> Result<(), EnvarlyError> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let exe = std::env::current_exe()
        .map_err(|e| EnvarlyError::InvalidInput(format!("current_exe: {e}")))?;
    let args = format!(
        "whichcraft-elevated-apply \"{}\"",
        payload.to_string_lossy()
    );
    let op: Vec<u16> = OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let file: Vec<u16> = exe
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let params: Vec<u16> = OsStr::new(&args)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let rc = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            op.as_ptr(),
            file.as_ptr(),
            params.as_ptr(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if (rc as isize) <= 32 {
        return Err(EnvarlyError::InvalidInput(
            "UAC elevation was cancelled or failed".into(),
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn spawn_elevated_helper(_payload: &PathBuf) -> Result<(), EnvarlyError> {
    Err(EnvarlyError::InvalidInput(
        "elevation is only supported on Windows".into(),
    ))
}

pub fn apply_elevated_payload(path: &PathBuf) -> Result<(), EnvarlyError> {
    let raw = std::fs::read_to_string(path)
        .map_err(|e| EnvarlyError::Snapshot(format!("read elevation payload: {e}")))?;
    let changes: Vec<EnvChange> = serde_json::from_str(&raw)
        .map_err(|e| EnvarlyError::Snapshot(format!("parse elevation payload: {e}")))?;
    let backend = crate::env_backend::WinregBackend;
    crate::env_store::apply_changes_with(&backend, &changes, |_, _, _, _| {})?;
    let _ = std::fs::remove_file(path);
    Ok(())
}
