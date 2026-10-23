import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvironmentApi } from "../features/environment/api";
import type { ApplyProgressEvent } from "../types";
import { useApplyStaged } from "./useApplyStaged";
import type { StagedChange } from "./useStaged";

function makeStaged(entries: Array<[string, StagedChange]> = []): Map<string, StagedChange> {
  return new Map(entries);
}

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
    onApplyProgress: vi.fn(async () => () => {}),
  };
}

function makeParams(
  environment: EnvironmentApi,
  overrides: Partial<Parameters<typeof useApplyStaged>[0]> = {},
) {
  return {
    environment,
    staged: makeStaged(),
    clearStaged: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshPathStatus: vi.fn().mockResolvedValue(undefined),
    baselineRef: { current: null },
    ...overrides,
  };
}

describe("useApplyStaged", () => {
  let environment: EnvironmentApi;

  beforeEach(() => {
    environment = makeEnvironment();
    vi.clearAllMocks();
    vi.mocked(environment.setEnvVar).mockResolvedValue(undefined);
    vi.mocked(environment.deleteEnvVar).mockResolvedValue(undefined);
    vi.mocked(environment.applyEnvChanges).mockResolvedValue(undefined);
    vi.mocked(environment.createSnapshot).mockResolvedValue(undefined);
    vi.mocked(environment.getRegistrySnapshot).mockResolvedValue({ user: {}, system: {} });
  });

  it("sends all staged changes through the atomic apply command", async () => {
    const change: StagedChange = {
      kind: "set",
      name: "A",
      scope: "User",
      originalValue: null,
      originalValueKind: null,
      newValue: "1",
      newValueKind: "String",
    };
    const params = makeParams(environment, { staged: makeStaged([["User:A", change]]) });
    const { result } = renderHook(() => useApplyStaged(params));
    await act(async () => {
      await result.current.handleApplyStaged(false);
    });
    expect(environment.applyEnvChanges).toHaveBeenCalledWith([
      {
        changeType: "set",
        name: "A",
        value: "1",
        valueKind: "String",
        scope: "User",
      },
    ]);
  });

  it("calls deleteEnvVar for each delete change", async () => {
    const change: StagedChange = {
      kind: "delete",
      name: "B",
      scope: "System",
      originalValue: "old",
      originalValueKind: "String",
      newValue: null,
    };
    const params = makeParams(environment, { staged: makeStaged([["System:B", change]]) });
    const { result } = renderHook(() => useApplyStaged(params));
    await act(async () => {
      await result.current.handleApplyStaged(false);
    });
    expect(environment.applyEnvChanges).toHaveBeenCalledWith([
      { changeType: "delete", name: "B", scope: "System" },
    ]);
  });

  it("does not create snapshots in the frontend because atomic apply does it", async () => {
    const params = makeParams(environment);
    const { result } = renderHook(() => useApplyStaged(params));
    await act(async () => {
      await result.current.handleApplyStaged(true);
    });
    expect(environment.createSnapshot).not.toHaveBeenCalled();
  });

  it("returns true and calls clearStaged on success", async () => {
    const params = makeParams(environment);
    const { result } = renderHook(() => useApplyStaged(params));
    let ok = false;
    await act(async () => {
      ok = await result.current.handleApplyStaged(false);
    });
    expect(ok).toBe(true);
    expect(params.clearStaged).toHaveBeenCalledTimes(1);
  });

  it("refreshes before returning success", async () => {
    const callOrder: string[] = [];
    const params = makeParams(environment, {
      refresh: vi.fn().mockImplementation(async () => {
        callOrder.push("refresh");
      }),
      refreshPathStatus: vi.fn().mockImplementation(async () => {
        callOrder.push("refreshPathStatus");
      }),
    });
    const { result } = renderHook(() => useApplyStaged(params));

    await act(async () => {
      await result.current.handleApplyStaged(false);
    });

    expect(callOrder).toEqual(["refresh", "refreshPathStatus"]);
  });

  it("returns false and exposes the error when apply fails", async () => {
    vi.mocked(environment.applyEnvChanges).mockRejectedValue("Registry error: access denied");
    const params = makeParams(environment);
    const { result } = renderHook(() => useApplyStaged(params));

    let ok = true;
    await act(async () => {
      ok = await result.current.handleApplyStaged(false);
    });

    expect(ok).toBe(false);
    expect(params.clearStaged).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Registry error: access denied");
  });

  it("busy is true during apply and false after", async () => {
    let resolveFn!: () => void;
    vi.mocked(environment.applyEnvChanges).mockReturnValue(
      new Promise<void>((r) => {
        resolveFn = r;
      }),
    );
    const change: StagedChange = {
      kind: "set",
      name: "A",
      scope: "User",
      originalValue: null,
      originalValueKind: null,
      newValue: "v",
      newValueKind: "String",
    };
    const params = makeParams(environment, { staged: makeStaged([["User:A", change]]) });
    const { result } = renderHook(() => useApplyStaged(params));

    let applyPromise: Promise<boolean>;
    act(() => {
      applyPromise = result.current.handleApplyStaged(false);
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      resolveFn();
      await applyPromise;
    });
    expect(result.current.busy).toBe(false);
  });

  it("tracks progress and log from apply-progress events, then unsubscribes", async () => {
    let capturedCallback: ((event: ApplyProgressEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    vi.mocked(environment.onApplyProgress).mockImplementation(async (cb) => {
      capturedCallback = cb;
      return unsubscribe;
    });
    const change: StagedChange = {
      kind: "set",
      name: "A",
      scope: "User",
      originalValue: null,
      originalValueKind: null,
      newValue: "1",
      newValueKind: "String",
    };
    const params = makeParams(environment, { staged: makeStaged([["User:A", change]]) });
    const { result } = renderHook(() => useApplyStaged(params));

    await act(async () => {
      const promise = result.current.handleApplyStaged(false);
      capturedCallback?.({
        index: 0,
        total: 1,
        name: "A",
        scope: "User",
        action: "set",
        success: true,
        error: null,
      });
      await promise;
    });

    expect(result.current.progress).toEqual({ index: 0, total: 1 });
    expect(result.current.log).toHaveLength(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("clears busy and reports error when progress subscription fails", async () => {
    vi.mocked(environment.onApplyProgress).mockRejectedValue(new Error("listen failed"));
    const params = makeParams(environment);
    const { result } = renderHook(() => useApplyStaged(params));

    let ok = true;
    await act(async () => {
      ok = await result.current.handleApplyStaged(false);
    });

    expect(ok).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe("Error: listen failed");
    expect(environment.applyEnvChanges).not.toHaveBeenCalled();
  });
});
