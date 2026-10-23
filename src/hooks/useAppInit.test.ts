import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvironmentApi } from "../features/environment/api";
import { useAppInit } from "./useAppInit";

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

function makeParams(overrides: Partial<Parameters<typeof useAppInit>[0]> = {}) {
  const environment = makeEnvironment();
  return {
    environment,
    platform: { isElevated: vi.fn().mockResolvedValue(false) },
    baselineRef: { current: null },
    setElevated: vi.fn(),
    refreshPathStatus: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    checkForExternalChanges: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("useAppInit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getRegistrySnapshot and stores result in baselineRef on mount", async () => {
    const snapshot = { user: { FOO: { value: "bar", kind: "String" as const } }, system: {} };
    const params = makeParams();
    vi.mocked(params.environment.getRegistrySnapshot).mockResolvedValue(snapshot);
    renderHook(() => useAppInit(params));
    await waitFor(() => expect(params.environment.getRegistrySnapshot).toHaveBeenCalledTimes(1));
    expect(params.baselineRef.current).toEqual(snapshot);
  });

  it("calls isElevated and passes result to setElevated on mount", async () => {
    const params = makeParams({
      platform: { isElevated: vi.fn().mockResolvedValue(true) },
    });
    renderHook(() => useAppInit(params));
    await waitFor(() => expect(params.setElevated).toHaveBeenCalledWith(true));
  });

  it("calls refreshPathStatus and refresh on mount", async () => {
    const params = makeParams();
    renderHook(() => useAppInit(params));
    await waitFor(() => expect(params.refresh).toHaveBeenCalled());
    expect(params.refreshPathStatus).toHaveBeenCalledTimes(1);
  });

  it("handleRefresh calls refresh and checkForExternalChanges", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useAppInit(params));
    await act(async () => {
      await result.current.handleRefresh();
    });
    expect(params.refresh).toHaveBeenCalled();
    expect(params.checkForExternalChanges).toHaveBeenCalledTimes(1);
  });

  it("continues mount sequence even if getRegistrySnapshot throws", async () => {
    const params = makeParams();
    vi.mocked(params.environment.getRegistrySnapshot).mockRejectedValue(new Error("fail"));
    renderHook(() => useAppInit(params));
    await waitFor(() => expect(params.refresh).toHaveBeenCalled());
    expect(params.setElevated).toHaveBeenCalled();
  });

  it("initializing is true until refresh resolves, then false", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useAppInit(params));
    expect(result.current.initializing).toBe(true);
    await waitFor(() => expect(result.current.initializing).toBe(false));
  });
});
