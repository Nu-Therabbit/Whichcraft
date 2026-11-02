use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::WhichcraftError;

/// The GUI program for a console launcher: one folder up from the installed
/// `bin\whichcraft.exe`, or beside `whichcraft-cli.exe` in a cargo build. The installed launcher
/// shares the GUI's file name, so a sibling lookup would make it start itself.
pub fn gui_exe_for_cli(cli_exe: &Path) -> PathBuf {
    const GUI: &str = "whichcraft.exe";
    let shares_gui_name = cli_exe
        .file_name()
        .is_some_and(|name| name.eq_ignore_ascii_case(GUI));
    match cli_exe.parent().and_then(Path::parent) {
        Some(install_dir) if shares_gui_name => install_dir.join(GUI),
        _ => cli_exe.with_file_name(GUI),
    }
}

/// Starts the GUI for this console launcher with `args` (GUI flags only) and does not wait.
/// The GUI is a windows-subsystem program, so it gets no console window. It must not inherit
/// this launcher's stdio: a caller capturing the output (a script, `whichcraft | more`) would
/// otherwise wait on the pipe until the window is closed. `Command` always lets the child inherit
/// inheritable handles, so the launcher's own standard handles are made non-inheritable first.
pub fn open_gui_from_cli(args: &[String]) -> std::io::Result<()> {
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
    let gui = gui_exe_for_cli(&std::env::current_exe()?);
    std::process::Command::new(gui)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
}

/// Starts the legacy presentation inherited from the fork instead of the desktop shell.
/// Read once at startup; switching needs a relaunch.
pub const LEGACY_UI_FLAG: &str = "--legacy-ui";

/// Given to the elevated instance from Run as admin, naming the instance it replaces.
const REPLACES_PID_FLAG: &str = "--replaces-pid=";

/// How long a relaunched instance waits for the instance it replaces to exit.
const REPLACED_INSTANCE_WAIT_MS: u32 = 15_000;

fn is_demo_arg(arg: &str) -> bool {
    arg == "--demo" || arg.starts_with("--demo-fixture")
}

/// A demo run holds no real data, so it may run beside the real app (`media/capture.mjs`).
pub fn uses_single_instance(args: &[String]) -> bool {
    !args.iter().any(|arg| is_demo_arg(arg))
}

/// The arguments for the instance that replaces this one, keeping its GUI flags.
pub fn relaunch_args(args: &[String], own_pid: u32) -> Vec<String> {
    args.iter()
        .filter(|arg| !arg.starts_with(REPLACES_PID_FLAG))
        .cloned()
        .chain(Some(format!("{REPLACES_PID_FLAG}{own_pid}")))
        .collect()
}

fn replaced_pid(args: &[String]) -> Option<u32> {
    args.iter()
        .find_map(|arg| arg.strip_prefix(REPLACES_PID_FLAG)?.parse().ok())
}

/// The old instance holds the single-instance lock until it exits. Without this wait the
/// relaunched instance would hand off to it and exit, and then no window would remain.
pub fn wait_for_replaced_instance(args: &[String]) {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE,
    };
    let Some(pid) = replaced_pid(args) else {
        return;
    };
    unsafe {
        let process = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid);
        if !process.is_null() {
            WaitForSingleObject(process, REPLACED_INSTANCE_WAIT_MS);
            CloseHandle(process);
        }
    }
}

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
            is_demo_arg(arg) || arg == LEGACY_UI_FLAG || arg.starts_with(REPLACES_PID_FLAG)
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
pub fn read_demo_fixture(path: String) -> Result<String, WhichcraftError> {
    std::fs::read_to_string(path).map_err(WhichcraftError::Registry)
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
    fn a_relaunch_names_the_instance_it_replaces_and_stays_a_gui_launch() {
        let relaunch = relaunch_args(&args(&["--legacy-ui", "--replaces-pid=7"]), 42);
        assert_eq!(relaunch, args(&["--legacy-ui", "--replaces-pid=42"]));
        assert_eq!(replaced_pid(&relaunch), Some(42));
        assert!(is_gui_launch(&args(&["--replaces-pid=42"])));
        assert_eq!(replaced_pid(&args(&["--replaces-pid=x"])), None);
        assert_eq!(replaced_pid(&args(&["--legacy-ui"])), None);
    }

    #[test]
    fn only_a_demo_run_may_sit_beside_the_real_app() {
        assert!(uses_single_instance(&args(&[])));
        assert!(uses_single_instance(&args(&["--legacy-ui"])));
        assert!(!uses_single_instance(&args(&["--demo"])));
        assert!(!uses_single_instance(&args(&["--demo-fixture=a.json"])));
    }

    #[test]
    fn the_console_launcher_opens_the_gui_and_never_itself() {
        assert_eq!(
            gui_exe_for_cli(Path::new(r"C:\Program Files\Whichcraft\bin\whichcraft.exe")),
            PathBuf::from(r"C:\Program Files\Whichcraft\whichcraft.exe")
        );
        assert_eq!(
            gui_exe_for_cli(Path::new(r"C:\Program Files\Whichcraft\bin\WHICHCRAFT.EXE")),
            PathBuf::from(r"C:\Program Files\Whichcraft\whichcraft.exe")
        );
        assert_eq!(
            gui_exe_for_cli(Path::new(r"E:\target\release\whichcraft-cli.exe")),
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
