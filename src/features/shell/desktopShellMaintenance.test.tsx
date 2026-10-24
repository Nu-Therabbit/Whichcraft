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
  const { api } = fakeToolsRuntime({ ...sdkMocks, ...apiOverrides }, coordination);
  configureProductionServices(splitEnvarlyApi(api));
  return {
    coordination,
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

describe("desktop shell maintenance and recovery", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "variables" }),
    );
  });

  it("shows recovery resume/rollback before opening the tool inspector", async () => {
    const recovery = {
      journalId: "j-1",
      kind: "java_apply" as const,
      createdAt: "2026-10-23T09:00:00Z",
      canResume: true,
      items: [{ name: "JAVA_HOME", scope: "User" as const, status: "pending" as const }],
    };
    renderShell({
      getRecoveryStatus: async () => recovery,
      getEnvVars: async () => [],
      listToolInstallations: async () => [
        inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
      ],
    });

    expect(await screen.findByRole("button", { name: /finish the apply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /roll back/i })).toBeInTheDocument();
  });

  it("plans PATH cleanup through the production API and shows duplicate/missing summary", async () => {
    const cleanupPlan = {
      ...planFor(inst("java", "21.0.1", "C:\\jdk21"), { planId: "path-cleanup", recordsSelection: false }),
      removedDuplicates: ["C:\\dup"],
      removedMissing: ["C:\\gone"],
      userDiffs: [{ name: "PATH", scope: "User" as const, kind: "changed" as const, before: "a", after: "b" }],
    };
    const planPathCleanup = vi.fn(async () => cleanupPlan);
    renderShell({
      getEnvVars: async () => [],
      planPathCleanup,
      listToolInstallations: async () => [
        inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
      ],
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /clean up path$/i }));
    await waitFor(() => expect(planPathCleanup).toHaveBeenCalled());
    expect(await screen.findByText(/C:\\dup/)).toBeInTheDocument();
    expect(screen.getByText(/C:\\gone/)).toBeInTheDocument();
  });

  it("keeps diagnostics staging actions on the variables workflow", async () => {
    renderShell({
      getEnvVars: async () => [
        {
          name: "TOOLS",
          value: "%USERPROFILE%\\tools",
          valueKind: "String" as const,
          scope: "User" as const,
          listSeparator: null,
        },
      ],
      getUnsupportedEnvValues: async () => [],
      validatePaths: async () => [],
    });

    expect(await screen.findByText(/TOOLS/i)).toBeInTheDocument();
    await userEvent.click(await screen.findByText(/^show$/i));
    expect(await screen.findByRole("button", { name: /stage type change/i })).toBeInTheDocument();
  });
});
