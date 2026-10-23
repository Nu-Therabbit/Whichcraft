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
mod whichcraft;
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

/// If CLI subcommand args are present, execute them and exit the process.
/// Returns normally (unit) when there are no subcommand args, so the caller can launch the GUI.
#[cfg(windows)]
pub fn try_run_cli() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty()
        || args
            .iter()
            .any(|arg| arg == "--demo" || arg.starts_with("--demo-fixture"))
    {
        return;
    }
    cli::run() // -> !  (either exits 0 on success or exits 1 on error)
}

#[cfg(windows)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
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
            commands::whichcraft::whichcraft_health,
            commands::whichcraft::whichcraft_list_java,
            commands::whichcraft::whichcraft_plan_java,
            commands::whichcraft::whichcraft_apply_java_plan,
            commands::whichcraft::whichcraft_undo_last_apply,
            commands::whichcraft::whichcraft_open_terminal,
            commands::whichcraft::whichcraft_shell_check,
            commands::whichcraft::whichcraft_recovery_status,
            commands::whichcraft::whichcraft_resume_apply,
            commands::whichcraft::whichcraft_roll_back_apply,
            commands::whichcraft::whichcraft_get_java_selection,
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
            commands::whichcraft::whichcraft_apply_profile,
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
