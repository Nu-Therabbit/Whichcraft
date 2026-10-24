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

const jdk21 = inst("java", "21.0.12", "C:\\jdk21", { effective: true, selected: true });
const jdk21new = inst("java", "21.0.13", "C:\\store\\jdk21.0.13", { managed: true });

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
    await waitFor(() => expect(updateInstallation).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: /^apply plan$/i })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() =>
      expect(applyToolPlan).toHaveBeenCalledWith(expect.objectContaining({ planId: "update-switch-plan" })),
    );
    await waitFor(() => expect(repointProfiles).toHaveBeenCalled());
    await waitFor(() => expect(planUninstall).toHaveBeenCalledWith("java", "C:\\jdk21"));
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
    expect(within(details).queryByRole("button", { name: /check updates/i })).not.toBeInTheDocument();
  });
});
