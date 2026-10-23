import type { ToolsPlatformSlice } from "../../platform/api";
import type { ToolsApi } from "./api";

export interface ToolsRuntime {
  tools: ToolsApi;
  platform: ToolsPlatformSlice;
}
