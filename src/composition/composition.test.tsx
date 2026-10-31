import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { splitWhichcraftApi } from "./appServices";
import { fakeToolsRuntime, inst } from "../test/toolsTestHarness";
import { useToolsStore } from "../features/tools/useToolsStore";
import { AppServicesProvider } from "./AppServicesContext";

describe("app services composition", () => {
  it("loads Tools inventory through injected services without Tauri", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { effective: true, selected: true });
    const { api, runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk]),
      getWhichcraftSettings: vi.fn(async () => ({
        installStore: "C:\\store",
        scanRoots: [],
        terminal: "windows_terminal" as const,
        installStoreConfirmed: true,
      })),
    });
    const services = splitWhichcraftApi(api);

    function wrapper({ children }: { children: ReactNode }) {
      return <AppServicesProvider services={services}>{children}</AppServicesProvider>;
    }

    const { result } = renderHook(() => useToolsStore("java", runtime), { wrapper });

    await act(async () => {
      result.current.dispatch({ type: "refresh" });
    });
    await waitFor(() => expect(result.current.state.installations).toEqual([jdk]));
    expect(result.current.state.settings.installStore).toBe("C:\\store");
  });
});
