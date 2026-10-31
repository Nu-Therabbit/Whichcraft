import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { splitWhichcraftApi } from "../../composition/appServices";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { ENVIRONMENT_PENDING_TOOLS_MESSAGE } from "../../coordination/types";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
import { fakeToolsRuntime, inst, planFor } from "../../test/toolsTestHarness";
import { DesktopShellApp } from "./DesktopShellApp";

const javaPin = {
  tool: "java" as const,
  vendor: "Eclipse Adoptium",
  version: "17.0.2",
  preferredRoot: "C:\\jdk17",
};
const nodePin = {
  tool: "node" as const,
  vendor: "Node.js",
  version: "20.0.0",
  preferredRoot: null as string | null,
};

const sdkMocks = {
  getSelectedAccount: async () => null,
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
  getRecoveryStatus: async () => null,
  unfinishedUninstalls: async () => [],
  getWhichcraftSettings: async () => ({
    installStore: "C:\\store",
    scanRoots: [],
    terminal: "windows_terminal" as const,
    installStoreConfirmed: true,
  }),
};

function renderShell(apiOverrides: Record<string, unknown> = {}) {
  const coordination = createWriteCoordinator();
  const { api } = fakeToolsRuntime({ ...sdkMocks, ...apiOverrides }, coordination);
  configureProductionServices(splitWhichcraftApi(api));
  return {
    coordination,
    api,
    ...render(
      <UndoProvider>
        <AppServicesProvider services={splitWhichcraftApi(api)}>
          <WriteCoordinatorProvider coordinator={coordination}>
            <DesktopShellApp />
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    ),
  };
}

