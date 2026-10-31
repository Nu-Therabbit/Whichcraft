import type { WhichcraftApi } from "./contracts";
import type { LaunchOptions } from "./platform/types";
import { WHICHCRAFT_API_KEYS } from "./composition/apiKeys";
import { mergeWhichcraftApi } from "./composition/appServices";
import { createProductionServices } from "./composition/createProductionServices";
import { withTimeout } from "./composition/withTimeout";

export type { WhichcraftApi, LaunchOptions };
export { withTimeout };

let wiredApi: WhichcraftApi | null = null;
let pendingApi: Promise<WhichcraftApi> | null = null;

/** Registers the active backend for unmigrated callers importing the legacy `api` facade. */
export function wireLegacyApiFacade(full: WhichcraftApi): void {
  wiredApi = full;
  pendingApi = Promise.resolve(full);
}

/** Test-only: clear cached resolution between cases. */
export function resetLegacyApiFacadeForTests(): void {
  wiredApi = null;
  pendingApi = null;
}

async function resolveLegacyApi(): Promise<WhichcraftApi> {
  if (wiredApi) return wiredApi;
  if (!pendingApi) {
    pendingApi = createProductionServices().then((services) => {
      if (wiredApi) return wiredApi;
      return mergeWhichcraftApi(services);
    });
  }
  try {
    const resolved = await pendingApi;
    if (wiredApi) return wiredApi;
    return resolved;
  } catch (error) {
    if (wiredApi) return wiredApi;
    throw error;
  }
}

function legacyApiMethod(method: (typeof WHICHCRAFT_API_KEYS)[number]) {
  return async (...args: unknown[]) => {
    const impl = (await resolveLegacyApi())[method] as (...a: unknown[]) => unknown;
    return impl(...args);
  };
}

/** Compatibility facade for callers not yet on injected feature contracts. */
export const api = Object.fromEntries(
  WHICHCRAFT_API_KEYS.map((key) => [key, legacyApiMethod(key)]),
) as unknown as WhichcraftApi;
