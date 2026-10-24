import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { EnvarlyApi } from "../contracts";
import type {
  ApplyProgressEvent,
  CheckCommandResult,
  EnvSnapshot,
  EnvVar,
  LocalAccount,
  PathStatusView,
  SnapshotMeta,
  UnsupportedEnvValue,
} from "../features/environment/types";
import type { UpdateInfo } from "../platform/types";

export const tauriEnvarlyApi: EnvarlyApi = {
  getLaunchOptions: () => invoke("get_launch_options"),
  getEnvVars: () => invoke<EnvVar[]>("get_env_vars"),
  getUnsupportedEnvValues: () => invoke<UnsupportedEnvValue[]>("get_unsupported_env_values"),
  setEnvVar: (name, value, valueKind, scope) =>
    invoke<void>("set_env_var", { name, value, valueKind, scope }),
  deleteEnvVar: (name, scope) => invoke<void>("delete_env_var", { name, scope }),
  applyEnvChanges: (changes) => invoke<void>("apply_env_changes", { changes }),
  createSnapshot: (label) => invoke<SnapshotMeta>("create_snapshot", { label }),
  listSnapshots: () => invoke<SnapshotMeta[]>("list_snapshots"),
  renameSnapshot: (id, label) => invoke<SnapshotMeta>("rename_snapshot", { id, label }),
  deleteSnapshot: (id) => invoke<void>("delete_snapshot", { id }),
  validatePaths: (paths) => invoke<boolean[]>("validate_paths", { paths }),
  getRegistrySnapshot: () => invoke<EnvSnapshot>("get_registry_snapshot"),
  isElevated: () => invoke<boolean>("is_elevated"),
  restartAsAdmin: () => invoke<void>("restart_as_admin"),
  exportVars: (scope, format) => invoke<string | null>("export_vars", { scope, format }),
  exportCustomVars: (vars, format) => invoke<string | null>("export_custom", { vars, format }),
  parseImport: (content, format) => invoke<EnvSnapshot>("parse_import", { content, format }),
  getPathStatus: () => invoke<PathStatusView>("get_path_status"),
  getPathProposal: (scope) => invoke<string | null>("get_path_proposal", { scope }),
  checkCommand: (input) => invoke<CheckCommandResult>("check_command", { input }),
  checkForUpdate: () => invoke<UpdateInfo | null>("check_for_update"),
  openUrl: (url) => openUrl(url),
  pickFolder: async (defaultPath) => {
    const selected = await open({ directory: true, multiple: false, defaultPath });
    return typeof selected === "string" ? selected : null;
  },
  listLocalAccounts: () => invoke<LocalAccount[]>("list_local_accounts"),
  selectAccount: (sid) => invoke<LocalAccount | null>("select_account", { sid }),
  getSelectedAccount: () => invoke<LocalAccount | null>("get_selected_account"),
  onApplyProgress: async (callback) =>
    listen<ApplyProgressEvent>("apply-progress", (event) => callback(event.payload)),
  listToolInstallations: (tool, refreshCatalog) => invoke("whichcraft_list_tools", { tool, refreshCatalog }),
  planToolApply: (tool, root) => invoke("whichcraft_plan_tool", { tool, root }),
  applyToolPlan: (plan) => invoke("whichcraft_apply_tool_plan", { plan }),
  applyToolPlanWithUac: (plan) => invoke("whichcraft_apply_tool_plan_with_uac", { plan }),
  undoLastWhichcraftApply: () => invoke("whichcraft_undo_last_apply"),
  listRemoteVersions: (tool) => invoke("whichcraft_list_remote_versions", { tool }),
  getMiseStatus: () => invoke("whichcraft_mise_status"),
  downloadSize: (tool, version) => invoke("whichcraft_download_size", { tool, version }),
  installManaged: (tool, version) => invoke("whichcraft_install_managed", { tool, version }),
  planUninstall: (tool, root) => invoke("whichcraft_plan_uninstall", { tool, root }),
  uninstall: (tool, root, replacement) =>
    invoke("whichcraft_uninstall", { tool, root, replacement }),
  openFolder: (path) => invoke("whichcraft_open_folder", { path }),
  unfinishedUninstalls: () => invoke("whichcraft_unfinished_uninstalls"),
  dismissUnfinishedUninstall: (id) => invoke("whichcraft_dismiss_unfinished_uninstall", { id }),
  updateCandidates: (tool) => invoke("whichcraft_update_candidates", { tool }),
  updateInstallation: (tool, version) =>
    invoke("whichcraft_update_installation", { tool, version }),
  prepareMise: () => invoke("whichcraft_prepare_mise"),
  planPathCleanup: () => invoke("whichcraft_plan_path_cleanup"),
  listProfiles: () => invoke("whichcraft_list_profiles"),
  saveProfiles: (profiles) => invoke("whichcraft_save_profiles", { profiles }),
  profileStatus: (profile) => invoke("whichcraft_profile_status", { profile }),
  planProfile: (profile) => invoke("whichcraft_plan_profile", { profile }),
  profileMissing: (profile) => invoke("whichcraft_profile_missing", { profile }),
  installMissing: (profile) => invoke("whichcraft_install_missing", { profile }),
  repointProfiles: (from, to) => invoke("whichcraft_repoint_profiles", { from, to }),
  profilesUsing: (installation) => invoke("whichcraft_profiles_using", { installation }),
  openTerminal: () => invoke("whichcraft_open_terminal"),
  shellCheck: (tool) => invoke("whichcraft_shell_check", { tool }),
  getPythonLauncherInfo: () => invoke("whichcraft_python_supplemental"),
  getAndroidInventory: () => invoke("whichcraft_android_inventory"),
  getMsvcInventory: () => invoke("whichcraft_msvc_inventory"),
  getWhichcraftSettings: () => invoke("whichcraft_get_settings"),
  saveWhichcraftSettings: (settings) => invoke("whichcraft_save_settings", { settings }),
  getRecoveryStatus: () => invoke("whichcraft_recovery_status"),
  resumeApply: (journalId) => invoke("whichcraft_resume_apply", { journalId }),
  rollBackApply: (journalId) => invoke("whichcraft_roll_back_apply", { journalId }),
};
