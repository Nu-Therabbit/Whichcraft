import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvironmentApi } from "../features/environment/api";
import type { DiffEntry } from "../lib/diff";
import { useDiff } from "./useDiff";

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

describe("useDiff", () => {
  let environment: EnvironmentApi;

  beforeEach(() => {
    environment = makeEnvironment();
    vi.clearAllMocks();
    vi.mocked(environment.setEnvVar).mockResolvedValue(undefined);
    vi.mocked(environment.deleteEnvVar).mockResolvedValue(undefined);
  });

  it("returns true only after refresh resolves", async () => {
    const callOrder: string[] = [];
    const refresh = vi.fn().mockImplementation(async () => {
      callOrder.push("refresh");
    });
    const { result } = renderHook(() => useDiff(environment, refresh));

    let ok = false;
    await act(async () => {
      ok = await result.current.handleDiffApply([], []);
    });

    expect(ok).toBe(true);
    expect(callOrder).toEqual(["refresh"]);
  });

  it("reverts added entries by deleting them", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDiff(environment, refresh));

    const added: DiffEntry = {
      kind: "added",
      name: "NEW_VAR",
      scope: "User",
      value: "x",
      valueKind: "String",
    };
    await act(async () => {
      await result.current.handleDiffApply([], [added]);
    });

    expect(environment.deleteEnvVar).toHaveBeenCalledWith("NEW_VAR", "User");
  });

  it("reverts removed entries by restoring the old value", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDiff(environment, refresh));

    const removed: DiffEntry = {
      kind: "removed",
      name: "OLD_VAR",
      scope: "System",
      value: "gone",
      valueKind: "String",
    };
    await act(async () => {
      await result.current.handleDiffApply([], [removed]);
    });

    expect(environment.setEnvVar).toHaveBeenCalledWith("OLD_VAR", "gone", "String", "System");
  });

  it("returns false and exposes the error when reverting fails", async () => {
    vi.mocked(environment.deleteEnvVar).mockRejectedValue(new Error("access denied"));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDiff(environment, refresh));

    const added: DiffEntry = {
      kind: "added",
      name: "NEW_VAR",
      scope: "User",
      value: "x",
      valueKind: "String",
    };
    let ok = true;
    await act(async () => {
      ok = await result.current.handleDiffApply([], [added]);
    });

    expect(ok).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(result.current.applyError).toBe("Error: access denied");
  });

  it("checkForExternalChanges populates diffEntries when the registry differs from baseline", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDiff(environment, refresh));

    result.current.baselineRef.current = { user: {}, system: {} };
    vi.mocked(environment.getRegistrySnapshot).mockResolvedValue({
      user: { FOO: { value: "bar", kind: "String" } },
      system: {},
    });

    await act(async () => {
      await result.current.checkForExternalChanges();
    });

    expect(result.current.diffEntries).toEqual([
      { kind: "added", name: "FOO", scope: "User", value: "bar", valueKind: "String" },
    ]);
  });

  it("handleDiffDismiss clears diff entries and error", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDiff(environment, refresh));

    result.current.baselineRef.current = { user: {}, system: {} };
    vi.mocked(environment.getRegistrySnapshot).mockResolvedValue({
      user: { FOO: { value: "bar", kind: "String" } },
      system: {},
    });
    await act(async () => {
      await result.current.checkForExternalChanges();
    });
    expect(result.current.diffEntries.length).toBe(1);

    act(() => {
      result.current.handleDiffDismiss();
    });

    expect(result.current.diffEntries).toEqual([]);
    expect(result.current.applyError).toBeNull();
  });
});
