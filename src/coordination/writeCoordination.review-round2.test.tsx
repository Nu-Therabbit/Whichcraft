import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../contexts/UndoContext";
import { createToolsRuntime, splitEnvarlyApi } from "../composition/appServices";
import { AppServicesProvider, useAppServices } from "../composition/AppServicesContext";
import { configureProductionServices } from "../composition/createProductionServices";
import { EnvironmentProvider } from "../features/environment/EnvironmentContext";
import { LegacyEnvironmentView } from "../features/environment/LegacyEnvironmentView";
import { DesktopShellApp } from "../features/shell/DesktopShellApp";
import { fakeToolsRuntime, harness, inst, planFor } from "../features/tools/testHarness";
import { initialToolsState } from "../features/tools/model";
import { useToolsStore } from "../features/tools/useToolsStore";
import { useEnvVars } from "../hooks/useEnvVars";
import { useDiff } from "../hooks/useDiff";
import { createWriteCoordinator, type WriteCoordinatorFacade } from "./createWriteCoordinator";
import { WriteCoordinatorProvider, useWriteCoordinator } from "./WriteCoordinatorContext";
import { ENVIRONMENT_PENDING_TOOLS_MESSAGE, WRITE_BUSY_MESSAGE } from "./types";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

const legacyApiExtras = {
  getUnsupportedEnvValues: async () => [],
  validatePaths: async () => [],
  onApplyProgress: async () => () => {},
};

function LegacyHarness() {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const toolsRuntime = useMemo(() => createToolsRuntime(services, coordination), [services, coordination]);
  const { state, dispatch } = useToolsStore("java", toolsRuntime);
  return <LegacyEnvironmentView tools={state} sendTools={dispatch} />;
}

function renderLegacyApp(
  apiOverrides: Parameters<typeof fakeToolsRuntime>[0],
  coordination: WriteCoordinatorFacade = createWriteCoordinator(),
) {
  const { api: fake } = fakeToolsRuntime(apiOverrides);
  configureProductionServices(splitEnvarlyApi(fake));
  return {
    coordination,
    ...render(
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider coordinator={coordination}>
            <EnvironmentProvider>
              <LegacyHarness />
            </EnvironmentProvider>
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    ),
  };
}

