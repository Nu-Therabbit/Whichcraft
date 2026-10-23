import type { EnvironmentApi } from "../features/environment/api";
import type { ToolsApi } from "../features/tools/api";
import type { PlatformApi, ToolsPlatformSlice } from "../platform/api";

export const ENVIRONMENT_API_KEYS = [
  "getEnvVars",
  "getUnsupportedEnvValues",
  "setEnvVar",
  "deleteEnvVar",
  "applyEnvChanges",
  "createSnapshot",
  "listSnapshots",
  "renameSnapshot",
  "deleteSnapshot",
  "validatePaths",
  "getRegistrySnapshot",
  "exportVars",
  "exportCustomVars",
  "parseImport",
  "getPathStatus",
  "getPathProposal",
  "checkCommand",
  "listLocalAccounts",
  "selectAccount",
  "getSelectedAccount",
  "onApplyProgress",
] as const satisfies readonly (keyof EnvironmentApi)[];

export const TOOLS_API_KEYS = [
  "listToolInstallations",
  "planToolApply",
  "applyToolPlan",
  "applyToolPlanWithUac",
  "undoLastWhichcraftApply",
  "listRemoteVersions",
  "getMiseStatus",
  "downloadSize",
  "installManaged",
  "planUninstall",
  "uninstall",
  "unfinishedUninstalls",
  "dismissUnfinishedUninstall",
  "updateCandidates",
  "updateInstallation",
  "prepareMise",
  "planPathCleanup",
  "listProfiles",
  "saveProfiles",
  "profileStatus",
  "planProfile",
  "profileMissing",
  "installMissing",
  "repointProfiles",
  "profilesUsing",
  "shellCheck",
  "getPythonLauncherInfo",
  "getAndroidInventory",
  "getMsvcInventory",
  "getRecoveryStatus",
  "resumeApply",
  "rollBackApply",
] as const satisfies readonly (keyof ToolsApi)[];

export const PLATFORM_API_KEYS = [
  "getLaunchOptions",
  "isElevated",
  "restartAsAdmin",
  "checkForUpdate",
  "openFolder",
  "openTerminal",
  "getWhichcraftSettings",
  "saveWhichcraftSettings",
] as const satisfies readonly (keyof PlatformApi)[];

export const TOOLS_PLATFORM_SLICE_KEYS = [
  "getWhichcraftSettings",
  "saveWhichcraftSettings",
  "openTerminal",
  "openFolder",
] as const satisfies readonly (keyof ToolsPlatformSlice)[];

export const ENVARLY_API_KEYS = [
  ...ENVIRONMENT_API_KEYS,
  ...TOOLS_API_KEYS,
  ...PLATFORM_API_KEYS,
] as const;
