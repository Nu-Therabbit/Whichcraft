export type { VarScope } from "../../shared/varScope";
import type { VarScope } from "../../shared/varScope";
export type { EnvValueKind } from "../../shared/envValueKind";
import type { EnvValueKind } from "../../shared/envValueKind";
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

export interface PathStatusView {
  installDir: string;
  userHasEntry: boolean;
  systemHasEntry: boolean;
  /** `null` when no other-user account is selected. */
  otherUserHasEntry: boolean | null;
}

export type { UndoConflict, UndoResult } from "../../shared/applyUndo";
