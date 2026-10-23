import type { EnvarlyApi } from "./contracts";
import type { LaunchOptions } from "./platform/types";
import { createProductionServices } from "./composition/createProductionServices";
import { mergeEnvarlyApi } from "./contracts";
import { withTimeout } from "./composition/withTimeout";

export type { EnvarlyApi, LaunchOptions };
export { withTimeout };

let wiredApi: EnvarlyApi | null = null;
let pendingApi: Promise<EnvarlyApi> | null = null;

/** Called once from AppServicesProvider so unmigrated callers share the injected backend. */
export function wireLegacyApiFacade(full: EnvarlyApi): void {
  wiredApi = full;
  pendingApi = Promise.resolve(full);
}

/** Test-only: clear a rejected or cached resolution between cases. */
export function resetLegacyApiFacadeForTests(): void {
  wiredApi = null;
  pendingApi = null;
}

async function resolveLegacyApi(): Promise<EnvarlyApi> {
  if (wiredApi) return wiredApi;
  if (!pendingApi) {
    pendingApi = createProductionServices().then(mergeEnvarlyApi);
  }
  wiredApi = await pendingApi;
  return wiredApi;
}

function bind<K extends keyof EnvarlyApi>(method: K): EnvarlyApi[K] {
  return (async (...args: unknown[]) => {
    const impl = (await resolveLegacyApi())[method] as (...a: unknown[]) => unknown;
    return impl(...args);
  }) as EnvarlyApi[K];
}

/** Compatibility facade for callers not yet on injected feature contracts. */
export const api: EnvarlyApi = {
  getLaunchOptions: bind("getLaunchOptions"),
  getEnvVars: bind("getEnvVars"),
  getUnsupportedEnvValues: bind("getUnsupportedEnvValues"),
  setEnvVar: bind("setEnvVar"),
  deleteEnvVar: bind("deleteEnvVar"),
  applyEnvChanges: bind("applyEnvChanges"),
  createSnapshot: bind("createSnapshot"),
  listSnapshots: bind("listSnapshots"),
  renameSnapshot: bind("renameSnapshot"),
  deleteSnapshot: bind("deleteSnapshot"),
  validatePaths: bind("validatePaths"),
  getRegistrySnapshot: bind("getRegistrySnapshot"),
  isElevated: bind("isElevated"),
  restartAsAdmin: bind("restartAsAdmin"),
  exportVars: bind("exportVars"),
  exportCustomVars: bind("exportCustomVars"),
  parseImport: bind("parseImport"),
  getPathStatus: bind("getPathStatus"),
  getPathProposal: bind("getPathProposal"),
  checkCommand: bind("checkCommand"),
  checkForUpdate: bind("checkForUpdate"),
  listLocalAccounts: bind("listLocalAccounts"),
  selectAccount: bind("selectAccount"),
  getSelectedAccount: bind("getSelectedAccount"),
  onApplyProgress: bind("onApplyProgress"),
  listToolInstallations: bind("listToolInstallations"),
  planToolApply: bind("planToolApply"),
  applyToolPlan: bind("applyToolPlan"),
  applyToolPlanWithUac: bind("applyToolPlanWithUac"),
  undoLastWhichcraftApply: bind("undoLastWhichcraftApply"),
  listRemoteVersions: bind("listRemoteVersions"),
  getMiseStatus: bind("getMiseStatus"),
  downloadSize: bind("downloadSize"),
  installManaged: bind("installManaged"),
  planUninstall: bind("planUninstall"),
  uninstall: bind("uninstall"),
  openFolder: bind("openFolder"),
  unfinishedUninstalls: bind("unfinishedUninstalls"),
  dismissUnfinishedUninstall: bind("dismissUnfinishedUninstall"),
  updateCandidates: bind("updateCandidates"),
  updateInstallation: bind("updateInstallation"),
  prepareMise: bind("prepareMise"),
  planPathCleanup: bind("planPathCleanup"),
  listProfiles: bind("listProfiles"),
  saveProfiles: bind("saveProfiles"),
  profileStatus: bind("profileStatus"),
  planProfile: bind("planProfile"),
  profileMissing: bind("profileMissing"),
  installMissing: bind("installMissing"),
  repointProfiles: bind("repointProfiles"),
  profilesUsing: bind("profilesUsing"),
  openTerminal: bind("openTerminal"),
  shellCheck: bind("shellCheck"),
  getPythonLauncherInfo: bind("getPythonLauncherInfo"),
  getAndroidInventory: bind("getAndroidInventory"),
  getMsvcInventory: bind("getMsvcInventory"),
  getWhichcraftSettings: bind("getWhichcraftSettings"),
  saveWhichcraftSettings: bind("saveWhichcraftSettings"),
  getRecoveryStatus: bind("getRecoveryStatus"),
  resumeApply: bind("resumeApply"),
  rollBackApply: bind("rollBackApply"),
};
