import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createDemoApi, loadDemoFixture } from "./demo/createDemoApi";
import type {
  ApplyProgressEvent,
  CheckCommandResult,
  EnvChange,
  EnvSnapshot,
  EnvValueKind,
  EnvVar,
  LocalAccount,
  SnapshotMeta,
  UnsupportedEnvValue,
  UpdateInfo,
  VarScope,
} from "./types";

export interface LaunchOptions {
  demo: boolean;
  demoFixture: string | null;
}

export interface EnvarlyApi {
  getLaunchOptions: () => Promise<LaunchOptions>;
  getEnvVars: () => Promise<EnvVar[]>;
  getUnsupportedEnvValues: () => Promise<UnsupportedEnvValue[]>;
  setEnvVar: (
    name: string,
    value: string,
    valueKind: EnvValueKind,
    scope: VarScope,
  ) => Promise<void>;
  deleteEnvVar: (name: string, scope: VarScope) => Promise<void>;
  applyEnvChanges: (changes: EnvChange[]) => Promise<void>;
  createSnapshot: (label: string) => Promise<SnapshotMeta>;
  listSnapshots: () => Promise<SnapshotMeta[]>;
  renameSnapshot: (id: string, label: string) => Promise<SnapshotMeta>;
  deleteSnapshot: (id: string) => Promise<void>;
  validatePaths: (paths: string[]) => Promise<boolean[]>;
  getRegistrySnapshot: () => Promise<EnvSnapshot>;
  isElevated: () => Promise<boolean>;
  restartAsAdmin: () => Promise<void>;
  exportVars: (scope: "All" | "User" | "System", format: string) => Promise<string | null>;
  exportCustomVars: (
    vars: { name: string; value: string; valueKind: EnvValueKind; scope: string }[],
    format: string,
  ) => Promise<string | null>;
  parseImport: (content: string, format: "json" | "reg") => Promise<EnvSnapshot>;
  getPathStatus: () => Promise<{
    installDir: string;
    userHasEntry: boolean;
    systemHasEntry: boolean;
    /** `null` when no other-user account is selected. */
    otherUserHasEntry: boolean | null;
  }>;
  getPathProposal: (scope: VarScope) => Promise<string | null>;
  checkCommand: (input: string) => Promise<CheckCommandResult>;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  /** Local accounts (other than the current one) that can be selected for
   * editing when running elevated. */
  listLocalAccounts: () => Promise<LocalAccount[]>;
  /** Switch the active other-user account; `null` deselects. Callers must
   * re-fetch vars/snapshot/path-status afterward — this alone doesn't. */
  selectAccount: (sid: string | null) => Promise<LocalAccount | null>;
  getSelectedAccount: () => Promise<LocalAccount | null>;
  /**
   * Subscribe to per-variable progress while `applyEnvChanges` runs. Resolves
   * once the listener is actually registered — callers must await this before
   * invoking `applyEnvChanges`, or fast applies can finish (and emit all their
   * events) before the subscription exists to hear them.
   */
  onApplyProgress: (callback: (event: ApplyProgressEvent) => void) => Promise<() => void>;
  listJavaInstallations: () => Promise<import("./types").JavaInstallationView[]>;
  listToolInstallations: (tool: import("./types").ToolKind) => Promise<import("./types").ToolInstallationView[]>;
  planJavaApply: (root: string) => Promise<import("./types").JavaApplyPlan>;
  planToolApply: (tool: import("./types").ToolKind, root: string) => Promise<import("./types").ToolApplyPlan>;
  applyJavaPlan: (plan: import("./types").JavaApplyPlan) => Promise<import("./types").ApplyJavaResult>;
  applyToolPlan: (plan: import("./types").ToolApplyPlan) => Promise<import("./types").ApplyToolResult>;
  applyToolPlanWithUac: (plan: import("./types").ToolApplyPlan) => Promise<import("./types").ApplyToolResult>;
  undoLastWhichcraftApply: () => Promise<import("./types").UndoResult>;
  listRemoteVersions: (tool: import("./types").ToolKind) => Promise<import("./types").RemoteVersion[]>;
  getMiseStatus: () => Promise<import("./types").MiseStatus>;
  downloadSize: (tool: import("./types").ToolKind, version: string) => Promise<number | null>;
  installManaged: (tool: import("./types").ToolKind, version: string) => Promise<string>;
  planUninstall: (tool: import("./types").ToolKind, root: string) => Promise<import("./types").UninstallPlan>;
  uninstall: (
    tool: import("./types").ToolKind,
    root: string,
    replacement: import("./types").ToolApplyPlan | null,
  ) => Promise<import("./types").UninstallOutcome>;
  openFolder: (path: string) => Promise<void>;
  updateCandidates: (tool: import("./types").ToolKind) => Promise<import("./types").UpdateCandidate[]>;
  updateInstallation: (tool: import("./types").ToolKind, version: string) => Promise<import("./types").UpdateResult>;
  prepareMise: () => Promise<boolean>;
  planPathCleanup: () => Promise<import("./types").PathCleanupPlan>;
  listProfiles: () => Promise<import("./types").ToolProfile[]>;
  saveProfiles: (profiles: import("./types").ToolProfile[]) => Promise<void>;
  profileStatus: (profile: import("./types").ToolProfile) => Promise<import("./types").ProfileMatchStatus>;
  planProfile: (profile: import("./types").ToolProfile) => Promise<import("./types").ToolApplyPlan>;
  profileMissing: (profile: import("./types").ToolProfile) => Promise<import("./types").MissingPin[]>;
  installMissing: (profile: import("./types").ToolProfile) => Promise<void>;
  repointProfiles: (
    from: import("./types").ToolInstallationRef,
    to: import("./types").ToolInstallationRef,
  ) => Promise<string[]>;
  openTerminal: () => Promise<void>;
  shellCheck: (tool: import("./types").ToolKind) => Promise<import("./types").ShellCheck>;
  getPythonLauncherInfo: () => Promise<import("./types").PythonSupplementalView>;
  getAndroidInventory: () => Promise<import("./types").AndroidInventory>;
  getMsvcInventory: () => Promise<import("./types").MsvcInventory>;
  getWhichcraftSettings: () => Promise<import("./types").WhichcraftSettings>;
  saveWhichcraftSettings: (settings: import("./types").WhichcraftSettings) => Promise<void>;
  getRecoveryStatus: () => Promise<import("./types").RecoveryView | null>;
  resumeApply: (journalId: string) => Promise<void>;
  rollBackApply: (journalId: string) => Promise<import("./types").UndoResult>;
}

