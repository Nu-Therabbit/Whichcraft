import type { EnvironmentApi } from "../features/environment/api";
import type { ToolsApi } from "../features/tools/api";
import type { PlatformApi } from "../platform/api";
import type { ConfigurationApi } from "../features/configuration/api";

export type { EnvironmentApi } from "../features/environment/api";
export type { ToolsApi } from "../features/tools/api";
export type { PlatformApi, ToolsPlatformSlice } from "../platform/api";
export type { ToolsRuntime } from "../features/tools/runtime";

/** Combined legacy surface; new code should depend on narrower contracts. */
export type WhichcraftApi = EnvironmentApi & ToolsApi & PlatformApi & ConfigurationApi;

export interface AppServices {
  environment: EnvironmentApi;
  tools: ToolsApi;
  platform: PlatformApi;
  configuration: ConfigurationApi;
}