describe("write coordination review round 2", () => {
  beforeEach(() => {
    configureProductionServices(null);
  });

  it("fires external-diff cross invalidation only once until the diff clears", async () => {
    const coordination = createWriteCoordinator();
    const invalidate = vi.fn(coordination.invalidate.bind(coordination));
    coordination.invalidate = invalidate;
    const baseline = { user: { A: { value: "1", kind: "String" as const } }, system: {} };
    const changed = { user: { A: { value: "2", kind: "String" as const } }, system: {} };
    const getRegistrySnapshot = vi.fn(async () => changed);
    const environment = {
      getRegistrySnapshot,
    } as unknown as Parameters<typeof useDiff>[0];

    const { result } = renderHook(() =>
      useDiff(environment, async () => {}, () => {
        coordination.invalidate([
          "environment-variables",
          "tools-installations",
          "tools-profiles",
          "tools-shell-check",
          "shell-overview",
        ]);
      }),
    );
    result.current.baselineRef.current = baseline;

    await result.current.checkForExternalChanges();
    await result.current.checkForExternalChanges();
    expect(invalidate).toHaveBeenCalledTimes(1);

    result.current.baselineRef.current = changed;
    await result.current.checkForExternalChanges();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate again when invalidation subscribers refresh after external diff", async () => {
    const baseline = { user: { A: { value: "1", kind: "String" as const } }, system: {} };
    const changed = { user: { A: { value: "2", kind: "String" as const } }, system: {} };
    const coordination = createWriteCoordinator();
    const invalidate = vi.fn(coordination.invalidate.bind(coordination));
    coordination.invalidate = invalidate;

    renderLegacyApp(
      {
        ...legacyApiExtras,
        getEnvVars: async () => [],
        getRegistrySnapshot: vi
          .fn()
          .mockResolvedValueOnce(baseline)
          .mockImplementation(async () => changed),
      },
      coordination,
    );

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: /refresh/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
  });

  it("drops a delayed environment variable read superseded by a newer refresh", async () => {
    const coordination = createWriteCoordinator();
    let releaseFirst: (value: []) => void = () => {};
    const getEnvVars = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<[]>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([
        {
          name: "WINNER",
          value: "yes",
          valueKind: "String" as const,
          scope: "User" as const,
          listSeparator: null,
        },
      ]);
    const environment = { getEnvVars } as unknown as Parameters<typeof useEnvVars>[0];
    const { result } = renderHook(() => useEnvVars(environment, coordination));

    void result.current.refresh();
    void result.current.refresh();
    releaseFirst([]);
    await waitFor(() => expect(result.current.vars[0]?.name).toBe("WINNER"));
  });

  it("does not leave plan.applying true when a late apply is dropped", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
    let releaseApply: (v: { planId: string; stale: boolean; needsElevation: boolean }) => void = () => {};
    const applyToolPlan = vi.fn(
      () =>
        new Promise<{ planId: string; stale: boolean; needsElevation: boolean }>((resolve) => {
          releaseApply = resolve;
        }),
    );
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk]),
      planToolApply: vi.fn(async () => planFor(jdk)),
      applyToolPlan,
      listProfiles: vi.fn(async () => []),
      profileStatus: vi.fn(async (p) => ({ profile: p, matches: true })),
    });
    const h = harness(runtime, {
      tool: "java",
      installations: [jdk],
      plan: { ...initialToolsState().plan, current: planFor(jdk) },
    });
    h.dispatch({ type: "applyPlan" });
    expect(h.state.plan.applying).toBe(true);
    h.dispatch({ type: "selectTool", tool: "node" });
    releaseApply({ planId: "p", stale: false, needsElevation: false });
    await h.settle();
    expect(h.state.plan.applying).toBe(false);
  });

  it("refuses profile apply from the legacy screen while environment edits are staged", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true, available: true });
    const planProfile = vi.fn(async () => planFor(jdk));
    renderLegacyApp({
      ...legacyApiExtras,
      getEnvVars: async () => [],
      listToolInstallations: async () => [jdk],
      listProfiles: vi.fn(async () => [
        {
          id: "prof-1",
          name: "Work",
          tools: [{ tool: "java", vendor: "Oracle", version: "21.0.12", preferredRoot: "C:\\jdk21" }],
        },
      ]),
      profileStatus: vi.fn(async (p) => ({ profile: p, matchesEffective: false, unavailable: [] })),
      planProfile,
      parseImport: async () => ({
        user: { STAGED: { value: "1", kind: "String" as const } },
        system: {},
      }),
      getRegistrySnapshot: async () => ({ user: {}, system: {} }),
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: /import \/ export/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /import \/ export/i }));
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    fireEvent.change(screen.getByPlaceholderText(/paste file contents/i), {
      target: { value: '{"user":{},"system":{}}' },
    });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await user.click(await screen.findByRole("button", { name: /stage 1 variable/i }));

    await user.click(screen.getByRole("button", { name: /developer tools/i }));
    await user.click(screen.getByRole("button", { name: /^profiles$/i }));
    await waitFor(() => expect(screen.getByText("Work")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(screen.getByText(ENVIRONMENT_PENDING_TOOLS_MESSAGE)).toBeInTheDocument());
    expect(planProfile).not.toHaveBeenCalled();
  });

  it("shows applyError when external diff apply is denied while another write holds admission", async () => {
    const baseline = { user: { EXT: { value: "1", kind: "String" as const } }, system: {} };
    const current = { user: { EXT: { value: "2", kind: "String" as const } }, system: {} };
    const coordination = createWriteCoordinator();
    renderLegacyApp(
      {
        ...legacyApiExtras,
        getEnvVars: async () => [],
        getRegistrySnapshot: vi
          .fn()
          .mockResolvedValueOnce(baseline)
          .mockImplementation(async () => current),
        setEnvVar: async () => {},
        deleteEnvVar: async () => {},
        parseImport: async () => ({ user: {}, system: {} }),
      },
      coordination,
    );

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: /refresh/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const gate = coordination.tryBeginEnvironmentWrite("apply-staged");
    expect(gate.ok).toBe(true);
    await user.click(screen.getByRole("button", { name: /Apply \(1 accepted/i }));
    await waitFor(() => expect(screen.getByText(WRITE_BUSY_MESSAGE)).toBeInTheDocument());
    if (gate.ok) coordination.endEnvironmentWrite(gate.admission, "cancel");
  });

  it("updates coordinator account token on desktop shell rescan when account sid changes", async () => {
    const coordination = createWriteCoordinator();
    const account = {
      sid: "S-1-2-3",
      username: "tester",
      hasProfile: true,
      currentlyLoggedIn: true,
    };
    const getSelectedAccount = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(account)
      .mockResolvedValue(account);
    const { api: fake } = fakeToolsRuntime({
      getSelectedAccount,
      listToolInstallations: async () => [],
      getPythonLauncherInfo: async () => ({
        launcherLines: [],
        launcherInstalled: false,
        storeStub: null,
        note: "",
      }),
      getAndroidInventory: async () => ({
        sdkRoot: null,
        rootSource: null,
        platforms: [],
        buildTools: [],
        ndk: [],
        platformTools: null,
        emulator: null,
        cmake: [],
      }),
      getMsvcInventory: async () => ({ instances: [], windowsSdks: [] }),
    });
    configureProductionServices(splitEnvarlyApi(fake));

    render(
      <AppServicesProvider>
        <WriteCoordinatorProvider coordinator={coordination}>
          <DesktopShellApp />
        </WriteCoordinatorProvider>
      </AppServicesProvider>,
    );

    await waitFor(() => expect(getSelectedAccount).toHaveBeenCalled());
    expect(coordination.getAccountToken()).toBe("local");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^rescan$/i }));
    await waitFor(() => expect(coordination.getAccountToken()).toBe("S-1-2-3"));
  });
});
