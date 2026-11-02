//! `bin\whichcraft.exe`: the console launcher the installers put below the GUI `whichcraft.exe`.
//!
//! Only `bin` goes on PATH, so typing `whichcraft list` in a terminal runs this console program
//! and the shell waits for it. Without a subcommand (or with only GUI flags such as
//! `--legacy-ui`) it opens the GUI and returns.

fn main() {
    #[cfg(windows)]
    {
        if whichcraft_lib::is_gui_launch() {
            whichcraft_lib::open_gui_from_cli();
        }
        whichcraft_lib::run_cli();
    }
}
