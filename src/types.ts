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
