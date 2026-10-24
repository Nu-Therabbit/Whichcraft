import type {
  AndroidInventory,
  ApplyToolResult,
  MiseStatus,
  MissingPin,
  MsvcInventory,
  ProfileMatchStatus,
  ProfileToolPin,
  PythonSupplementalView,
  RecoveryView,
  RemoteVersion,
  ShellCheck,
  ToolApplyPlan,
  ToolInstallationView,
  ToolKind,
  ToolProfile,
  UndoResult,
  UnfinishedUninstall,
  UninstallOutcome,
  UninstallPlan,
  UpdateCandidate,
  WhichcraftSettings,
} from "../../types";
import type { ChosenVersion, PendingUpdate } from "./model";

/** What the user (or the panel itself) asks for. */
export type ToolsIntent =
  | { type: "started" }
  | { type: "selectTool"; tool: ToolKind }
  | { type: "refresh" }
  /** `keepPending` when the same switch is rebuilt because it went stale, not a new choice. */
  | { type: "buildPlan"; root: string; keepPending?: boolean }
  | { type: "applyPlan" }
  | { type: "clearPlan" }
  | { type: "undoLast" }
  | { type: "clearUndoResult" }
  | { type: "resolveRecovery"; action: "resume" | "rollBack" }
  | { type: "saveSettings"; settings: WhichcraftSettings }
  | { type: "checkShell" }
  | { type: "clearShellCheck" }
  | { type: "openTerminal" }
  | { type: "loadSdks" }
  | { type: "openInstallList" }
  | { type: "chooseVersion"; version: string }
  | { type: "install" }
  | { type: "checkUpdates" }
  | { type: "update"; candidate: UpdateCandidate }
  | { type: "toggleRepoint"; checked: boolean }
  | { type: "planUninstall"; root: string; defaultReplacement?: string }
  | { type: "chooseReplacement"; root: string | null }
  | { type: "confirmUninstall"; replacementRoot: string | null; repoint: boolean }
  | { type: "closeUninstall" }
  | { type: "openFolder"; path: string }
  | { type: "dismissUnfinished"; id: string }
  | { type: "loadProfiles" }
  | { type: "createProfile"; name: string; tools: ProfileToolPin[] }
  | { type: "deleteProfile"; id: string }
  | { type: "planProfile"; profile: ToolProfile }
  | { type: "checkMissing"; profile: ToolProfile }
  | { type: "installMissing"; profile: ToolProfile }
  | { type: "planCleanup" };

/** Which busy flag a failure ends. */
export type Operation = "inventory" | "plan" | "apply" | "install" | "update" | "uninstall" | "profiles" | "other";

/** What came back from the backend. Only effects dispatch these. One that names a `tool` is
 * dropped when the panel has moved to another tool by the time it arrives. */
export type ToolsEvent =
  | { type: "failed"; op: Operation; error: string }
  | {
      type: "refreshed";
      tool: ToolKind;
      installations: ToolInstallationView[];
      recovery: RecoveryView | null;
      unfinished: UnfinishedUninstall[];
      settings: WhichcraftSettings;
      pythonInfo: PythonSupplementalView | null;
    }
  | { type: "planBuilt"; tool: ToolKind; plan: ToolApplyPlan }
  | { type: "toolMutationDropped"; tool: ToolKind }
  | { type: "cleanupPlanned"; plan: ToolApplyPlan | null; duplicates: string[]; missing: string[] }
  | { type: "applyFinished"; tool: ToolKind; result: ApplyToolResult }
  | { type: "undone"; tool: ToolKind; result: UndoResult }
  | { type: "recoveryResolved"; tool: ToolKind; result: UndoResult | null }
  | { type: "shellChecked"; tool: ToolKind; check: ShellCheck }
  | { type: "sdksLoaded"; android: AndroidInventory; msvc: MsvcInventory }
  | { type: "versionsLoaded"; tool: ToolKind; miseStatus: MiseStatus; versions: RemoteVersion[] }
  | { type: "versionSized"; tool: ToolKind; chosen: ChosenVersion }
  | { type: "installed" }
  | { type: "updatesChecked"; tool: ToolKind; list: UpdateCandidate[] }
  | { type: "updateInstalled"; tool: ToolKind; candidateRoot: string; plan: ToolApplyPlan; pending: PendingUpdate }
  | { type: "updateSwitched"; tool: ToolKind }
  | { type: "uninstallPlanned"; plan: UninstallPlan }
  | { type: "switchPlanned"; plan: ToolApplyPlan | null }
  | { type: "uninstallFinished"; tool: ToolKind; outcome: UninstallOutcome }
  | {
      type: "profilesLoaded";
      list: ProfileMatchStatus[];
      current: ProfileToolPin[];
    }
  | { type: "missingChecked"; profileId: string; items: MissingPin[] }
  | { type: "missingInstalled" };

export type ToolsMsg = ToolsIntent | ToolsEvent;

const EVENT_TYPES: ReadonlySet<string> = new Set<ToolsEvent["type"]>([
  "failed",
  "refreshed",
  "planBuilt",
  "toolMutationDropped",
  "cleanupPlanned",
  "applyFinished",
  "undone",
  "recoveryResolved",
  "shellChecked",
  "sdksLoaded",
  "versionsLoaded",
  "versionSized",
  "installed",
  "updatesChecked",
  "updateInstalled",
  "updateSwitched",
  "uninstallPlanned",
  "switchPlanned",
  "uninstallFinished",
  "profilesLoaded",
  "missingChecked",
  "missingInstalled",
]);

/** Intents have effects; events only change state. */
export const isIntent = (msg: ToolsMsg): msg is ToolsIntent => !EVENT_TYPES.has(msg.type);
