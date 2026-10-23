import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import type { UninstallPlan } from "../../types";
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

function renderShell(api: Record<string, unknown> = {}) {
  const coordination = createWriteCoordinator();
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

async function planUninstallForRoot(
  user: ReturnType<typeof userEvent.setup>,
  details: HTMLElement,
  root: string,
) {
  const row = within(details).getByText(root).closest("li");
  if (!row) throw new Error(`installation row not found: ${root}`);
  await user.click(within(row).getByRole("button", { name: /^uninstall$/i }));
}

function uninstallPlanSection() {
  const heading = screen.getByRole("heading", { name: /^uninstall eclipse adoptium/i });
  return heading.closest("section") as HTMLElement;
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

  it("uninstalls with the switch plan that was shown", async () => {
    const shown = planFor(replacement, { planId: "switch-for-uninstall" });
    const planUninstall = vi.fn(async () => uninstallPlan());
    const planToolApply = vi.fn(async () => shown);
    const uninstall = vi.fn(async () => ({ status: "removed" as const }));
    const listToolInstallations = vi.fn(async (tool: string) =>
      tool === "java" ? [effective, replacement] : [],
    );
    renderShell({
      listToolInstallations,
      planUninstall,
      planToolApply,
      uninstall,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await planUninstallForRoot(user, details, "C:\\jdk21");
    await waitFor(() => expect(planUninstall).toHaveBeenCalled());
    const uninstallSection = uninstallPlanSection();
    await user.selectOptions(within(uninstallSection).getByRole("combobox"), "C:\\jdk17");
    await waitFor(() => expect(planToolApply).toHaveBeenCalledWith("java", "C:\\jdk17"));
    await waitFor(() =>
      expect(within(uninstallSection).getByRole("button", { name: /^uninstall$/i })).toBeEnabled(),
    );
    await user.click(within(uninstallSection).getByRole("button", { name: /^uninstall$/i }));
    await waitFor(() => expect(uninstall).toHaveBeenCalledWith("java", "C:\\jdk21", shown));
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
});
