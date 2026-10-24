import type { EnvValueKind } from "../../shared/envValueKind";
import type { VarScope } from "../../shared/varScope";
import type { TerminalKind } from "../../platform/types";

/** One variable a tool plan writes, as shown before it is applied. */
export interface PlanVariableDiff {
  name: string;
  scope: VarScope;
  before: string | null;
  after: string;
  valueKind: EnvValueKind;
}

export type ChangeState = "written" | "notWritten" | "changedElsewhere";

/** One journalled write of an unfinished apply. */
export interface RecoveryItem {
  name: string;
  scope: VarScope;
  state: ChangeState;
  before: string | null;
  after: string | null;
  current: string | null;
}

export type ToolKind = "java" | "node" | "python" | "go" | "flutter" | "git";

export type InstallerKind =
  | "msi"
  | "inno_setup"
  | "python_install_manager"
  | "managed_by_other_tool"
  | "folder_only"
  | "managed_by_whichcraft";

export interface ToolInstallationView {
  tool: ToolKind;
  vendor: string;
  version: string;
  root: string;
  managed: boolean;
  effective: boolean;
  selected: boolean;
  available: boolean;
  installerKind: InstallerKind;
  mismatchReason: string | null;
}

export interface ToolInstallationRef {
  tool: ToolKind;
  vendor: string;
  version: string;
  root: string;
  managed: boolean;
}

export interface ToolApplyPlan {
  planId: string;
  tool: ToolKind;
  requiresUac: boolean;
  warnings: string[];
  limitationNotice: string;
  userDiffs: PlanVariableDiff[];
  systemDiffs: PlanVariableDiff[];
  effectiveAfterUserOnly: boolean;
  selected: ToolInstallationRef;
  /** Other tools a profile plan selects alongside `selected`. */
  additionalSelections?: ToolInstallationRef[];
  /** False for plans that are not a tool choice, such as PATH cleanup. */
  recordsSelection?: boolean;
}

export interface ApplyToolResult {
  planId: string;
  stale: boolean;
  needsElevation: boolean;
}

export type { TerminalKind };

export interface RemoteVersion {
  version: string;
  downloadBytes: number | null;
  installBytes: number | null;
}

/** The pinned mise Whichcraft installs tools with; downloaded on the first install. */
export interface MiseStatus {
  version: string;
  present: boolean;
  downloadBytes: number;
  /** Versions an earlier Whichcraft pinned that are still on disk. */
  oldVersions: string[];
  /** The pinned mise is downloading in the background; installs wait for it. */
  fetching: boolean;
}

export interface UpdateCandidate {
  root: string;
  current: string;
  latest: string;
}

export interface UpdateResult {
  installation: ToolInstallationRef;
  plan: ToolApplyPlan;
}

export interface PythonLauncherLine {
  tag: string;
  path: string;
  isDefault: boolean;
}

export interface PythonSupplementalView {
  launcherLines: PythonLauncherLine[];
  launcherInstalled: boolean;
  storeStub: string | null;
  note: string;
}

export interface AndroidInventory {
  sdkRoot: string | null;
  rootSource: string | null;
  platforms: string[];
  buildTools: string[];
  ndk: string[];
  platformTools: string | null;
  emulator: string | null;
  cmake: string[];
}

export interface MsvcInventory {
  instances: { displayName: string; version: string; path: string; msvcToolsets: string[] }[];
  windowsSdks: string[];
}

/** What the configured shell runs after its profile, next to what the registry makes effective. */
export interface ShellCheck {
  tool: ToolKind;
  shell: TerminalKind;
  effectivePath: string | null;
  shellPath: string | null;
  matches: boolean;
}

/** An apply that never finished because the app stopped mid-way. */
export interface RecoveryView {
  journalId: string;
  kind: string;
  createdAt: string;
  items: RecoveryItem[];
  canResume: boolean;
}

export interface UsageReport {
  processes: string[];
  folderLocked: boolean;
}

export type UninstallMethod =
  | { kind: "managed"; store: string; miseVersion: string }
  | { kind: "uninstaller"; program: string; args: string[] }
  | { kind: "recycleFolder" }
  | { kind: "refused"; reason: string };

export interface UninstallPlan {
  installation: ToolInstallationView;
  method: UninstallMethod;
  usage: UsageReport;
  needsReplacement: boolean;
  replacements: ToolInstallationView[];
  affectedProfiles: string[];
  gradleHint: boolean;
  noConfirmation: boolean;
}

export type UninstallOutcome =
  | { status: "removed" }
  | { status: "cancelled" }
  | { status: "incomplete"; remaining: string }
  | { status: "blocked"; reason: string }
  | { status: "failed"; code: number };

export interface ProfileToolPin {
  tool: ToolKind;
  vendor: string;
  version: string;
  preferredRoot: string | null;
}

export interface ToolProfile {
  id: string;
  name: string;
  tools: ProfileToolPin[];
}

export interface ProfileMatchStatus {
  profile: ToolProfile;
  matchesEffective: boolean;
  unavailable: ProfileToolPin[];
}

export interface MissingPin {
  pin: ProfileToolPin;
  /** What Whichcraft would install, or null when it cannot. */
  installVersion: string | null;
  downloadBytes: number | null;
}

/** A User PATH cleanup: the plan plus why each entry goes. */
export interface PathCleanupPlan extends ToolApplyPlan {
  removedDuplicates: string[];
  removedMissing: string[];
}

/** An uninstall that started but was never seen to finish. */
export interface UnfinishedUninstall {
  id: string;
  startedAt: string;
  installation: ToolInstallationRef;
}
