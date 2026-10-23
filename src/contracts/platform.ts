import type { LaunchOptions, UpdateInfo, WhichcraftSettings } from "../platform/types";

/** Type-only contract for app shell, elevation, settings, and OS helpers. */
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
