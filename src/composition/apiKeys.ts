import type { WhichcraftApi } from "../contracts";
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
] as const;

type _MissingEnvironmentApiKeys = Exclude<
  keyof EnvironmentApi,
  (typeof ENVIRONMENT_API_KEYS)[number]
>;
const _assertEnvironmentApiKeys: _MissingEnvironmentApiKeys extends never ? true : never = true;
void _assertEnvironmentApiKeys;

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
] as const;

type _MissingToolsApiKeys = Exclude<keyof ToolsApi, (typeof TOOLS_API_KEYS)[number]>;
const _assertToolsApiKeys: _MissingToolsApiKeys extends never ? true : never = true;
void _assertToolsApiKeys;

export const PLATFORM_API_KEYS = [
  "getLaunchOptions",
  "isElevated",
  "restartAsAdmin",
  "checkForUpdate",
  "openUrl",
  "pickFolder",
  "confirm",
  "openFolder",
  "openTerminal",
  "getWhichcraftSettings",
  "saveWhichcraftSettings",
] as const;

type _MissingPlatformApiKeys = Exclude<keyof PlatformApi, (typeof PLATFORM_API_KEYS)[number]>;
const _assertPlatformApiKeys: _MissingPlatformApiKeys extends never ? true : never = true;
void _assertPlatformApiKeys;

export const TOOLS_PLATFORM_SLICE_KEYS = [
  "getWhichcraftSettings",
  "saveWhichcraftSettings",
  "openTerminal",
  "openFolder",
] as const;

type _MissingToolsPlatformSliceKeys = Exclude<
  keyof ToolsPlatformSlice,
  (typeof TOOLS_PLATFORM_SLICE_KEYS)[number]
>;
const _assertToolsPlatformSliceKeys: _MissingToolsPlatformSliceKeys extends never
  ? true
  : never = true;
void _assertToolsPlatformSliceKeys;

export const WHICHCRAFT_API_KEYS = [
  ...ENVIRONMENT_API_KEYS,
  ...TOOLS_API_KEYS,
  ...PLATFORM_API_KEYS,
] as const;

type _MissingWhichcraftApiKeys = Exclude<keyof WhichcraftApi, (typeof WHICHCRAFT_API_KEYS)[number]>;
const _assertWhichcraftApiKeys: _MissingWhichcraftApiKeys extends never ? true : never = true;
void _assertWhichcraftApiKeys;
