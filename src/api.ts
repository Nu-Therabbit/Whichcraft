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
  getWhichcraftSettings: async () => (await getApi()).getWhichcraftSettings(),
  saveWhichcraftSettings: async (settings) => (await getApi()).saveWhichcraftSettings(settings),
  getRecoveryStatus: async () => (await getApi()).getRecoveryStatus(),
  resumeApply: async (journalId) => (await getApi()).resumeApply(journalId),
  rollBackApply: async (journalId) => (await getApi()).rollBackApply(journalId),
};
