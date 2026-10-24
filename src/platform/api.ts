import type { LaunchOptions, UpdateInfo, WhichcraftSettings } from "./types";

export interface PlatformApi {
  getLaunchOptions: () => Promise<LaunchOptions>;
  isElevated: () => Promise<boolean>;
  restartAsAdmin: () => Promise<void>;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  /** Opens a web page in the user's default browser. */
  openUrl: (url: string) => Promise<void>;
  /** Native folder picker; null when the user cancels. */
  pickFolder: (defaultPath?: string) => Promise<string | null>;
  openFolder: (path: string) => Promise<void>;
  openTerminal: () => Promise<void>;
  getWhichcraftSettings: () => Promise<WhichcraftSettings>;
  saveWhichcraftSettings: (settings: WhichcraftSettings) => Promise<void>;
}

export type ToolsPlatformSlice = Pick<
  PlatformApi,
  "getWhichcraftSettings" | "saveWhichcraftSettings" | "openTerminal" | "openFolder"
>;
