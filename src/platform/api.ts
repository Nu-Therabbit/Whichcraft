import type { LaunchOptions, UpdateInfo, WhichcraftSettings } from "./types";

export interface PlatformApi {
  getLaunchOptions: () => Promise<LaunchOptions>;
  isElevated: () => Promise<boolean>;
  restartAsAdmin: () => Promise<void>;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  openFolder: (path: string) => Promise<void>;
  openTerminal: () => Promise<void>;
  getWhichcraftSettings: () => Promise<WhichcraftSettings>;
  saveWhichcraftSettings: (settings: WhichcraftSettings) => Promise<void>;
}

export type ToolsPlatformSlice = Pick<
  PlatformApi,
  "getWhichcraftSettings" | "saveWhichcraftSettings" | "openTerminal" | "openFolder"
>;
