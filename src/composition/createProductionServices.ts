import { isTauri } from "@tauri-apps/api/core";
import { createDemoApi, loadDemoFixture } from "../demo/createDemoApi";
import type { AppServices, EnvarlyApi } from "../contracts";
import { tauriEnvarlyApi } from "../transport/tauriEnvarlyApi";
import { splitEnvarlyApi } from "./appServices";
import { withTimeout } from "./withTimeout";

/** get_launch_options should resolve almost instantly; this bounds how long a
 * stuck IPC call can block every other command in the app behind service init. */
const LAUNCH_OPTIONS_TIMEOUT_MS = 3000;

async function resolveEnvarlyApi(): Promise<EnvarlyApi> {
  if (!isTauri()) {
    throw new Error("Tauri runtime unavailable. Start Envarly with `npm run dev`.");
  }
  const options = await withTimeout(tauriEnvarlyApi.getLaunchOptions(), LAUNCH_OPTIONS_TIMEOUT_MS, {
    demo: false,
    demoFixture: null,
  });
  if (!options.demo) return tauriEnvarlyApi;
  return createDemoApi(options, await loadDemoFixture(options), tauriEnvarlyApi);
}

let productionPromise: Promise<AppServices> | null = null;

/** Single production composition entry: real Tauri adapter or demo overlay. */
export function createProductionServices(): Promise<AppServices> {
  if (!productionPromise) {
    productionPromise = resolveEnvarlyApi()
      .then(splitEnvarlyApi)
      .catch((err) => {
        productionPromise = null;
        return Promise.reject(err);
      });
  }
  return productionPromise;
}

/** Test seam: replace production resolution (must be called before provider mount). */
export function configureProductionServices(
  services: AppServices | Promise<AppServices> | null,
): void {
  if (services === null) {
    productionPromise = null;
    return;
  }
  productionPromise = services instanceof Promise ? services : Promise.resolve(services);
}
