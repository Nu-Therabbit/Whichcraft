import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitWhichcraftApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator, type WriteCoordinatorFacade } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import type { InvalidationScope } from "../../coordination/types";
import type { UninstallPlan } from "../tools/types";
import { fakeToolsRuntime, inst, planFor } from "../../test/toolsTestHarness";
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
  profileStatus: async (p: { profile: unknown }) => ({
    profile: p.profile,
    matchesEffective: true,
    unavailable: [],
  }),
};

const effective = inst("java", "21.0.12", "C:\\jdk21", { effective: true, selected: true });
const replacement = inst("java", "17.0.2", "C:\\jdk17", { managed: true });

function uninstallPlan(extra: Partial<UninstallPlan> = {}): UninstallPlan {
  return {
    installation: effective,
    method: { kind: "recycleFolder" },
    usage: { processes: [], folderLocked: false },
    needsReplacement: true,
    replacements: [replacement],
    affectedProfiles: [],
    gradleHint: false,
    noConfirmation: false,
    ...extra,
  };
}

function renderShell(
  api: Record<string, unknown> = {},
  coordination: WriteCoordinatorFacade = createWriteCoordinator(),
) {
  const { api: fake } = fakeToolsRuntime({ ...sdkMocks, ...api }, coordination);
  configureProductionServices(splitWhichcraftApi(fake));
  return {
    coordination,
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
  await waitFor(() => expect(screen.getByRole("button", { name: /^Java,/i })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: /^Java,/i }));
  return screen.findByRole("complementary", { name: /installation details/i });
}

async function planUninstallForRoot(
  user: ReturnType<typeof userEvent.setup>,
  details: HTMLElement,
  root: string,
) {
  const row = within(details).getByText(root).closest("li");
  if (!row) throw new Error(`installation row not found: ${root}`);
  await user.click(within(row).getByRole("button", { name: /^uninstall$/i }));
}

async function openedUninstallPlanSection() {
  await screen.findByRole("heading", { name: /^uninstall eclipse adoptium/i });
  return uninstallPlanSection();
}

function uninstallPlanSection() {
  const heading = screen.getByRole("heading", { name: /^uninstall eclipse adoptium/i });
  return heading.closest("section") as HTMLElement;
}

async function confirmReplacementUninstall(user: ReturnType<typeof userEvent.setup>) {
  const uninstallSection = uninstallPlanSection();
  await user.selectOptions(within(uninstallSection).getByRole("combobox"), "C:\\jdk17");
  await waitFor(() =>
    expect(within(uninstallSection).getByRole("button", { name: /^uninstall$/i })).toBeEnabled(),
  );
  await user.click(within(uninstallSection).getByRole("button", { name: /^uninstall$/i }));
}

