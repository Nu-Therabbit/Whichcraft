import type { WriteCoordinatorFacade } from "../coordination/createWriteCoordinator";
import type { ToolsRuntime } from "../features/tools/runtime";
import type { AppServices, WhichcraftApi } from "../contracts";
import {
  ENVIRONMENT_API_KEYS,
  PLATFORM_API_KEYS,
  TOOLS_API_KEYS,
  TOOLS_PLATFORM_SLICE_KEYS,
} from "./apiKeys";

function pickMethods<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    const value = source[key];
    out[key] = (typeof value === "function" ? value.bind(source) : value) as T[K];
  }
  return out;
}

export function mergeWhichcraftApi(services: AppServices): WhichcraftApi {
  return {
    ...services.environment,
    ...services.tools,
    ...services.platform,
  };
}

export function splitWhichcraftApi(full: WhichcraftApi): AppServices {
  return {
    environment: pickMethods(full, ENVIRONMENT_API_KEYS),
    tools: pickMethods(full, TOOLS_API_KEYS),
    platform: pickMethods(full, PLATFORM_API_KEYS),
  };
}

export function createToolsRuntime(services: AppServices, coordination: WriteCoordinatorFacade): ToolsRuntime {
  return {
    tools: services.tools,
    platform: pickMethods(services.platform, TOOLS_PLATFORM_SLICE_KEYS),
    coordination,
  };
}

export function createUnavailableWhichcraftApi(message: string): WhichcraftApi {
  const reject = () => Promise.reject(new Error(message));
  return new Proxy({} as WhichcraftApi, {
    get(_target, prop) {
      if (prop === "then" || typeof prop === "symbol") return undefined;
      if (typeof prop !== "string") return undefined;
      return reject;
    },
  });
}
