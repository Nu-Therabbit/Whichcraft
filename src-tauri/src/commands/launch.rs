use serde::Serialize;

use crate::error::EnvarlyError;

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
        assert_eq!(startup_presentation(&args(&["--demo", "--legacy-ui"])), "legacy");
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
    fn init_script_sets_the_presentation_global() {
        assert_eq!(
            presentation_init_script("legacy"),
            r#"window.__WHICHCRAFT_PRESENTATION__ = "legacy";"#
        );
    }
}
