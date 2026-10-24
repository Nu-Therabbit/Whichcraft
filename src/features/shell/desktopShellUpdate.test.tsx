import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import type { UninstallPlan } from "../../types";
import { fakeToolsRuntime, inst, planFor } from "../tools/testHarness";
import { DesktopShellApp } from "./DesktopShellApp";

const jdk21 = inst("java", "21.0.12", "C:\\jdk21", { effective: true, selected: true });
const jdk21new = inst("java", "21.0.13", "C:\\store\\jdk21.0.13", { managed: true });
const node = inst("node", "20.0.0", "C:\\node20", { effective: true, selected: true });

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
  listProfiles: async () => [],
  profileStatus: async (p: { profile: unknown }) => ({
    profile: p.profile,
    matchesEffective: true,
    unavailable: [],
  }),
};

function renderShell(apiOverrides: Record<string, unknown> = {}) {
  const coordination = createWriteCoordinator();
  const { api: fake } = fakeToolsRuntime({ ...sdkMocks, ...apiOverrides }, coordination);
  configureProductionServices(splitEnvarlyApi(fake));
  return {
    coordination,
    fake,
    ...render(
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider coordinator={coordination}>
            <DesktopShellApp />
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    ),
  };
}

async function openJavaDetail(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: /Java/i })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: /Java/i }));
  return screen.findByRole("complementary", { name: /installation details/i });
}