const normalApi: EnvarlyApi = {
  getLaunchOptions: () => invoke<LaunchOptions>("get_launch_options"),
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
  getPathStatus: () =>
    invoke<{
      installDir: string;
      userHasEntry: boolean;
      systemHasEntry: boolean;
      otherUserHasEntry: boolean | null;
    }>("get_path_status"),
  getPathProposal: (scope) => invoke<string | null>("get_path_proposal", { scope }),
  checkCommand: (input) => invoke<CheckCommandResult>("check_command", { input }),
  checkForUpdate: () => invoke<UpdateInfo | null>("check_for_update"),
  listLocalAccounts: () => invoke<LocalAccount[]>("list_local_accounts"),
  selectAccount: (sid) => invoke<LocalAccount | null>("select_account", { sid }),
  getSelectedAccount: () => invoke<LocalAccount | null>("get_selected_account"),
  onApplyProgress: async (callback) =>
    listen<ApplyProgressEvent>("apply-progress", (event) => callback(event.payload)),
  listJavaInstallations: () => invoke("whichcraft_list_java"),
  listToolInstallations: (tool) => invoke("whichcraft_list_tools", { tool }),
  planJavaApply: (root) => invoke("whichcraft_plan_java", { root }),
  planToolApply: (tool, root) => invoke("whichcraft_plan_tool", { tool, root }),
  applyJavaPlan: (plan) => invoke("whichcraft_apply_java_plan", { plan }),
  applyToolPlan: (plan) => invoke("whichcraft_apply_tool_plan", { plan }),
  applyToolPlanWithUac: (plan) => invoke("whichcraft_apply_tool_plan_with_uac", { plan }),
  undoLastWhichcraftApply: () => invoke("whichcraft_undo_last_apply"),
  listRemoteVersions: (tool) => invoke("whichcraft_list_remote_versions", { tool }),
  getMiseStatus: () => invoke("whichcraft_mise_status"),
  downloadSize: (tool, version) => invoke("whichcraft_download_size", { tool, version }),
  installManaged: (tool, version) => invoke("whichcraft_install_managed", { tool, version }),
  planUninstall: (tool, root) => invoke("whichcraft_plan_uninstall", { tool, root }),
  uninstall: (tool, root, replacement) => invoke("whichcraft_uninstall", { tool, root, replacement }),
  openFolder: (path) => invoke("whichcraft_open_folder", { path }),
  updateCandidates: (tool) => invoke("whichcraft_update_candidates", { tool }),
  updateInstallation: (tool, version) => invoke("whichcraft_update_installation", { tool, version }),
  prepareMise: () => invoke("whichcraft_prepare_mise"),
  planPathCleanup: () => invoke("whichcraft_plan_path_cleanup"),
  listProfiles: () => invoke("whichcraft_list_profiles"),
  saveProfiles: (profiles) => invoke("whichcraft_save_profiles", { profiles }),
  profileStatus: (profile) => invoke("whichcraft_profile_status", { profile }),
  planProfile: (profile) => invoke("whichcraft_plan_profile", { profile }),
  profileMissing: (profile) => invoke("whichcraft_profile_missing", { profile }),
  installMissing: (profile) => invoke("whichcraft_install_missing", { profile }),
  repointProfiles: (from, to) => invoke("whichcraft_repoint_profiles", { from, to }),
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

let apiPromise: Promise<EnvarlyApi> | null = null;

/** get_launch_options should resolve almost instantly; this bounds how long a
 * stuck IPC call can block every other command in the app behind `getApi()`. */
const LAUNCH_OPTIONS_TIMEOUT_MS = 3000;

export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

async function getApi(): Promise<EnvarlyApi> {
  if (!isTauri()) {
    throw new Error("Tauri runtime unavailable. Start Envarly with `npm run dev`.");
  }
  if (!apiPromise) {
    apiPromise = withTimeout(normalApi.getLaunchOptions(), LAUNCH_OPTIONS_TIMEOUT_MS, {
      demo: false,
      demoFixture: null,
    }).then(async (options) => {
      if (!options.demo) return normalApi;
      return createDemoApi(options, await loadDemoFixture(options), normalApi);
    });
  }
  return apiPromise;
}

export const api: EnvarlyApi = {
  getLaunchOptions: async () => (await getApi()).getLaunchOptions(),
  getEnvVars: async () => (await getApi()).getEnvVars(),
  getUnsupportedEnvValues: async () => (await getApi()).getUnsupportedEnvValues(),
  setEnvVar: async (name, value, valueKind, scope) =>
    (await getApi()).setEnvVar(name, value, valueKind, scope),
  deleteEnvVar: async (name, scope) => (await getApi()).deleteEnvVar(name, scope),
  applyEnvChanges: async (changes) => (await getApi()).applyEnvChanges(changes),
  createSnapshot: async (label) => (await getApi()).createSnapshot(label),
  listSnapshots: async () => (await getApi()).listSnapshots(),
  renameSnapshot: async (id, label) => (await getApi()).renameSnapshot(id, label),
  deleteSnapshot: async (id) => (await getApi()).deleteSnapshot(id),
  validatePaths: async (paths) => (await getApi()).validatePaths(paths),
  getRegistrySnapshot: async () => (await getApi()).getRegistrySnapshot(),
  isElevated: async () => (await getApi()).isElevated(),
  restartAsAdmin: async () => (await getApi()).restartAsAdmin(),
  exportVars: async (scope, format) => (await getApi()).exportVars(scope, format),
  exportCustomVars: async (vars, format) => (await getApi()).exportCustomVars(vars, format),
  parseImport: async (content, format) => (await getApi()).parseImport(content, format),
  getPathStatus: async () => (await getApi()).getPathStatus(),
  getPathProposal: async (scope) => (await getApi()).getPathProposal(scope),
  checkCommand: async (input) => (await getApi()).checkCommand(input),
  checkForUpdate: async () => (await getApi()).checkForUpdate(),
  listLocalAccounts: async () => (await getApi()).listLocalAccounts(),
  selectAccount: async (sid) => (await getApi()).selectAccount(sid),
  getSelectedAccount: async () => (await getApi()).getSelectedAccount(),
  onApplyProgress: async (callback) => (await getApi()).onApplyProgress(callback),
  listJavaInstallations: async () => (await getApi()).listJavaInstallations(),
  listToolInstallations: async (tool) => (await getApi()).listToolInstallations(tool),
  planJavaApply: async (root) => (await getApi()).planJavaApply(root),
  planToolApply: async (tool, root) => (await getApi()).planToolApply(tool, root),
  applyJavaPlan: async (plan) => (await getApi()).applyJavaPlan(plan),
  applyToolPlan: async (plan) => (await getApi()).applyToolPlan(plan),
  applyToolPlanWithUac: async (plan) => (await getApi()).applyToolPlanWithUac(plan),
  undoLastWhichcraftApply: async () => (await getApi()).undoLastWhichcraftApply(),
  listRemoteVersions: async (tool) => (await getApi()).listRemoteVersions(tool),
  getMiseStatus: async () => (await getApi()).getMiseStatus(),
  downloadSize: async (tool, version) => (await getApi()).downloadSize(tool, version),
  installManaged: async (tool, version) => (await getApi()).installManaged(tool, version),
  planUninstall: async (tool, root) => (await getApi()).planUninstall(tool, root),
  uninstall: async (tool, root, replacement) => (await getApi()).uninstall(tool, root, replacement),
  openFolder: async (path) => (await getApi()).openFolder(path),
  updateCandidates: async (tool) => (await getApi()).updateCandidates(tool),
  updateInstallation: async (tool, version) => (await getApi()).updateInstallation(tool, version),
  prepareMise: async () => (await getApi()).prepareMise(),
  planPathCleanup: async () => (await getApi()).planPathCleanup(),
  listProfiles: async () => (await getApi()).listProfiles(),
  saveProfiles: async (profiles) => (await getApi()).saveProfiles(profiles),
  profileStatus: async (profile) => (await getApi()).profileStatus(profile),
  planProfile: async (profile) => (await getApi()).planProfile(profile),
  profileMissing: async (profile) => (await getApi()).profileMissing(profile),
  installMissing: async (profile) => (await getApi()).installMissing(profile),
  repointProfiles: async (from, to) => (await getApi()).repointProfiles(from, to),
  openTerminal: async () => (await getApi()).openTerminal(),
  shellCheck: async (tool) => (await getApi()).shellCheck(tool),
  getPythonLauncherInfo: async () => (await getApi()).getPythonLauncherInfo(),
  getAndroidInventory: async () => (await getApi()).getAndroidInventory(),
  getMsvcInventory: async () => (await getApi()).getMsvcInventory(),
  getWhichcraftSettings: async () => (await getApi()).getWhichcraftSettings(),
  saveWhichcraftSettings: async (settings) => (await getApi()).saveWhichcraftSettings(settings),
  getRecoveryStatus: async () => (await getApi()).getRecoveryStatus(),
  resumeApply: async (journalId) => (await getApi()).resumeApply(journalId),
  rollBackApply: async (journalId) => (await getApi()).rollBackApply(journalId),
};
