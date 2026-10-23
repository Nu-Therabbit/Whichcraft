import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator, type WriteCoordinatorFacade } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { fakeToolsRuntime, inst, planFor } from "../tools/testHarness";
import { DesktopShellApp } from "./DesktopShellApp";

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
  profileStatus: async (p: { profile: unknown }) => ({ profile: p.profile, matchesEffective: true, unavailable: [] }),
};

function renderShell(
  api: Parameters<typeof fakeToolsRuntime>[0],
  coordination: WriteCoordinatorFacade = createWriteCoordinator(),
) {
  const { api: fake } = fakeToolsRuntime({ ...sdkMocks, ...api }, coordination);
  configureProductionServices(splitEnvarlyApi(fake));
  return {
    coordination,
    ...render(
      <AppServicesProvider>
        <WriteCoordinatorProvider coordinator={coordination}>
          <DesktopShellApp />
        </WriteCoordinatorProvider>
      </AppServicesProvider>,
    ),
  };
}

async function openJavaDetail(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: /Java/i })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: /Java/i }));
  return screen.findByRole("complementary", { name: /installation details/i });
}

describe("desktop shell switch apply and undo", () => {
  beforeEach(() => {
    configureProductionServices(null);
  });

  it("builds a real plan, applies the reviewed plan id, and readbacks a new effective installation", async () => {
    const beforeEffective = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: false });
    const target = inst("java", "17.0.2", "C:\\jdk17", { selected: true, effective: false, available: true });
    const plan = planFor(target, {
      planId: "reviewed-plan-17",
      userDiffs: [{ name: "JAVA_HOME", scope: "User", kind: "changed", before: "old", after: "C:\\jdk17" }],
      systemDiffs: [{ name: "PATH", scope: "System", kind: "changed", before: "a", after: "b" }],
    });
    let applied = false;
    const afterEffective = inst("java", "17.0.2", "C:\\jdk17", { effective: true, selected: true });
    const afterOld = inst("java", "21.0.1", "C:\\jdk21", { effective: false, selected: false });
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool !== "java") return [];
      return applied ? [afterEffective, afterOld] : [beforeEffective, target];
    });
    const planToolApply = vi.fn(async () => plan);
    const applyToolPlan = vi.fn(async (reviewed: typeof plan) => {
      applied = true;
      return { planId: reviewed.planId, stale: false, needsElevation: false };
    });
    renderShell({ listToolInstallations, planToolApply, applyToolPlan });

    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await user.click(
      await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 17\.0\.2/i }),
    );
    await waitFor(() => expect(planToolApply).toHaveBeenCalledWith("java", "C:\\jdk17"));
    expect(screen.getByText(/User JAVA_HOME/i)).toBeInTheDocument();
    expect(screen.getByText(/System PATH/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Apply plan$/i }));
    await waitFor(() => expect(applyToolPlan).toHaveBeenCalledWith(expect.objectContaining({ planId: plan.planId })));
    await waitFor(() => {
      const block = within(details).getByText(/^Effective installation$/i).closest("div");
      expect(block).toHaveTextContent("17.0.2");
      expect(block).not.toHaveTextContent("21.0.1");
    });
    expect(listToolInstallations.mock.calls.length).toBeGreaterThan(2);
  });

  it("does not commit apply when the reviewed plan baseline moved before the result returns", async () => {
    const effective = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    const target = inst("java", "17.0.2", "C:\\jdk17");
    const plan = planFor(target, { planId: "locked-plan-id" });
    let releaseApply: (v: { planId: string; stale: boolean; needsElevation: boolean }) => void = () => {};
    const applyToolPlan = vi.fn(
      () =>
        new Promise<{ planId: string; stale: boolean; needsElevation: boolean }>((resolve) => {
          releaseApply = resolve;
        }),
    );
    const coordination = createWriteCoordinator();
    renderShell(
      {
        listToolInstallations: async (tool: string) => (tool === "java" ? [effective, target] : []),
        planToolApply: vi.fn(async () => plan),
        applyToolPlan,
      },
      coordination,
    );
    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 17\.0\.2/i }));
    await user.click(await screen.findByRole("button", { name: /^Apply plan$/i }));
    coordination.invalidate(["environment-variables"]);
    releaseApply({ planId: plan.planId, stale: false, needsElevation: false });
    await waitFor(() => expect(applyToolPlan).toHaveBeenCalledWith(expect.objectContaining({ planId: plan.planId })));
    expect(screen.getByRole("button", { name: /^Apply plan$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Environment changed since the plan was created/i)).not.toBeInTheDocument();
  });

  it("does not allow choosing an unavailable installation", async () => {
    const broken = inst("java", "11.0.0", "C:\\missing", { available: false, mismatchReason: "Folder missing" });
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [broken] : []),
      planToolApply: vi.fn(),
    });
    const user = userEvent.setup();
    await openJavaDetail(user);
    expect(screen.getByRole("button", { name: /Switch to/i })).toBeDisabled();
  });

  it("shows stale plan error and rebuild path after apply", async () => {
    const effective = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    const target = inst("java", "17.0.2", "C:\\jdk17");
    const plan = planFor(target);
    const planToolApply = vi
      .fn()
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(planFor(target, { planId: "rebuilt" }));
    const applyToolPlan = vi.fn(async (reviewed: typeof plan) => ({
      planId: reviewed.planId,
      stale: true,
      needsElevation: false,
    }));
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective, target] : []),
      planToolApply,
      applyToolPlan,
    });
    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 17\.0\.2/i }));
    await user.click(await screen.findByRole("button", { name: /^Apply plan$/i }));
    await waitFor(() =>
      expect(screen.getAllByText(/Environment changed since the plan was created/i).length).toBeGreaterThan(0),
    );
    await waitFor(() => expect(planToolApply).toHaveBeenCalledTimes(2));
  });

  it("reports declined UAC without leaving apply stuck", async () => {
    const effective = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    const target = inst("java", "17.0.2", "C:\\jdk17");
    const plan = planFor(target, { planId: "uac-plan", requiresUac: true });
    const applyToolPlanWithUac = vi.fn(async (reviewed: typeof plan) => ({
      planId: reviewed.planId,
      stale: false,
      needsElevation: true,
    }));
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective, target] : []),
      planToolApply: vi.fn(async () => plan),
      applyToolPlanWithUac,
      applyToolPlan: vi.fn(async () => ({ planId: plan.planId, stale: false, needsElevation: false })),
    });
    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 17\.0\.2/i }));
    await user.click(await screen.findByRole("button", { name: /^Apply plan$/i }));
    await waitFor(() =>
      expect(screen.getAllByText(/requires UAC approval for System PATH/i).length).toBeGreaterThan(0),
    );
    expect(applyToolPlanWithUac).toHaveBeenCalledWith(expect.objectContaining({ planId: plan.planId }));
    expect(screen.getByRole("button", { name: /^Apply plan$/i })).toBeEnabled();
  });

  it("surfaces failed apply errors", async () => {
    const effective = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    const target = inst("java", "17.0.2", "C:\\jdk17");
    const plan = planFor(target);
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective, target] : []),
      planToolApply: vi.fn(async () => plan),
      applyToolPlan: vi.fn(async () => {
        throw new Error("disk full");
      }),
    });
    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 17\.0\.2/i }));
    await user.click(await screen.findByRole("button", { name: /^Apply plan$/i }));
    await waitFor(() => expect(screen.getAllByText(/disk full/i).length).toBeGreaterThan(0));
  });

  it("clears a prior inventory error after a successful reload", async () => {
    const jdk = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    let failNext = true;
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool !== "java") return [];
      if (failNext) throw new Error("offline");
      return [jdk];
    });
    renderShell({ listToolInstallations });
    const user = userEvent.setup();
    await openJavaDetail(user);
    await waitFor(() => expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0));
    failNext = false;
    await user.click(screen.getByRole("button", { name: /Java/i }));
    await user.click(screen.getByRole("button", { name: /Node\.js/i }));
    await user.click(screen.getByRole("button", { name: /Java/i }));
    await waitFor(() => expect(screen.queryByText(/offline/i)).not.toBeInTheDocument());
  });

  it("does not show the previous tool's installations while the new tool reloads", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { effective: true, selected: true });
    const node = inst("node", "22.0.0", "C:\\node", { effective: true, selected: true });
    let releaseNode: (rows: typeof node[]) => void = () => {};
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool === "java") return [jdk];
      if (tool === "node") {
        return new Promise<typeof node[]>((resolve) => {
          releaseNode = resolve;
        });
      }
      return [];
    });
    renderShell({ listToolInstallations });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await waitFor(() => expect(within(details).getByText("21.0.12")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Node\.js/i }));
    expect(within(details).queryByText("21.0.12")).not.toBeInTheDocument();
    releaseNode([node]);
    await waitFor(() => expect(within(details).getByText("22.0.0")).toBeInTheDocument());
  });

  it("does not leave the panel busy when a late apply returns after switching tools", async () => {
    const jdk = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true, available: true });
    const jdk17 = inst("java", "17.0.2", "C:\\jdk17");
    const node = inst("node", "22.0.0", "C:\\node", { effective: true, selected: true });
    let releaseApply: (v: { planId: string; stale: boolean; needsElevation: boolean }) => void = () => {};
    const applyToolPlan = vi.fn(
      () =>
        new Promise<{ planId: string; stale: boolean; needsElevation: boolean }>((resolve) => {
          releaseApply = resolve;
        }),
    );
    const plan = planFor(jdk17);
    renderShell({
      listToolInstallations: vi.fn(async (tool: string) => {
        if (tool === "java") return [jdk, jdk17];
        if (tool === "node") return [node];
        return [];
      }),
      planToolApply: vi.fn(async () => plan),
      applyToolPlan,
    });
    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 17\.0\.2/i }));
    await user.click(await screen.findByRole("button", { name: /^Apply plan$/i }));
    await user.click(screen.getByRole("button", { name: /Node\.js/i }));
    releaseApply({ planId: "p", stale: false, needsElevation: false });
    await waitFor(() => expect(screen.queryByText(/Applying changes/i)).not.toBeInTheDocument());
    expect(screen.getByRole("complementary")).not.toHaveTextContent("17.0.2");
  });

  it("runs undo and shows restored count", async () => {
    const effective = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective] : []),
      undoLastWhichcraftApply: vi.fn(async () => ({ restored: 2, conflicts: [] })),
    });
    const user = userEvent.setup();
    await openJavaDetail(user);
    await user.click(screen.getByRole("button", { name: /Undo last Whichcraft apply/i }));
    await waitFor(() => expect(screen.getByText(/Undo restored 2/i)).toBeInTheDocument());
  });
});