describe("desktop shell update journey", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(null, "", "/?presentation=desktop-shell");
  });

  it("installs beside the old root, applies the reviewed plan id, repoints, and offers uninstall", async () => {
    const switchPlan = planFor(jdk21new, { planId: "update-switch-plan" });
    const updateCandidates = vi.fn(async () => [
      { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" },
    ]);
    const updateInstallation = vi.fn(async () => ({ installation: jdk21new, plan: switchPlan }));
    const applyToolPlan = vi.fn(async (reviewed: typeof switchPlan) => ({
      planId: reviewed.planId,
      stale: false,
      needsElevation: false,
    }));
    const repointProfiles = vi.fn(async () => ["Android work"]);
    const profilesUsing = vi.fn(async () => ["Android work"]);
    const planUninstall = vi.fn(
      async (): Promise<UninstallPlan> => ({
        installation: jdk21,
        method: { kind: "recycleFolder" },
        usage: { processes: [], folderLocked: false },
        needsReplacement: true,
        replacements: [jdk21new],
        affectedProfiles: [],
        gradleHint: false,
        noConfirmation: false,
      }),
    );
    renderShell({
      listToolInstallations: vi.fn(async (tool: string) => (tool === "java" ? [jdk21] : [])),
      updateCandidates,
      updateInstallation,
      applyToolPlan,
      repointProfiles,
      profilesUsing,
      planUninstall,
    });

    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await user.click(within(details).getByRole("button", { name: /check for updates/i }));
    await waitFor(() => expect(updateCandidates).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: /^update$/i }));
    await waitFor(() => expect(updateInstallation).toHaveBeenCalledWith("java", "21.0.13"));
    expect(applyToolPlan).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: /^apply plan$/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() =>
      expect(applyToolPlan).toHaveBeenCalledWith(expect.objectContaining({ planId: "update-switch-plan" })),
    );
    await waitFor(() => expect(repointProfiles).toHaveBeenCalledWith(jdk21, jdk21new));
    await waitFor(() => expect(planUninstall).toHaveBeenCalledWith("java", "C:\\jdk21"));
    expect(screen.getAllByText(/C:\\jdk21/i).length).toBeGreaterThan(0);
  });

  it("does not repoint or offer uninstall when the reviewed plan baseline went stale", async () => {
    const switchPlan = planFor(jdk21new, { planId: "update-switch-plan" });
    const updateInstallation = vi.fn(async () => ({ installation: jdk21new, plan: switchPlan }));
    const applyToolPlan = vi.fn(async () => ({ planId: "update-switch-plan", stale: false, needsElevation: false }));
    const repointProfiles = vi.fn(async () => []);
    const planUninstall = vi.fn(async () => uninstallPlanStub());
    const { coordination } = renderShell({
      listToolInstallations: vi.fn(async (tool: string) => (tool === "java" ? [jdk21] : [])),
      updateCandidates: vi.fn(async () => [{ root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" }]),
      updateInstallation,
      applyToolPlan,
      repointProfiles,
      profilesUsing: vi.fn(async () => ["Work"]),
      planUninstall,
    });

    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(screen.getByRole("button", { name: /check for updates/i }));
    await user.click(await screen.findByRole("button", { name: /^update$/i }));
    await waitFor(() => expect(updateInstallation).toHaveBeenCalled());
    coordination.invalidate(["environment-variables"]);
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(applyToolPlan).not.toHaveBeenCalled());
    expect(repointProfiles).not.toHaveBeenCalled();
    expect(planUninstall).not.toHaveBeenCalled();
  });

  it("does not apply a late java uninstall offer to another tool when planUninstall is in flight", async () => {
    const switchPlan = planFor(jdk21new, { planId: "update-switch-plan" });
    let releaseUninstallPlan: (value: UninstallPlan) => void = () => {};
    const planUninstall = vi.fn(
      () =>
        new Promise<UninstallPlan>((resolve) => {
          releaseUninstallPlan = resolve;
        }),
    );
    const applyToolPlan = vi.fn(async () => ({ planId: "update-switch-plan", stale: false, needsElevation: false }));
    const uninstall = vi.fn(async () => ({ status: "removed" as const }));
    renderShell({
      listToolInstallations: vi.fn(async (tool: string) => {
        if (tool === "java") return [jdk21];
        if (tool === "node") return [node];
        return [];
      }),
      updateCandidates: vi.fn(async () => [{ root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" }]),
      updateInstallation: vi.fn(async () => ({ installation: jdk21new, plan: switchPlan })),
      applyToolPlan,
      repointProfiles: vi.fn(async () => []),
      profilesUsing: vi.fn(async () => []),
      planUninstall,
      uninstall,
      planToolApply: vi.fn(async () => switchPlan),
    });

    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(screen.getByRole("button", { name: /check for updates/i }));
    await user.click(await screen.findByRole("button", { name: /^update$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^apply plan$/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(planUninstall).toHaveBeenCalled());
    const lastPlanCall = planUninstall.mock.results.at(-1);
    expect(lastPlanCall?.type).toBe("return");
    const planPromise = lastPlanCall?.value as Promise<UninstallPlan>;

    await user.click(screen.getByRole("button", { name: /Node\.js/i }));
    const details = await screen.findByRole("complementary", { name: /installation details/i });

    await act(async () => {
      releaseUninstallPlan(uninstallPlanStub());
      await planPromise;
      await Promise.resolve();
    });

    expect(within(details).queryByRole("heading", { name: /^uninstall eclipse adoptium/i })).not.toBeInTheDocument();
    const uninstallButtons = within(details).getAllByRole("button", { name: /^uninstall$/i });
    expect(uninstallButtons).toHaveLength(1);
    const [rowUninstall] = uninstallButtons;
    expect(rowUninstall).toBeDefined();
    await user.click(rowUninstall);
    await waitFor(() => expect(planUninstall).toHaveBeenLastCalledWith("node", "C:\\node20"));
    expect(uninstall).not.toHaveBeenCalledWith("node", "C:\\jdk21", expect.anything());
  });

  it("clears java update uninstall offer when switching to another tool", async () => {
    const switchPlan = planFor(jdk21new, { planId: "update-switch-plan" });
    const applyToolPlan = vi.fn(async () => ({ planId: "update-switch-plan", stale: false, needsElevation: false }));
    const planUninstall = vi.fn(async () => uninstallPlanStub());
    renderShell({
      listToolInstallations: vi.fn(async (tool: string) => {
        if (tool === "java") return [jdk21];
        if (tool === "node") return [node];
        return [];
      }),
      updateCandidates: vi.fn(async () => [{ root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" }]),
      updateInstallation: vi.fn(async () => ({ installation: jdk21new, plan: switchPlan })),
      applyToolPlan,
      repointProfiles: vi.fn(async () => []),
      profilesUsing: vi.fn(async () => []),
      planUninstall,
      uninstall: vi.fn(async () => ({ status: "removed" as const })),
      planToolApply: vi.fn(async () => switchPlan),
    });

    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(screen.getByRole("button", { name: /check for updates/i }));
    await user.click(await screen.findByRole("button", { name: /^update$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^apply plan$/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(planUninstall).toHaveBeenCalled());
    expect(await screen.findByText(/uninstall eclipse adoptium/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Node\.js/i }));
    await waitFor(() => expect(screen.queryByText(/uninstall eclipse adoptium/i)).not.toBeInTheDocument());
  });

  it("does not offer update for git", async () => {
    renderShell({
      listToolInstallations: async (tool: string) =>
        tool === "git" ? [inst("git", "2.45.0", "C:\\git", { effective: true, selected: true })] : [],
    });
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: /Git/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Git/i }));
    const details = await screen.findByRole("complementary", { name: /installation details/i });
    expect(within(details).queryByRole("button", { name: /check for updates/i })).not.toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: /^update$/i })).not.toBeInTheDocument();
  });
});

function uninstallPlanStub(): UninstallPlan {
  return {
    installation: jdk21,
    method: { kind: "recycleFolder" },
    usage: { processes: [], folderLocked: false },
    needsReplacement: true,
    replacements: [jdk21new],
    affectedProfiles: [],
    gradleHint: false,
    noConfirmation: false,
  };
}
