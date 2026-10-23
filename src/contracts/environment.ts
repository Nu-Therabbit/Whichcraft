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
  VarScope,
} from "../features/environment/types";

/** Type-only contract for Environment workflows (variables, snapshots, transfer, lookup). */
export interface EnvironmentApi {
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
  listLocalAccounts: () => Promise<LocalAccount[]>;
  selectAccount: (sid: string | null) => Promise<LocalAccount | null>;
  getSelectedAccount: () => Promise<LocalAccount | null>;
  /**
   * Subscribe to per-variable progress while `applyEnvChanges` runs. Resolves
   * once the listener is actually registered — callers must await this before
   * invoking `applyEnvChanges`, or fast applies can finish (and emit all their
   * events) before the subscription exists to hear them.
   */
  onApplyProgress: (callback: (event: ApplyProgressEvent) => void) => Promise<() => void>;
}
