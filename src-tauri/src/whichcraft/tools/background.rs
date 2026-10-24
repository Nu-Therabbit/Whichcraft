//! Starting helper programs (version probes, `py`, `vswhere`, mise) without a window.

use std::ffi::OsStr;
use std::process::Command;

/// A `Command` for a program Whichcraft runs in the background and reads the output of.
///
/// The GUI drops its console at startup (`main.rs`), so a console program it starts gets a
/// new console of its own. On Windows 11 that console is handed to Windows Terminal, which
/// opens (and may leave behind) a window for every version probe. `CREATE_NO_WINDOW` gives
/// the program a console without a window; its output is still captured.
pub fn background_command(program: impl AsRef<OsStr>) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
