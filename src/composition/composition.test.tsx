import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createToolsRuntime, splitEnvarlyApi } from "../contracts";
import { fakeToolsRuntime, inst } from "../features/tools/testHarness";
import { useToolsStore } from "../features/tools/useToolsStore";
import { AppServicesProvider, useAppServices } from "./AppServicesContext";

describe("app services composition", () => {
  it("loads Tools inventory through injected services without Tauri", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { effective: true, selected: true });
    const { api } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk]),
      getWhichcraftSettings: vi.fn(async () => ({
        installStore: "C:\\store",
        scanRoots: [],
        terminal: "windows_terminal" as const,
        installStoreConfirmed: true,
      })),
    });
    const services = splitEnvarlyApi(api);

    function wrapper({ children }: { children: ReactNode }) {
      return <AppServicesProvider services={services}>{children}</AppServicesProvider>;
    }

    const { result } = renderHook(
      () => {
        const appServices = useAppServices();
        return useToolsStore("java", createToolsRuntime(appServices));
      },
      { wrapper },
    );

    await act(async () => {
      result.current.dispatch({ type: "refresh" });
    });
    await waitFor(() => expect(result.current.state.installations).toEqual([jdk]));
    expect(result.current.state.settings.installStore).toBe("C:\\store");
  });
});
