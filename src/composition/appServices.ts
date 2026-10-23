import type { ToolsRuntime } from "../features/tools/runtime";
import type { AppServices, EnvarlyApi } from "../contracts";
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

export function mergeEnvarlyApi(services: AppServices): EnvarlyApi {
  return {
    ...services.environment,
    ...services.tools,
    ...services.platform,
  };
}

export function splitEnvarlyApi(full: EnvarlyApi): AppServices {
  return {
    environment: pickMethods(full, ENVIRONMENT_API_KEYS),
    tools: pickMethods(full, TOOLS_API_KEYS),
    platform: pickMethods(full, PLATFORM_API_KEYS),
  };
}

export function createToolsRuntime(services: AppServices): ToolsRuntime {
  return {
    tools: services.tools,
    platform: pickMethods(services.platform, TOOLS_PLATFORM_SLICE_KEYS),
  };
}

export function createUnavailableEnvarlyApi(message: string): EnvarlyApi {
  const reject = () => Promise.reject(new Error(message));
  return new Proxy({} as EnvarlyApi, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return reject;
    },
  });
}
