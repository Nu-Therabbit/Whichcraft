#[cfg(windows)]
mod cli;
#[cfg(windows)]
mod commands;
#[cfg(windows)]
mod crypto;
#[cfg(windows)]
mod env_backend;
mod env_store;
mod error;
pub mod export;
mod import;
mod model;
#[cfg(windows)]
mod path_backend;
mod path_manage;
#[cfg(windows)]
mod snapshot;
#[cfg(windows)]
mod user_hive;
mod whichcraft;

#[cfg(windows)]
fn launch_args() -> Vec<String> {
    std::env::args().skip(1).collect()
}

/// True when this process starts the GUI (no args, or only GUI flags such as
/// `--demo` or `--legacy-ui`) rather than a CLI subcommand.
#[cfg(windows)]
pub fn is_gui_launch() -> bool {
    commands::launch::is_gui_launch(&launch_args())
}

/// Runs the CLI subcommand in the arguments and exits (0 on success, 1 on error).
#[cfg(windows)]
pub fn run_cli() -> ! {
    cli::run()
}

/// The GUI build started with a CLI subcommand (installers run `whichcraft.exe path-cleanup`):
/// output goes to the console of whoever started it, when there is one.
#[cfg(windows)]
pub fn attach_parent_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

/// A GUI launch of a debug build (a console app, so `tauri dev` shows logs): drop the console
/// Windows allocated, then give focus back to whatever had it. Release builds have no console.
#[cfg(windows)]
pub fn detach_console() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, SetForegroundWindow};
    unsafe {
        let prev = GetForegroundWindow();
        if windows_sys::Win32::System::Console::FreeConsole() != 0 && !prev.is_null() {
            SetForegroundWindow(prev);
        }
    }
}

/// `whichcraft.com` started without a subcommand: open the GUI installed beside it with the
/// same flags and return, so the shell is not held until the window closes.
#[cfg(windows)]
pub fn open_gui_beside_cli() -> ! {
    match commands::launch::open_gui_beside(&launch_args()) {
        Ok(()) => std::process::exit(0),
        Err(e) => {
            eprintln!("Cannot start the Whichcraft window: {e}");
            std::process::exit(1)
        }
    }
}

#[cfg(windows)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // The main window is created here (`create: false` in tauri.conf.json) so the
            // presentation chosen by `--legacy-ui` is in place before any page script runs.
            let presentation = commands::launch::startup_presentation(&launch_args());
            let config = app.config().app.windows[0].clone();
            tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?
                .initialization_script(commands::launch::presentation_init_script(presentation))
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::env::get_env_vars,
            commands::env::get_unsupported_env_values,
            commands::env::get_registry_snapshot,
            commands::env::set_env_var,
            commands::env::delete_env_var,
            commands::env::apply_env_changes,
            commands::snapshot::create_snapshot,
            commands::snapshot::list_snapshots,
            commands::snapshot::rename_snapshot,
            commands::snapshot::delete_snapshot,
            commands::path::validate_paths,
            commands::export::export_vars,
            commands::export::export_custom,
            commands::export::parse_import,
            commands::env::is_elevated,
            commands::env::restart_as_admin,
            commands::path::get_path_status,
            commands::path::get_path_proposal,
            commands::path::check_command,
            commands::launch::get_launch_options,
            commands::launch::read_demo_fixture,
            commands::update::check_for_update,
            commands::users::list_local_accounts,
            commands::users::select_account,
            commands::users::get_selected_account,
            commands::whichcraft::whichcraft_undo_last_apply,
            commands::whichcraft::whichcraft_open_terminal,
            commands::whichcraft::whichcraft_shell_check,
            commands::whichcraft::whichcraft_recovery_status,
            commands::whichcraft::whichcraft_resume_apply,
            commands::whichcraft::whichcraft_roll_back_apply,
            commands::whichcraft::whichcraft_list_tools,
            commands::whichcraft::whichcraft_get_settings,
            commands::whichcraft::whichcraft_save_settings,
            commands::whichcraft::whichcraft_plan_tool,
            commands::whichcraft::whichcraft_apply_tool_plan,
            commands::whichcraft::whichcraft_apply_tool_plan_with_uac,
            commands::whichcraft::whichcraft_plan_path_cleanup,
            commands::whichcraft::whichcraft_list_remote_versions,
            commands::whichcraft::whichcraft_mise_status,
            commands::whichcraft::whichcraft_download_size,
            commands::whichcraft::whichcraft_install_managed,
            commands::whichcraft::whichcraft_list_profiles,
            commands::whichcraft::whichcraft_save_profiles,
            commands::whichcraft::whichcraft_profile_status,
            commands::whichcraft::whichcraft_plan_profile,
            commands::whichcraft::whichcraft_python_supplemental,
            commands::whichcraft::whichcraft_android_inventory,
            commands::whichcraft::whichcraft_msvc_inventory,
            commands::whichcraft::whichcraft_plan_uninstall,
            commands::whichcraft::whichcraft_uninstall,
            commands::whichcraft::whichcraft_open_folder,
            commands::whichcraft::whichcraft_unfinished_uninstalls,
            commands::whichcraft::whichcraft_dismiss_unfinished_uninstall,
            commands::whichcraft::whichcraft_update_candidates,
            commands::whichcraft::whichcraft_update_installation,
            commands::whichcraft::whichcraft_prepare_mise,
            commands::whichcraft::whichcraft_profile_missing,
            commands::whichcraft::whichcraft_install_missing,
            commands::whichcraft::whichcraft_repoint_profiles,
            commands::whichcraft::whichcraft_profiles_using,
        ])
        .build(tauri::generate_context!())
        .expect("error while running whichcraft")
        .run(|_app_handle, event| {
            // Make sure a crash-free shutdown never leaves an other-user
            // hive loaded, even if the frontend never explicitly deselected.
            if let tauri::RunEvent::Exit = event {
                user_hive::unload_active_hive();
            }
        });
}
