import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServices } from "./contracts";
import { api, resetLegacyApiFacadeForTests, wireLegacyApiFacade } from "./api";
import { configureProductionServices } from "./composition/createProductionServices";
import { fakeApi } from "./features/tools/testHarness";
import type { ApplyProgressEvent } from "./types";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("api runtime detection", () => {
  beforeEach(() => {
    resetLegacyApiFacadeForTests();
    configureProductionServices(null);
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it("explains how to start the app when opened without Tauri", async () => {
    await expect(api.getEnvVars()).rejects.toThrow(
      "Tauri runtime unavailable. Start Envarly with `npm run dev`.",
    );
  });
});

describe("api.onApplyProgress", () => {
  beforeEach(() => {
    resetLegacyApiFacadeForTests();
    configureProductionServices(null);
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "get_launch_options") return { demo: false, demoFixture: null };
      return undefined;
    });
  });

  it("subscribes via listen and forwards event payloads to the callback", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);

    const callback = vi.fn();
    const unsubscribe = await api.onApplyProgress(callback);

    expect(listen).toHaveBeenCalledWith("apply-progress", expect.any(Function));

    const event: ApplyProgressEvent = {
      index: 0,
      total: 1,
      name: "FOO",
      scope: "User",
      action: "set",
      success: true,
      error: null,
    };
    const [, handler] = vi.mocked(listen).mock.calls[0];
    handler({ event: "apply-progress", id: 1, payload: event });
    expect(callback).toHaveBeenCalledWith(event);

    unsubscribe();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});

describe("resolveLegacyApi", () => {
  beforeEach(() => {
    resetLegacyApiFacadeForTests();
    configureProductionServices(null);
  });

  it("keeps a wired override when production resolution finishes later", async () => {
    let resolveProduction!: (services: AppServices) => void;
    configureProductionServices(
      new Promise<AppServices>((resolve) => {
        resolveProduction = resolve;
      }),
    );

    const productionGet = vi.fn(async () => [
      {
        name: "PROD",
        value: "x",
        scope: "User" as const,
        valueKind: "String" as const,
        listSeparator: null,
      },
    ]);
    const overrideGet = vi.fn(async () => []);

    const pending = api.getEnvVars();
    wireLegacyApiFacade(fakeApi({ getEnvVars: overrideGet }));
    resolveProduction({
      environment: { getEnvVars: productionGet } as AppServices["environment"],
      tools: {} as AppServices["tools"],
      platform: {} as AppServices["platform"],
    });

    await expect(pending).resolves.toEqual([]);
    expect(overrideGet).toHaveBeenCalledTimes(1);
    expect(productionGet).not.toHaveBeenCalled();
  });
});