describe("desktop shell tool profiles", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(null, "", shellNavigationHref({ page: "profiles" }));
  });

  it("loads saved profiles, shows the plan on the profiles page, and applies through applyToolPlan", async () => {
    const profile = { id: "p1", name: "JDK only", tools: [javaPin] };
    const reviewedPlan = planFor(inst("java", "17.0.2", "C:\\jdk17"), { planId: "profile-plan" });
    const planProfile = vi.fn(async () => reviewedPlan);
    const applyToolPlan = vi.fn(async () => ({
      planId: "profile-plan",
      stale: false,
      needsElevation: false,
    }));
    const listProfiles = vi.fn(async () => [profile]);
    const profileStatus = vi.fn(async () => ({
      profile,
      matchesEffective: false,
      unavailable: [],
    }));
    renderShell({
      listProfiles,
      profileStatus,
      planProfile,
      applyToolPlan,
      listToolInstallations: async (tool: string) =>
        tool === "java"
          ? [inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true })]
          : [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(listProfiles).toHaveBeenCalled());
    expect(await screen.findByText("JDK only")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(planProfile).toHaveBeenCalledWith(profile));
    expect(await screen.findByRole("button", { name: /^apply plan$/i })).toBeInTheDocument();
    expect(applyToolPlan).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(applyToolPlan).toHaveBeenCalledWith(reviewedPlan));
  });

  it("shows profile apply plan when the first pin is not the default open tool", async () => {
    const profile = { id: "p1", name: "Node only", tools: [nodePin] };
    const reviewedPlan = planFor(inst("node", "20.0.0", "C:\\node20"), {
      planId: "node-profile-plan",
      userDiffs: [
        {
          name: "PATH",
          scope: "User" as const,
          kind: "changed" as const,
          before: "C:\\old",
          after: "C:\\node20\\bin",
        },
      ],
    });
    const planProfile = vi.fn(async () => reviewedPlan);
    const applyToolPlan = vi.fn(async () => ({
      planId: "node-profile-plan",
      stale: false,
      needsElevation: false,
    }));
    const planToolApply = vi.fn(async () => {
      throw new Error("applyToolPlan must be used for profile apply, not planToolApply(java, …)");
    });
    renderShell({
      listProfiles: async () => [profile],
      profileStatus: async () => ({
        profile,
        matchesEffective: false,
        unavailable: [],
      }),
      planProfile,
      applyToolPlan,
      planToolApply,
      listToolInstallations: async (tool: string) =>
        tool === "node"
          ? [inst("node", "22.0.0", "C:\\node22", { effective: true, selected: true })]
          : [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Node only")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(planProfile).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /^apply plan$/i })).toBeInTheDocument();
    expect(screen.getByText(/User PATH/i)).toBeInTheDocument();
    expect(applyToolPlan).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(applyToolPlan).toHaveBeenCalledWith(reviewedPlan));
    expect(reviewedPlan.tool).toBe("node");
    expect(planToolApply).not.toHaveBeenCalled();
  });

  it("reloads profile match status after environment invalidation without tools-profiles scope", async () => {
    const profile = { id: "p1", name: "Work", tools: [javaPin, nodePin] };
    const listProfiles = vi.fn(async () => [profile]);
    const profileStatus = vi.fn(async () => ({
      profile,
      matchesEffective: true,
      unavailable: [nodePin],
    }));
    const { coordination } = renderShell({
      listProfiles,
      profileStatus,
      listToolInstallations: async () => [],
    });
    await waitFor(() => expect(listProfiles.mock.calls.length).toBeGreaterThan(0));
    const before = profileStatus.mock.calls.length;
    coordination.invalidate(["environment-variables"]);
    await waitFor(() => expect(profileStatus.mock.calls.length).toBeGreaterThan(before));
  });

  it("does not invalidate an Apply result when focus returns during its UAC write", async () => {
    const profile = { id: "p1", name: "UAC profile", tools: [javaPin] };
    const reviewedPlan = planFor(inst("java", "17.0.2", "C:\\jdk17"), { planId: "focus-during-uac", requiresUac: true });
    let value = "before";
    let finish!: (result: { planId: string; stale: boolean; needsElevation: boolean }) => void;
    const applyToolPlanWithUac = vi.fn(() => new Promise<{ planId: string; stale: boolean; needsElevation: boolean }>((resolve) => { finish = resolve; }));
    const { coordination } = renderShell({
      listProfiles: async () => [profile],
      profileStatus: async () => ({ profile, matchesEffective: false, unavailable: [] }),
      planProfile: async () => reviewedPlan,
      applyToolPlanWithUac,
      getRegistrySnapshot: async () => ({ user: [{ name: "JAVA_HOME", value, valueKind: "String" as const }], system: [] }),
      listToolInstallations: async () => [],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^apply$/i }));
    await user.click(await screen.findByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(applyToolPlanWithUac).toHaveBeenCalled());
    const binding = coordination.beginPlanApply(reviewedPlan.planId, reviewedPlan.tool);
    expect(coordination.isPlanApplyCurrent(binding)).toBe(true);
    value = "partly-written-by-helper";
    await act(async () => { fireEvent.focus(window); });
    expect(coordination.isPlanApplyCurrent(binding)).toBe(true);
    await act(async () => { finish({ planId: reviewedPlan.planId, stale: false, needsElevation: false }); });
    await waitFor(() => expect(screen.queryByRole("button", { name: /^applying/i })).not.toBeInTheDocument());
  });

  it("refreshes profile matches on focus after successive external edits and restoration", async () => {
    const profile = { id: "p1", name: "Live Java", tools: [javaPin] };
    let root = "C:\\jdk17";
    const getRegistrySnapshot = vi.fn(async () => ({
      user: [{ name: "JAVA_HOME", value: root, valueKind: "String" as const }],
      system: [],
    }));
    renderShell({
      getRegistrySnapshot,
      listProfiles: async () => [profile],
      profileStatus: async () => ({ profile, matchesEffective: root === "C:\\jdk17", unavailable: [] }),
      listToolInstallations: async () => [],
    });
    await screen.findByText("Live Java");
    await waitFor(() => expect(getRegistrySnapshot).toHaveBeenCalled());
    expect(await screen.findByText(/^matches what is in effect$/i)).toBeInTheDocument();

    root = "C:\\jdk21";
    fireEvent.focus(window);
    expect(await screen.findByText(/^differs from what is in effect$/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Another edit while external changes have not been accepted must refresh too.
    root = "C:\\jdk17";
    fireEvent.focus(window);
    expect(await screen.findByText(/^matches what is in effect$/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks profile planning while staged environment edits are pending", async () => {
    const profile = { id: "p1", name: "Work", tools: [javaPin] };
    let value = "x";
    const getEnvVars = vi.fn(async () => [{ name: "BLOCK", value, valueKind: "String" as const, scope: "User" as const, listSeparator: null }]);
    const planProfile = vi.fn(async () => planFor(inst("java", "17.0.2", "C:\\jdk17")));
    renderShell({
      listProfiles: async () => [profile],
      profileStatus: async () => ({
        profile,
        matchesEffective: false,
        unavailable: [],
      }),
      planProfile,
      getEnvVars,
      getRegistrySnapshot: async () => ({ user: [{ name: "BLOCK", value, valueKind: "String" as const }], system: [] }),
      listToolInstallations: async () => [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Work")).toBeInTheDocument());
    await user.click(screen.getByRole("link", { name: /^environment$/i }));
    await user.click(screen.getByText("BLOCK"));
    const editor = await screen.findByLabelText(/^value$/i);
    fireEvent.change(editor, { target: { value: "changed" } });
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );

    const readsBeforeFocus = getEnvVars.mock.calls.length;
    value = "external-edit";
    fireEvent.focus(window);
    await waitFor(() => expect(getEnvVars.mock.calls.length).toBeGreaterThan(readsBeforeFocus));
    expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /tool profiles/i }));
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() =>
      expect(screen.getByText(ENVIRONMENT_PENDING_TOOLS_MESSAGE)).toBeInTheDocument(),
    );
    expect(planProfile).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^apply plan$/i })).not.toBeInTheDocument();
  });

  it("does not call createSnapshot when confirming a profile plan", async () => {
    const profile = { id: "p1", name: "JDK only", tools: [javaPin] };
    const reviewedPlan = planFor(inst("java", "17.0.2", "C:\\jdk17"), { planId: "profile-plan" });
    const planProfile = vi.fn(async () => reviewedPlan);
    const applyToolPlan = vi.fn(async () => ({
      planId: "profile-plan",
      stale: false,
      needsElevation: false,
    }));
    const createSnapshot = vi.fn(async () => {
      throw new Error("createSnapshot must not run during profile apply");
    });
    renderShell({
      listProfiles: async () => [profile],
      profileStatus: async () => ({
        profile,
        matchesEffective: false,
        unavailable: [],
      }),
      planProfile,
      applyToolPlan,
      createSnapshot,
      listToolInstallations: async () => [
        inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
      ],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("JDK only")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    await waitFor(() => expect(planProfile).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(applyToolPlan).toHaveBeenCalled());
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it("install-missing reaches profile plan and applyToolPlan", async () => {
    const profile = { id: "p1", name: "Android", tools: [javaPin, nodePin] };
    const reviewedPlan = planFor(inst("java", "17.0.2", "C:\\jdk17"), {
      planId: "after-install-plan",
      userDiffs: [
        {
          name: "JAVA_HOME",
          scope: "User" as const,
          kind: "changed" as const,
          before: "a",
          after: "C:\\jdk17",
        },
      ],
    });
    const profileMissing = vi.fn(async () => [
      { pin: nodePin, installVersion: "20.19.0", downloadBytes: 1024 },
    ]);
    const installMissing = vi.fn(async () => {});
    const planProfile = vi.fn(async () => reviewedPlan);
    const applyToolPlan = vi.fn(async () => ({
      planId: "after-install-plan",
      stale: false,
      needsElevation: false,
    }));
    renderShell({
      listProfiles: async () => [profile],
      profileStatus: async () => ({
        profile,
        matchesEffective: false,
        unavailable: [nodePin],
      }),
      profileMissing,
      installMissing,
      planProfile,
      applyToolPlan,
      listToolInstallations: async () => [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Android")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^apply$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /what is missing/i }));
    await waitFor(() => expect(profileMissing).toHaveBeenCalledWith(profile));
    expect(planProfile).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: /install the missing/i }));
    await waitFor(() => expect(installMissing).toHaveBeenCalledWith(profile));
    await waitFor(() => expect(planProfile).toHaveBeenCalledWith(profile));
    expect(await screen.findByText(/User JAVA_HOME/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(applyToolPlan).toHaveBeenCalledWith(reviewedPlan));
  });
});
