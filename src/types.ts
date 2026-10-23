export type VarScope = "User" | "System" | "OtherUser";
export type EnvValueKind = "String" | "ExpandString";
export type EnvValueKindSelection = "Auto" | EnvValueKind;

export interface SnapshotValue {
  value: string;
  /** Null only when reading a legacy snapshot or JSON export. */
  kind: EnvValueKind | null;
}

export interface EnvVar {
  name: string;
  value: string;
  scope: VarScope;
  valueKind: EnvValueKind;
  /** ";" = PATH-style, "," = NO_PROXY-style, null = plain value */
  listSeparator: ";" | "," | null;
}

export interface UnsupportedEnvValue {
  name: string;
  scope: VarScope;
  registryType: string;
}

export interface EnvSnapshot {
  user: Record<string, SnapshotValue>;
  system: Record<string, SnapshotValue>;
  /** Present only when an other-user account was active when this was taken. */
  otherUser: Record<string, SnapshotValue> | null;
}

/** A local Windows account, other than the current one, that can be selected
 * for editing when running elevated. */
export interface LocalAccount {
  sid: string;
  username: string;
  hasProfile: boolean;
  currentlyLoggedIn: boolean;
}

export interface SnapshotMeta {
  version: number;
  id: string;
  createdAt: string;
  label: string;
  snapshot: EnvSnapshot;
}

export interface UpdateInfo {
  version: string;
  url: string;
}

export interface ApplyProgressEvent {
  index: number;
  total: number;
  name: string;
  scope: VarScope;
  action: "set" | "delete";
  success: boolean;
  error: string | null;
}

export type EnvChange =
  | {
      changeType: "set";
      name: string;
      value: string;
      valueKind: EnvValueKind;
      scope: VarScope;
    }
  | {
      changeType: "delete";
      name: string;
      scope: VarScope;
    };

export interface CommandHit {
  directory: string;
  matchedFile: string;
  source: "User" | "System";
}

export type FullPathStatus =
  | { status: "active" }
  | { status: "shadowed"; shadowedBy: CommandHit }
  | { status: "notOnEffectivePath" };

export interface CheckCommandResult {
  input: string;
  queriedName: string;
  hadExtension: boolean;
  hits: CommandHit[];
  fullPathStatus: FullPathStatus | null;
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

/** @deprecated Use ToolInstallationView */
export type JavaInstallationView = ToolInstallationView;

export interface PlanVariableDiff {
  name: string;
  scope: VarScope;
  before: string | null;
  after: string;
  valueKind: EnvValueKind;
}

/** @deprecated Java uses the same plan as every other tool. */
export type JavaApplyPlan = ToolApplyPlan;

/** @deprecated Java uses the same apply result as every other tool. */
export type ApplyJavaResult = ApplyToolResult;

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

export type TerminalKind = "windows_terminal" | "power_shell" | "cmd";

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

export interface WhichcraftSettings {
  installStore: string;
  /** Earlier stores; their installations stay listed until empty. */
  previousInstallStores?: string[];
  /** False until the user confirms the install folder before the first install. */
  installStoreConfirmed?: boolean;
  scanRoots: string[];
  terminal: TerminalKind;
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

export type ChangeState = "written" | "notWritten" | "changedElsewhere";

export interface RecoveryItem {
  name: string;
  scope: VarScope;
  state: ChangeState;
  before: string | null;
  after: string | null;
  current: string | null;
}

/** An apply that never finished because the app stopped mid-way. */
export interface RecoveryView {
  journalId: string;
  kind: string;
  createdAt: string;
  items: RecoveryItem[];
  canResume: boolean;
}

export interface UndoConflict {
  name: string;
  scope: VarScope;
  message: string;
}

export interface UndoResult {
  conflicts: UndoConflict[];
  restored: number;
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
