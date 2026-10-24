import type { UndoResult } from "../../shared/applyUndo";
import type {
  AndroidInventory,
  ApplyToolResult,
  MissingPin,
  MiseStatus,
  MsvcInventory,
  PathCleanupPlan,
  ProfileMatchStatus,
  PythonSupplementalView,
  RecoveryView,
  RemoteVersion,
  ShellCheck,
  ToolApplyPlan,
  ToolInstallationRef,
  ToolInstallationView,
  ToolKind,
  ToolProfile,
  UnfinishedUninstall,
  UninstallOutcome,
  UninstallPlan,
  UpdateCandidate,
  UpdateResult,
} from "./types";

export interface ToolsApi {
  listToolInstallations: (tool: ToolKind, refreshCatalog?: boolean) => Promise<ToolInstallationView[]>;
  planToolApply: (tool: ToolKind, root: string) => Promise<ToolApplyPlan>;
  applyToolPlan: (plan: ToolApplyPlan) => Promise<ApplyToolResult>;
  applyToolPlanWithUac: (plan: ToolApplyPlan) => Promise<ApplyToolResult>;
  undoLastWhichcraftApply: () => Promise<UndoResult>;
  listRemoteVersions: (tool: ToolKind) => Promise<RemoteVersion[]>;
  getMiseStatus: () => Promise<MiseStatus>;
  downloadSize: (
    tool: ToolKind,
    version: string,
  ) => Promise<{ downloadBytes: number | null; diskBytes: number | null }>;
  installManaged: (tool: ToolKind, version: string) => Promise<string>;
  planUninstall: (tool: ToolKind, root: string) => Promise<UninstallPlan>;
  uninstall: (
    tool: ToolKind,
    root: string,
    replacement: ToolApplyPlan | null,
  ) => Promise<UninstallOutcome>;
  unfinishedUninstalls: () => Promise<UnfinishedUninstall[]>;
  dismissUnfinishedUninstall: (id: string) => Promise<void>;
  updateCandidates: (tool: ToolKind) => Promise<UpdateCandidate[]>;
  updateInstallation: (tool: ToolKind, version: string) => Promise<UpdateResult>;
  prepareMise: () => Promise<boolean>;
  planPathCleanup: () => Promise<PathCleanupPlan>;
  listProfiles: () => Promise<ToolProfile[]>;
  saveProfiles: (profiles: ToolProfile[]) => Promise<void>;
  profileStatus: (profile: ToolProfile) => Promise<ProfileMatchStatus>;
  planProfile: (profile: ToolProfile) => Promise<ToolApplyPlan>;
  profileMissing: (profile: ToolProfile) => Promise<MissingPin[]>;
  installMissing: (profile: ToolProfile) => Promise<void>;
  repointProfiles: (from: ToolInstallationRef, to: ToolInstallationRef) => Promise<string[]>;
  profilesUsing: (installation: ToolInstallationRef) => Promise<string[]>;
  shellCheck: (tool: ToolKind) => Promise<ShellCheck>;
  getPythonLauncherInfo: () => Promise<PythonSupplementalView>;
  getAndroidInventory: () => Promise<AndroidInventory>;
  getMsvcInventory: () => Promise<MsvcInventory>;
  getRecoveryStatus: () => Promise<RecoveryView | null>;
  resumeApply: (journalId: string) => Promise<void>;
  rollBackApply: (journalId: string) => Promise<UndoResult>;
}
