import type { EnvironmentApi } from "./environment";
import type { PlatformApi } from "./platform";
import type { ToolsApi } from "./tools";

export type { EnvironmentApi } from "./environment";
export type { PlatformApi } from "./platform";
export type { ToolsApi } from "./tools";

/** Combined legacy surface; new code should depend on narrower contracts. */
export type EnvarlyApi = EnvironmentApi & ToolsApi & PlatformApi;

export interface AppServices {
  environment: EnvironmentApi;
  tools: ToolsApi;
  platform: PlatformApi;
}

/** Platform capabilities the Tools controller needs without the full PlatformApi. */
export type ToolsPlatformSlice = Pick<
  PlatformApi,
  "getWhichcraftSettings" | "saveWhichcraftSettings" | "openTerminal" | "openFolder"
>;

/** Narrow dependency passed into Tools MVI effects. */
export interface ToolsRuntime {
  tools: ToolsApi;
  platform: ToolsPlatformSlice;
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
    environment: full,
    tools: full,
    platform: full,
  };
}

export function createToolsRuntime(services: AppServices): ToolsRuntime {
  const { platform } = services;
  return {
    tools: services.tools,
    platform: {
      getWhichcraftSettings: platform.getWhichcraftSettings.bind(platform),
      saveWhichcraftSettings: platform.saveWhichcraftSettings.bind(platform),
      openTerminal: platform.openTerminal.bind(platform),
      openFolder: platform.openFolder.bind(platform),
    },
  };
}
