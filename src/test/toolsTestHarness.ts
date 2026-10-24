import { vi } from "vitest";
import type { EnvarlyApi } from "../contracts";
import { createToolsRuntime, splitEnvarlyApi } from "../composition/appServices";
import { createIsolatedWriteCoordinator } from "../coordination/WriteCoordinatorContext";
import type { WriteCoordinatorFacade } from "../coordination/createWriteCoordinator";
import type { ToolsRuntime } from "../features/tools/runtime";
import type { ToolApplyPlan, ToolInstallationRef, ToolInstallationView, ToolKind } from "../features/tools/types";
import { runEffects } from "../features/tools/effects";
import { isIntent, type ToolsIntent, type ToolsMsg } from "../features/tools/messages";
import { initialToolsState, type ToolsState } from "../features/tools/model";
import { reduce } from "../features/tools/reduce";

/** An API whose every call fails unless a test provides it, so unexpected calls show up. */
export function fakeApi(overrides: Partial<EnvarlyApi>): EnvarlyApi {
  const base = {
    getEnvVars: vi.fn(async () => []),
    getUnsupportedEnvValues: vi.fn(async () => []),
    getRegistrySnapshot: vi.fn(async () => ({ user: [], system: [] })),
    listLocalAccounts: vi.fn(async () => []),
    getSelectedAccount: vi.fn(async () => null),
    getPathStatus: vi.fn(async () => ({
      installDir: "",
      userHasEntry: false,
      systemHasEntry: false,
      otherUserHasEntry: null,
    })),
    isElevated: vi.fn(async () => false),
    checkForUpdate: vi.fn(async () => null),
    openUrl: vi.fn(async () => {}),
    pickFolder: vi.fn(async () => null),
    getRecoveryStatus: vi.fn(async () => null),
    unfinishedUninstalls: vi.fn(async () => []),
    getWhichcraftSettings: vi.fn(async () => ({
      installStore: "C:\\store",
      scanRoots: [],
      terminal: "windows_terminal" as const,
      installStoreConfirmed: true,
    })),
    listToolInstallations: vi.fn(async () => []),
    getPythonLauncherInfo: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
  return new Proxy({ ...base, ...overrides } as EnvarlyApi, {
    get(target, key) {
      if (key === "then") return undefined;
      if (key in target) return target[key as keyof EnvarlyApi];
      return async () => {
        throw new Error(`unexpected api call: ${String(key)}`);
      };
    },
  });
}

export function fakeToolsRuntime(
  overrides: Partial<EnvarlyApi> = {},
  coordination: WriteCoordinatorFacade = createIsolatedWriteCoordinator(),
): {
  runtime: ToolsRuntime;
  api: EnvarlyApi;
  coordination: WriteCoordinatorFacade;
} {
  const api = fakeApi(overrides);
  return { runtime: createToolsRuntime(splitEnvarlyApi(api), coordination), api, coordination };
}

/** Runs the reducer and effects the way useToolsStore does, and waits for all effects. */
export function harness(runtime: ToolsRuntime, start: Partial<ToolsState> = {}) {
  const initial = { ...initialToolsState(), ...start };
  if (initial.plan.current) {
    runtime.coordination.registerReviewedPlan(initial.plan.current);
  }
  let state: ToolsState = initial;
  const log: ToolsMsg[] = [];
  const pending = new Set<Promise<void>>();
  const dispatch = (msg: ToolsMsg) => {
    const before = state;
    state = reduce(before, msg);
    log.push(msg);
    if (isIntent(msg)) {
      const p = runEffects(msg, {
        state: before,
        getState: () => state,
        dispatch,
        runtime,
        newId: () => "new-id",
      });
      pending.add(p);
      void p.finally(() => pending.delete(p));
    }
  };

  return {
    get state() {
      return state;
    },
    log,
    dispatch: (intent: ToolsIntent) => dispatch(intent),
    async settle() {
      while (pending.size > 0) await Promise.all([...pending]);
    },
  };
}

export function inst(
  tool: ToolKind,
  version: string,
  root: string,
  extra: Partial<ToolInstallationView> = {},
): ToolInstallationView {
  return {
    tool,
    vendor: tool === "java" ? "Eclipse Adoptium" : "Node.js",
    version,
    root,
    managed: false,
    effective: false,
    selected: false,
    available: true,
    installerKind: "folder_only",
    mismatchReason: null,
    ...extra,
  };
}

export function planFor(selected: ToolInstallationRef, extra: Partial<ToolApplyPlan> = {}): ToolApplyPlan {
  return {
    planId: `plan-${selected.root}`,
    tool: selected.tool,
    requiresUac: false,
    warnings: [],
    limitationNotice: "",
    userDiffs: [],
    systemDiffs: [],
    effectiveAfterUserOnly: true,
    selected,
    ...extra,
  };
}
