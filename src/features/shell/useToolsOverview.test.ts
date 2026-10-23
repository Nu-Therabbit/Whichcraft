import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EnvironmentApi } from "../environment/api";
import type { ToolsApi } from "../tools/api";
import type { ToolInstallationView } from "../tools/types";
import { OVERVIEW_TOOL_KINDS } from "./overviewTools";
import { useToolsOverview } from "./useToolsOverview";

function makeEnvironment(overrides: Partial<EnvironmentApi> = {}): EnvironmentApi {
  return {
    getEnvVars: vi.fn(),
    getUnsupportedEnvValues: vi.fn(),
    setEnvVar: vi.fn(),
    deleteEnvVar: vi.fn(),
    applyEnvChanges: vi.fn(),
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    renameSnapshot: vi.fn(),
    deleteSnapshot: vi.fn(),
    validatePaths: vi.fn(),
    getRegistrySnapshot: vi.fn(),
    exportVars: vi.fn(),
    exportCustomVars: vi.fn(),
    parseImport: vi.fn(),
    getPathStatus: vi.fn(),
    getPathProposal: vi.fn(),
    checkCommand: vi.fn(),
    listLocalAccounts: vi.fn(),
    selectAccount: vi.fn(),
    getSelectedAccount: vi.fn(),
    onApplyProgress: vi.fn(),
    ...overrides,
  };
}

function makeTools(overrides: Partial<ToolsApi> = {}): ToolsApi {
  return {
    listToolInstallations: vi.fn(async () => []),
    getPythonLauncherInfo: vi.fn(async () => ({
      launcherLines: [],
      launcherInstalled: false,
      storeStub: null,
      note: "",
    })),
    getAndroidInventory: vi.fn(async () => ({
      sdkRoot: null,
      rootSource: null,
      platforms: [],
      buildTools: [],
      ndk: [],
      platformTools: null,
      emulator: null,
      cmake: [],
    })),
    getMsvcInventory: vi.fn(async () => ({ instances: [], windowsSdks: [] })),
    ...overrides,
  } as ToolsApi;
}

describe("useToolsOverview rescan identity", () => {
  it("drops stale inventory when a newer rescan wins and clears abandoned loading", async () => {
    let unblockFirstAccount!: (value: { sid: string } | null) => void;
    let unblockStaleJava!: (value: ToolInstallationView[]) => void;

    const getSelectedAccount = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ sid: string } | null>((resolve) => {
            unblockFirstAccount = resolve;
          }),
      )
      .mockImplementation(async () => ({ sid: "account-new" }));

    let javaLoads = 0;
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool === "java") {
        javaLoads += 1;
        if (javaLoads === 1) {
          return new Promise<ToolInstallationView[]>((resolve) => {
            unblockStaleJava = resolve;
          });
        }
      }
      return [];
    });

    const environment = makeEnvironment({ getSelectedAccount });
    const toolsApi = makeTools({ listToolInstallations });

    const { result } = renderHook(() => useToolsOverview(toolsApi, environment));

    await act(async () => {
      unblockFirstAccount({ sid: "account-old" });
    });

    await waitFor(() => {
      expect(result.current.byTool.java.inFlightRequestId).toBe(1);
    });

    await act(async () => {
      await result.current.rescan();
    });

    await waitFor(() => {
      expect(result.current.byTool.java.boundAccountToken).toBe("account-new");
      expect(result.current.byTool.java.loading).toBe(false);
      expect(result.current.byTool.java.installations).toEqual([]);
    });

    await act(async () => {
      unblockStaleJava([
        {
          tool: "java",
          vendor: "Stale",
          version: "1.0",
          root: "C:\\stale",
          managed: false,
          effective: true,
          selected: true,
          available: true,
          installerKind: "folder_only",
          mismatchReason: null,
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.byTool.java.boundAccountToken).toBe("account-new");
      expect(result.current.byTool.java.installations).toEqual([]);
      expect(result.current.byTool.java.loading).toBe(false);
    });

    expect(OVERVIEW_TOOL_KINDS.every((tool) => !result.current.byTool[tool].loading)).toBe(true);
  });

  it("keeps account error when a stale list resolves after a newer account failure", async () => {
    let unblockStaleJava!: (value: ToolInstallationView[]) => void;

    const getSelectedAccount = vi
      .fn()
      .mockImplementationOnce(async () => ({ sid: "account-old" }))
      .mockImplementationOnce(async () => {
        throw new Error("account read failed on retry");
      });

    let javaLoads = 0;
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool === "java") {
        javaLoads += 1;
        if (javaLoads === 1) {
          return new Promise<ToolInstallationView[]>((resolve) => {
            unblockStaleJava = resolve;
          });
        }
      }
      return [];
    });

    const environment = makeEnvironment({ getSelectedAccount });
    const toolsApi = makeTools({ listToolInstallations });

    const { result } = renderHook(() => useToolsOverview(toolsApi, environment));

    await waitFor(() => {
      expect(result.current.byTool.java.inFlightRequestId).toBe(1);
    });

    await act(async () => {
      await result.current.rescan();
    });

    await waitFor(() => {
      expect(result.current.accountError).toMatch(/account read failed on retry/);
      expect(result.current.sdkLoading).toBe(false);
      expect(result.current.byTool.java.error).toMatch(/account read failed on retry/);
    });

    await act(async () => {
      unblockStaleJava([
        {
          tool: "java",
          vendor: "Stale",
          version: "9.9",
          root: "C:\\stale-after-account-fail",
          managed: false,
          effective: true,
          selected: true,
          available: true,
          installerKind: "folder_only",
          mismatchReason: null,
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.accountError).toMatch(/account read failed on retry/);
      expect(result.current.byTool.java.installations).toEqual([]);
      expect(result.current.byTool.java.error).toMatch(/account read failed on retry/);
      expect(result.current.byTool.java.boundRequestId).toBe(0);
    });
  });

  it("surfaces account read failures instead of assuming local context", async () => {
    const getSelectedAccount = vi.fn(async () => {
      throw new Error("account hive unavailable");
    });
    const environment = makeEnvironment({ getSelectedAccount });
    const toolsApi = makeTools();

    const { result } = renderHook(() => useToolsOverview(toolsApi, environment));

    await waitFor(() => {
      expect(result.current.accountError).toMatch(/account hive unavailable/);
      expect(result.current.byTool.java.error).toMatch(/account hive unavailable/);
      expect(result.current.byTool.java.loading).toBe(false);
    });
  });
});
