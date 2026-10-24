use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::EnvarlyError;

/// The GUI program installed beside the console launcher (`whichcraft.com`, or
/// `whichcraft-cli.exe` in a cargo build).
pub fn gui_exe_beside(cli_exe: &Path) -> PathBuf {
    cli_exe.with_file_name("whichcraft.exe")
}

/// Starts the GUI beside this console launcher with `args` (GUI flags only) and does not wait.
/// The GUI is a windows-subsystem program, so it gets no console window. It must not inherit
/// this launcher's stdio: a caller capturing the output (a script, `whichcraft | more`) would
/// otherwise wait on the pipe until the window is closed. `Command` always lets the child inherit
/// inheritable handles, so the launcher's own standard handles are made non-inheritable first.
pub fn open_gui_beside(args: &[String]) -> std::io::Result<()> {
    use std::process::Stdio;
    use windows_sys::Win32::Foundation::{SetHandleInformation, HANDLE_FLAG_INHERIT};
    use windows_sys::Win32::System::Console::{
        GetStdHandle, STD_ERROR_HANDLE, STD_INPUT_HANDLE, STD_OUTPUT_HANDLE,
    };
    for which in [STD_INPUT_HANDLE, STD_OUTPUT_HANDLE, STD_ERROR_HANDLE] {
        unsafe {
            let handle = GetStdHandle(which);
            if !handle.is_null() {
                SetHandleInformation(handle, HANDLE_FLAG_INHERIT, 0);
            }
        }
    }
    let gui = gui_exe_beside(&std::env::current_exe()?);
    std::process::Command::new(gui)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
}

/// Starts the legacy Envarly-style presentation instead of the desktop shell.
/// Read once at startup; switching needs a relaunch.
pub const LEGACY_UI_FLAG: &str = "--legacy-ui";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOptions {
    pub demo: bool,
    pub demo_fixture: Option<String>,
}

#[tauri::command]
pub fn get_launch_options() -> LaunchOptions {
    let mut args = std::env::args().skip(1);
    let mut demo = false;
    let mut demo_fixture = None;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--demo" => demo = true,
            "--demo-fixture" => {
                demo = true;
                demo_fixture = args.next();
            }
            _ if arg.starts_with("--demo-fixture=") => {
                demo = true;
                demo_fixture = Some(arg["--demo-fixture=".len()..].to_string());
            }
            _ => {}
        }
    }

    LaunchOptions { demo, demo_fixture }
}

/// True when the arguments start the GUI rather than a CLI subcommand.
pub fn is_gui_launch(args: &[String]) -> bool {
    args.is_empty()
        || args.iter().any(|arg| {
            arg == "--demo" || arg.starts_with("--demo-fixture") || arg == LEGACY_UI_FLAG
        })
}

/// The presentation the frontend mounts, as `lib/appPresentation.ts` names it.
pub fn startup_presentation(args: &[String]) -> &'static str {
    if args.iter().any(|arg| arg == LEGACY_UI_FLAG) {
        "legacy"
    } else {
        "desktop-shell"
    }
}

/// Runs before any page script, so `main.tsx` can freeze the presentation
/// before React mounts.
pub fn presentation_init_script(presentation: &str) -> String {
    format!("window.__WHICHCRAFT_PRESENTATION__ = {presentation:?};")
}

/// The launch arguments as one Windows command line, so a relaunch (such as Run as admin)
/// keeps `--legacy-ui` and demo flags. Quoted the way `CommandLineToArgvW` reads them back.
pub fn relaunch_parameters(args: &[String]) -> String {
    args.iter()
        .map(|arg| quote_windows_arg(arg))
        .collect::<Vec<_>>()
        .join(" ")
}

fn quote_windows_arg(arg: &str) -> String {
    if !arg.is_empty() && !arg.contains([' ', '\t', '"']) {
        return arg.to_string();
    }
    let mut quoted = String::from('"');
    let mut backslashes = 0usize;
    for ch in arg.chars() {
        match ch {
            '\\' => backslashes += 1,
            '"' => {
                // Backslashes before a quote are doubled, plus one to escape the quote.
                quoted.extend(std::iter::repeat_n('\\', backslashes * 2 + 1));
                quoted.push('"');
                backslashes = 0;
            }
            _ => {
                quoted.extend(std::iter::repeat_n('\\', backslashes));
                quoted.push(ch);
                backslashes = 0;
            }
        }
    }
    // Trailing backslashes are doubled so the closing quote stays a quote.
    quoted.extend(std::iter::repeat_n('\\', backslashes * 2));
    quoted.push('"');
    quoted
}

#[tauri::command]
pub fn read_demo_fixture(path: String) -> Result<String, EnvarlyError> {
    std::fs::read_to_string(path).map_err(EnvarlyError::Registry)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|arg| arg.to_string()).collect()
    }

    #[test]
    fn legacy_flag_selects_legacy_presentation() {
        assert_eq!(startup_presentation(&args(&["--legacy-ui"])), "legacy");
        assert_eq!(
            startup_presentation(&args(&["--demo", "--legacy-ui"])),
            "legacy"
        );
    }

    #[test]
    fn desktop_shell_is_the_default_presentation() {
        assert_eq!(startup_presentation(&args(&[])), "desktop-shell");
        assert_eq!(startup_presentation(&args(&["--demo"])), "desktop-shell");
    }

    #[test]
    fn legacy_and_demo_flags_launch_the_gui_not_the_cli() {
        assert!(is_gui_launch(&args(&[])));
        assert!(is_gui_launch(&args(&["--legacy-ui"])));
        assert!(is_gui_launch(&args(&["--demo-fixture", "fixture.json"])));
        assert!(!is_gui_launch(&args(&["list"])));
    }

    #[test]
    fn relaunch_keeps_launch_flags_and_quotes_paths() {
        assert_eq!(relaunch_parameters(&args(&[])), "");
        assert_eq!(relaunch_parameters(&args(&["--legacy-ui"])), "--legacy-ui");
        assert_eq!(
            relaunch_parameters(&args(&["--demo-fixture", r"C:\My Fixtures\a.json"])),
            r#"--demo-fixture "C:\My Fixtures\a.json""#
        );
        assert_eq!(
            relaunch_parameters(&args(&[r"C:\dir with space\"])),
            r#""C:\dir with space\\""#
        );
        assert_eq!(
            relaunch_parameters(&args(&[r#"say "hi""#])),
            r#""say \"hi\"""#
        );
    }

    #[test]
    fn the_console_launcher_opens_the_gui_installed_beside_it() {
        assert_eq!(
            gui_exe_beside(Path::new(r"C:\Program Files\Whichcraft\whichcraft.com")),
            PathBuf::from(r"C:\Program Files\Whichcraft\whichcraft.exe")
        );
        assert_eq!(
            gui_exe_beside(Path::new(r"E:\target\release\whichcraft-cli.exe")),
            PathBuf::from(r"E:\target\release\whichcraft.exe")
        );
    }

    #[test]
    fn init_script_sets_the_presentation_global() {
        assert_eq!(
            presentation_init_script("legacy"),
            r#"window.__WHICHCRAFT_PRESENTATION__ = "legacy";"#
        );
    }
}
