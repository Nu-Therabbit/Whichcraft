import type { EnvarlyApi } from "./contracts";
import type { LaunchOptions } from "./platform/types";
import { ENVARLY_API_KEYS } from "./composition/apiKeys";
import { mergeEnvarlyApi } from "./composition/appServices";
import { createProductionServices } from "./composition/createProductionServices";
import { withTimeout } from "./composition/withTimeout";

export type { EnvarlyApi, LaunchOptions };
export { withTimeout };

let wiredApi: EnvarlyApi | null = null;
let pendingApi: Promise<EnvarlyApi> | null = null;

/** Registers the active backend for unmigrated callers importing the legacy `api` facade. */
export function wireLegacyApiFacade(full: EnvarlyApi): void {
  wiredApi = full;
  pendingApi = Promise.resolve(full);
}

/** Test-only: clear cached resolution between cases. */
export function resetLegacyApiFacadeForTests(): void {
  wiredApi = null;
  pendingApi = null;
}

async function resolveLegacyApi(): Promise<EnvarlyApi> {
  if (wiredApi) return wiredApi;
  if (!pendingApi) {
    pendingApi = createProductionServices().then((services) => {
      if (wiredApi) return wiredApi;
      return mergeEnvarlyApi(services);
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

function legacyApiMethod(method: (typeof ENVARLY_API_KEYS)[number]) {
  return async (...args: unknown[]) => {
    const impl = (await resolveLegacyApi())[method] as (...a: unknown[]) => unknown;
    return impl(...args);
  };
}

/** Compatibility facade for callers not yet on injected feature contracts. */
export const api = Object.fromEntries(
  ENVARLY_API_KEYS.map((key) => [key, legacyApiMethod(key)]),
) as unknown as EnvarlyApi;
