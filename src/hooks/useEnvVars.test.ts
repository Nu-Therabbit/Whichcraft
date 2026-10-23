import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvironmentApi } from "../features/environment/api";
import { useEnvVars } from "./useEnvVars";

const SAMPLE = [{ name: "PATH", value: "C:\\Windows", scope: "User" as const, listSeparator: ";" }];

function makeEnvironment(): EnvironmentApi {
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
  };
}

describe("useEnvVars", () => {
  let environment: EnvironmentApi;

  beforeEach(() => {
    environment = makeEnvironment();
    vi.clearAllMocks();
  });

  it("starts with loading false and empty vars", () => {
    vi.mocked(environment.getEnvVars).mockResolvedValue([]);
    const { result } = renderHook(() => useEnvVars(environment));
    expect(result.current.vars).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("sets loading=true while fetching, then populates vars", async () => {
    vi.mocked(environment.getEnvVars).mockResolvedValue(SAMPLE);
    const { result } = renderHook(() => useEnvVars(environment));
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.vars).toEqual(SAMPLE);
    });
  });

  it("captures error on failure", async () => {
    vi.mocked(environment.getEnvVars).mockRejectedValue("registry error");
    const { result } = renderHook(() => useEnvVars(environment));
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.error).toBe("registry error");
      expect(result.current.loading).toBe(false);
    });
  });
});
