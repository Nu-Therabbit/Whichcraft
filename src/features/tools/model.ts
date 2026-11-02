import type {
  AndroidInventory,
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
  ToolInstallationRef,
  ToolInstallationView,
  ToolKind,
  UnfinishedUninstall,
  UninstallOutcome,
  UninstallPlan,
  UpdateCandidate,
} from "./types";
import type { UndoResult } from "../../shared/applyUndo";
import type { WhichcraftSettings } from "../../platform/types";

/** The version picked on the install list, with what it costs on disk once known. */
export interface ChosenVersion {
  version: string;
  downloadBytes: number | null;
  diskBytes?: number | null;
}

/** An update installed and waiting for its switch to be applied (P-1). */
export interface PendingUpdate {
  replacedRoot: string;
  installed: ToolInstallationRef;
  /** Profiles on the old version, moved to the new one with the switch when ticked (F-5). */
  repoint: { from: ToolInstallationRef; names: string[]; checked: boolean } | null;
}

/** Everything the tools panel shows. One value; only the reducer makes the next one. */
export interface ToolsState {
  tool: ToolKind;
  installations: ToolInstallationView[];
  loading: boolean;
  /** Counts finished inventory reads, since a fast read can start and finish without `loading` ever rendering. */
  reads: number;
  error: string | null;
  settings: WhichcraftSettings | null;
  recovery: RecoveryView | null;
  unfinished: UnfinishedUninstall[];
  pythonInfo: PythonSupplementalView | null;
  sdks: { android: AndroidInventory | null; msvc: MsvcInventory | null };
  shellCheck: ShellCheck | null;
  plan: {
    current: ToolApplyPlan | null;
    building: boolean;
    applying: boolean;
    undoResult: UndoResult | null;
    /** Where the on-screen plan came from (profiles page shows profile-sourced plans only). */
    source: "inventory" | "profile" | "cleanup" | null;
    /** Why each entry goes, while a PATH cleanup plan is on screen. */
    cleanup: { duplicates: string[]; missing: string[] } | null;
  };
  install: {
    /** Tool whose catalogue was requested, including an empty or failed response. */
    catalogTool: ToolKind | null;
    catalogError: string | null;
    versions: RemoteVersion[];
    loading: boolean;
    busy: boolean;
    miseStatus: MiseStatus | null;
    chosen: ChosenVersion | null;
    /** Keep panel error through the next inventory readback after install failure. */
    retainErrorOnRefresh: boolean;
  };
  update: { list: UpdateCandidate[] | null; busy: boolean; pending: PendingUpdate | null };
  uninstall: {
    plan: UninstallPlan | null;
    outcome: UninstallOutcome | null;
    busy: boolean;
    /** The switch to the chosen replacement, shown before anything is applied (Q9). */
    switchPlan: ToolApplyPlan | null;
    /** Preselected replacement, e.g. the version an update just installed. */
    defaultReplacement: string | null;
  };
  profiles: {
    list: ProfileMatchStatus[];
    current: ProfileToolPin[];
    missing: { profileId: string; items: MissingPin[] } | null;
    busy: boolean;
  };
}

export function initialToolsState(tool: ToolKind = "java"): ToolsState {
  return {
    tool,
    installations: [],
    loading: false,
    reads: 0,
    error: null,
    settings: null,
    recovery: null,
    unfinished: [],
    pythonInfo: null,
    sdks: { android: null, msvc: null },
    shellCheck: null,
    plan: { current: null, building: false, applying: false, undoResult: null, source: null, cleanup: null },
    install: {
      catalogTool: null,
      catalogError: null,
      versions: [],
      loading: false,
      busy: false,
      miseStatus: null,
      chosen: null,
      retainErrorOnRefresh: false,
    },
    update: { list: null, busy: false, pending: null },
    uninstall: { plan: null, outcome: null, busy: false, switchPlan: null, defaultReplacement: null },
    profiles: { list: [], current: [], missing: null, busy: false },
  };
}

/** A single-tool plan can be rebuilt from its selection; profile and cleanup plans cannot. */
export function isSingleToolPlan(plan: ToolApplyPlan): boolean {
  return plan.recordsSelection !== false && !plan.additionalSelections?.length;
}