describe("desktop shell uninstall", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(null, "", "/?presentation=desktop-shell");
  });

  it("shows uninstall plan with method and requires replacement review before confirm", async () => {
    const planUninstall = vi.fn(async () => uninstallPlan());
    renderShell({
      listToolInstallations: async (tool: string) =>
        tool === "java" ? [effective, replacement] : [],
      planUninstall,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await waitFor(() => expect(planUninstall).toHaveBeenCalledWith("java", "C:\\jdk21"));
    expect(await screen.findByText(/recycle bin/i)).toBeInTheDocument();
    const uninstallSection = uninstallPlanSection();
    expect(within(uninstallSection).getByRole("button", { name: /^uninstall$/i })).toBeDisabled();
  });

  it("uninstalls with the switch plan that was shown and reloads tool inventory", async () => {
    const shown = planFor(replacement, { planId: "switch-for-uninstall" });
    const planUninstall = vi.fn(async () => uninstallPlan());
    const planToolApply = vi.fn(async () => shown);
    const uninstall = vi.fn(async () => ({ status: "removed" as const }));
    const listToolInstallations = vi.fn(async (tool: string) =>
      tool === "java" ? [effective, replacement] : [],
    );
    const coordination = createWriteCoordinator();
    const invalidations: InvalidationScope[][] = [];
    coordination.subscribeInvalidation((scopes) => invalidations.push([...scopes]));
    renderShell(
      {
        listToolInstallations,
        planUninstall,
        planToolApply,
        uninstall,
      },
      coordination,
    );
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await waitFor(() => expect(listToolInstallations.mock.calls.length).toBeGreaterThan(0));
    const installsBeforeConfirm = listToolInstallations.mock.calls.length;
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await waitFor(() => expect(planUninstall).toHaveBeenCalled());
    const invalidationsBeforeConfirm = invalidations.length;
    await confirmReplacementUninstall(user);
    await waitFor(() => expect(uninstall).toHaveBeenCalledWith("java", "C:\\jdk21", shown));
    await waitFor(() =>
      expect(listToolInstallations.mock.calls.length).toBeGreaterThan(installsBeforeConfirm),
    );
    await waitFor(() => {
      const afterConfirm = invalidations.slice(invalidationsBeforeConfirm);
      expect(
        afterConfirm.some(
          (scopes) =>
            scopes.includes("tools-installations") || scopes.includes("shell-overview"),
        ),
      ).toBe(true);
    });
  });

  it("does not call uninstall when the reviewed switch plan baseline went stale", async () => {
    const shown = planFor(replacement, { planId: "reviewed-switch" });
    const planUninstall = vi.fn(async () => uninstallPlan());
    const planToolApply = vi.fn(async () => shown);
    const uninstall = vi.fn(async () => ({ status: "removed" as const }));
    const { coordination } = renderShell({
      listToolInstallations: async (tool: string) =>
        tool === "java" ? [effective, replacement] : [],
      planUninstall,
      planToolApply,
      uninstall,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await waitFor(() => expect(planUninstall).toHaveBeenCalled());
    await user.selectOptions(within(uninstallPlanSection()).getByRole("combobox"), "C:\\jdk17");
    await waitFor(() => expect(planToolApply).toHaveBeenCalledTimes(1));
    coordination.invalidate(["environment-variables"]);
    await user.click(within(await openedUninstallPlanSection()).getByRole("button", { name: /^uninstall$/i }));
    await waitFor(() => expect(planToolApply).toHaveBeenCalledTimes(2));
    expect(uninstall).not.toHaveBeenCalled();
  });

  it("does not call uninstall until the replacement switch plan is on screen", async () => {
    const planUninstall = vi.fn(async () => uninstallPlan());
    const planToolApply = vi.fn(async () => planFor(replacement, { planId: "shown-switch" }));
    const uninstall = vi.fn(async () => ({ status: "removed" as const }));
    renderShell({
      listToolInstallations: async (tool: string) =>
        tool === "java" ? [effective, replacement] : [],
      planUninstall,
      planToolApply,
      uninstall,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await waitFor(() => expect(planUninstall).toHaveBeenCalled());
    const uninstallSection = uninstallPlanSection();
    await user.click(within(uninstallSection).getByRole("button", { name: /^uninstall$/i }));
    expect(uninstall).not.toHaveBeenCalled();
    expect(planToolApply).not.toHaveBeenCalled();
  });

  it("surfaces refused uninstall methods without calling uninstall", async () => {
    const planUninstall = vi.fn(async () =>
      uninstallPlan({ method: { kind: "refused", reason: "protected" }, needsReplacement: false }),
    );
    const uninstall = vi.fn();
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective] : []),
      planUninstall,
      uninstall,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    expect(await screen.findByText(/protected/i)).toBeInTheDocument();
    expect(uninstall).not.toHaveBeenCalled();
  });

  it("blocks confirm while processes are using the installation", async () => {
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective] : []),
      planUninstall: async () =>
        uninstallPlan({
          needsReplacement: false,
          usage: { processes: ["java.exe"], folderLocked: false },
        }),
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await screen.findByRole("heading", { name: /^uninstall eclipse adoptium/i });
    expect(within(uninstallPlanSection()).getByText(/in use/i)).toBeInTheDocument();
    expect(within(uninstallPlanSection()).getByRole("button", { name: /^uninstall$/i })).toBeDisabled();
  });

  it("blocks confirm while the installation folder is open", async () => {
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective] : []),
      planUninstall: async () =>
        uninstallPlan({
          needsReplacement: false,
          usage: { processes: [], folderLocked: true },
        }),
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    expect(await screen.findByText(/folder open/i)).toBeInTheDocument();
    expect(within(uninstallPlanSection()).getByRole("button", { name: /^uninstall$/i })).toBeDisabled();
  });

  it("shows affected profiles and optional repoint when profiles use the installation", async () => {
    renderShell({
      listToolInstallations: async (tool: string) =>
        tool === "java" ? [effective, replacement] : [],
      planUninstall: async () =>
        uninstallPlan({ needsReplacement: false, affectedProfiles: ["Android work"] }),
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    expect(await screen.findByText(/Android work/i)).toBeInTheDocument();
    await user.selectOptions(within(uninstallPlanSection()).getByRole("combobox"), "C:\\jdk17");
    expect(screen.getByText(/point those profiles at the chosen installation/i)).toBeInTheDocument();
  });

  it("shows cancelled uninstall outcome", async () => {
    const uninstall = vi.fn(async () => ({ status: "cancelled" as const }));
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective] : []),
      planUninstall: async () => uninstallPlan({ needsReplacement: false }),
      uninstall,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await user.click(within(await openedUninstallPlanSection()).getByRole("button", { name: /^uninstall$/i }));
    expect(await screen.findByText(/uninstaller was cancelled/i)).toBeInTheDocument();
  });

  it("shows incomplete uninstall outcome with open-folder action", async () => {
    const uninstall = vi.fn(async () => ({
      status: "incomplete" as const,
      remaining: "C:\\jdk21",
    }));
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [effective] : []),
      planUninstall: async () => uninstallPlan({ needsReplacement: false }),
      uninstall,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await user.click(within(await openedUninstallPlanSection()).getByRole("button", { name: /^uninstall$/i }));
    expect(await screen.findByText(/folder is still there/i)).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: /uninstall/i })).getByRole("button", { name: /open folder/i })).toBeInTheDocument();
  });
});
