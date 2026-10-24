import { vi } from "vitest";
import type { PlatformApi } from "../platform/api";

/** A PlatformApi whose native calls do nothing unless a test overrides them. */
export function fakePlatformApi(overrides: Partial<PlatformApi> = {}): PlatformApi {
  return {
    getLaunchOptions: vi.fn(async () => ({ demo: false, demoFixture: null })),
    isElevated: vi.fn(async () => false),
    restartAsAdmin: vi.fn(async () => {}),
    checkForUpdate: vi.fn(async () => null),
    openUrl: vi.fn(async () => {}),
    pickFolder: vi.fn(async () => null),
    openFolder: vi.fn(async () => {}),
    openTerminal: vi.fn(async () => {}),
    getWhichcraftSettings: vi.fn(async () => ({
      installStore: "C:\\store",
      scanRoots: [],
      terminal: "windows_terminal" as const,
    })),
    saveWhichcraftSettings: vi.fn(async () => {}),
    ...overrides,
  };
}
