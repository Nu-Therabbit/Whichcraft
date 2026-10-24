import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../../contexts/UndoContext";
import { splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { EnvironmentProvider } from "../environment/EnvironmentContext";
import { fakeToolsRuntime, inst, planFor } from "../tools/testHarness";
import { DesktopShellApp } from "./DesktopShellApp";
import { ShellEnvironmentUiProvider } from "./ShellEnvironmentUiContext";
import { shellNavigationHref } from "../../lib/shellNavigation";

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
  configureProductionServices(splitEnvarlyApi(api));
  return {
    coordination,
    api,
    ...render(
      <UndoProvider>
        <AppServicesProvider services={splitEnvarlyApi(api)}>
          <WriteCoordinatorProvider coordinator={coordination}>
            <EnvironmentProvider>
              <ShellEnvironmentUiProvider>
                <DesktopShellApp />
              </ShellEnvironmentUiProvider>
            </EnvironmentProvider>
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    ),
  };
}

describe("desktop shell tool profiles", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "profiles" }),
    );
  });

  it("loads saved profiles and plans apply for a partial pin set", async () => {
    const profile = { id: "p1", name: "JDK only", tools: [javaPin] };
    const planProfile = vi.fn(async () => planFor(inst("java", "17.0.2", "C:\\jdk17"), { planId: "profile-plan" }));
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
  });

  it("reloads profile match status after environment invalidation", async () => {
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
    coordination.invalidate(["environment-variables", "tools-profiles"]);
    await waitFor(() => expect(profileStatus.mock.calls.length).toBeGreaterThan(before));
  });

  it("blocks apply when pins are unavailable and surfaces install-missing workflow", async () => {
    const profile = { id: "p1", name: "Android", tools: [javaPin, nodePin] };
    const profileMissing = vi.fn(async () => [
      { pin: nodePin, installVersion: "20.19.0", downloadBytes: 1024 },
    ]);
    renderShell({
      listProfiles: async () => [profile],
      profileStatus: async () => ({
        profile,
        matchesEffective: false,
        unavailable: [nodePin],
      }),
      profileMissing,
      listToolInstallations: async () => [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Android")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^apply$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /what is missing/i }));
    await waitFor(() => expect(profileMissing).toHaveBeenCalledWith(profile));
    expect(await screen.findByRole("button", { name: /install the missing/i })).toBeInTheDocument();
  });
});
