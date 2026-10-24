//! `whichcraft.com`: the console launcher the installers put beside the GUI `whichcraft.exe`.
//!
//! PATHEXT tries `.COM` before `.EXE`, so typing `whichcraft list` in a terminal runs this
//! console program and the shell waits for it. Without a subcommand (or with only GUI flags
//! such as `--legacy-ui`) it opens the GUI and returns.

fn main() {
    #[cfg(windows)]
    {
        if whichcraft_lib::is_gui_launch() {
            whichcraft_lib::open_gui_beside_cli();
        }
        whichcraft_lib::run_cli();
    }
}
