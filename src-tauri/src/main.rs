// Release builds are GUI apps, so starting Whichcraft from Explorer or the Start menu opens no
// console window (on Windows 11 that console became a Windows Terminal window left behind).
// The CLI goes through `bin\whichcraft.exe` (src/bin/whichcraft-cli.rs), a console program the
// shell waits for. Debug builds stay console apps so `npm run tauri dev` shows their logs.
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

fn main() {
    #[cfg(windows)]
    {
        if whichcraft_lib::is_gui_launch() {
            whichcraft_lib::detach_console();
            whichcraft_lib::run();
        } else {
            // Installers run `whichcraft.exe path-cleanup`; print to their console if they have one.
            whichcraft_lib::attach_parent_console();
            whichcraft_lib::run_cli();
        }
    }
}
