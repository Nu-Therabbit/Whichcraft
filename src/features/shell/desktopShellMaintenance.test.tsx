import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { splitEnvarlyApi } from "../../composition/appServices";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
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
            <DesktopShellApp />
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

  it("shows recovery readback and runs resume/rollback from the app banner without opening the inspector", async () => {
    const recovery = {
      journalId: "j-1",
      kind: "java_apply" as const,
      createdAt: "2026-10-23T09:00:00Z",
      canResume: true,
      items: [
        {
          name: "JAVA_HOME",
          scope: "User" as const,
          state: "notWritten" as const,
          before: null,
          after: "C:\\jdk21",
          current: null,
        },
      ],
    };
    const resumeApply = vi.fn(async () => {});
    const rollBackApply = vi.fn(async () => ({ restored: 1, conflicts: [] }));
    renderShell({
      getRecoveryStatus: async () => recovery,
      resumeApply,
      rollBackApply,
      getEnvVars: async () => [],
      listToolInstallations: async () => [
        inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
      ],
    });

    expect(await screen.findByText(/User JAVA_HOME/i)).toBeInTheDocument();
    expect(screen.getByText(/not written/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /finish the apply/i }));
    await waitFor(() => expect(resumeApply).toHaveBeenCalledWith("j-1"));

    await user.click(screen.getByRole("button", { name: /roll back/i }));
    await waitFor(() => expect(rollBackApply).toHaveBeenCalledWith("j-1"));
  });

  it("does not write the registry until Apply on PATH cleanup", async () => {
    const cleanupPlan = {
      ...planFor(inst("java", "21.0.1", "C:\\jdk21"), {
        planId: "path-cleanup",
        recordsSelection: false,
      }),
      removedDuplicates: ["C:\\dup"],
      removedMissing: ["C:\\gone"],
      userDiffs: [
        { name: "PATH", scope: "User" as const, kind: "changed" as const, before: "a", after: "b" },
      ],
    };
    const planPathCleanup = vi.fn(async () => cleanupPlan);
    const applyToolPlan = vi.fn(async () => ({
      planId: "path-cleanup",
      stale: false,
      needsElevation: false,
    }));
    const applyEnvChanges = vi.fn(async () => {});
    renderShell({
      getEnvVars: async () => [],
      planPathCleanup,
      applyToolPlan,
      applyEnvChanges,
      listToolInstallations: async () => [
        inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
      ],
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /clean up path$/i }));
    await waitFor(() => expect(planPathCleanup).toHaveBeenCalled());
    expect(applyToolPlan).not.toHaveBeenCalled();
    expect(applyEnvChanges).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(applyToolPlan).toHaveBeenCalled());
    expect(applyEnvChanges).not.toHaveBeenCalled();
  });

  it("offers undo on the PATH cleanup band", async () => {
    const cleanupPlan = {
      ...planFor(inst("java", "21.0.1", "C:\\jdk21"), {
        planId: "path-cleanup",
        recordsSelection: false,
      }),
      removedDuplicates: [],
      removedMissing: [],
      userDiffs: [
        { name: "PATH", scope: "User" as const, kind: "changed" as const, before: "a", after: "b" },
      ],
    };
    const undoLastWhichcraftApply = vi.fn(async () => ({ restored: 1, conflicts: [] }));
    renderShell({
      getEnvVars: async () => [],
      planPathCleanup: async () => cleanupPlan,
      undoLastWhichcraftApply,
      listToolInstallations: async () => [
        inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
      ],
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /clean up path$/i }));
    await user.click(await screen.findByRole("button", { name: /undo last whichcraft apply/i }));
    await waitFor(() => expect(undoLastWhichcraftApply).toHaveBeenCalled());
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
