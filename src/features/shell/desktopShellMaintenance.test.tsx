import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { splitWhichcraftApi } from "../../composition/appServices";
import { configureProductionServices } from "../../composition/createProductionServices";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
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
  configureProductionServices(splitWhichcraftApi(api));
  return {
    coordination,
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

describe("desktop shell maintenance and recovery", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "variables" }),
    );
  });

  it("shows one registry failure alert on Environment", async () => {
    renderShell({ getEnvVars: async () => { throw new Error("registry denied"); } });
    await waitFor(() => {
      expect(screen.getAllByRole("alert").filter((alert) => alert.textContent?.includes("registry denied"))).toHaveLength(1);
    });
  });

  it("keeps unfinished-uninstall actions available across pages and outside the inspector", async () => {
    const installation = inst("java", "21.0.1", "C:\\unfinished");
    let unfinished = [{ id: "remove-1", startedAt: "2026-10-24T00:00:00Z", installation }];
    const openFolder = vi.fn(async () => {});
    const dismissUnfinishedUninstall = vi.fn(async () => { unfinished = []; });
    renderShell({ unfinishedUninstalls: async () => unfinished, openFolder, dismissUnfinishedUninstall });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /open folder/i }));
    expect(openFolder).toHaveBeenCalledWith(installation.root);
    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    await user.click(await screen.findByRole("button", { name: /^Java,/i }));
    expect(screen.getAllByRole("button", { name: /open folder/i })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /close installation details/i }));
    await user.click(screen.getByRole("link", { name: /^settings/i }));
    await user.click(screen.getByRole("button", { name: /rescan/i }));
    await waitFor(() => expect(dismissUnfinishedUninstall).toHaveBeenCalledWith("remove-1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: /open folder/i })).not.toBeInTheDocument());
  });

  it("keeps external-change review opt-in while navigating to Developer tools", async () => {
    let value = "before";
    const getRegistrySnapshot = vi.fn(async () => ({ user: [{ name: "REVIEW_TEST", value, valueKind: "String" as const }], system: [] }));
    renderShell({ getRegistrySnapshot });
    const user = userEvent.setup();
    const toolbar = await screen.findByRole("toolbar", { name: /environment actions/i });
    await waitFor(() => expect(getRegistrySnapshot).toHaveBeenCalled());
    value = "after";
    await user.click(within(toolbar).getByRole("button", { name: /^refresh$/i }));
    await screen.findByRole("button", { name: /1 external change/i });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    expect(screen.getByRole("heading", { name: /^developer tools$/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /^environment/i }));
    await user.click(screen.getByRole("button", { name: /1 external change/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("preserves Inventory Only SDK and Python launcher details", async () => {
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools" }));
    renderShell({
      getAndroidInventory: async () => ({ sdkRoot: "C:\\Android", rootSource: "ANDROID_HOME", platforms: ["android-35"], buildTools: ["35.0.0"], ndk: ["27.2.0"], platformTools: "35.0.2", emulator: "35.2.0", cmake: ["3.22.1"] }),
      getMsvcInventory: async () => ({ instances: [{ path: "C:\\VS", displayName: "Visual Studio", version: "17.0", msvcToolsets: ["14.40"] }], windowsSdks: ["10.0.26100.0"] }),
      getPythonLauncherInfo: async () => ({ launcherInstalled: true, launcherLines: [{ tag: "3.13", path: "C:\\Python313\\python.exe", isDefault: true }], storeStub: "C:\\WindowsApps\\python.exe", note: "Launcher resolution is separate from PATH." }),
    });
    const sdk = await screen.findByRole("region", { name: /other sdks/i });
    await waitFor(() => expect(sdk).toHaveTextContent("android-35"));
    for (const detail of ["35.0.0", "27.2.0", "35.0.2", "35.2.0", "3.22.1", "14.40", "10.0.26100.0", "py -V:3.13", "default", "Launcher resolution is separate from PATH.", "C:\\WindowsApps\\python.exe"]) {
      expect(sdk).toHaveTextContent(detail);
    }
    expect(within(sdk).queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes inventory status and selection mismatch without relying on color", async () => {
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools" }));
    renderShell({ listToolInstallations: async (tool: string) => tool === "java" ? [
      inst("java", "21.0.1", "C:\\effective", { effective: true }),
      inst("java", "17.0.1", "C:\\selected", { selected: true }),
    ] : [] });
    const java = await screen.findByRole("button", { name: /^Java,.*selection differs from the effective installation/i });
    expect(java).toHaveTextContent(/selection differs from the effective installation/i);
    expect(screen.getByRole("status")).toHaveTextContent(/inventory of this pc is up to date/i);
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

  it("keeps Undo on the Environment toolbar after a PATH cleanup is applied", async () => {
    const cleanupPlan = {
      ...planFor(inst("java", "21.0.1", "C:\\jdk21"), {
        planId: "path-cleanup",
        recordsSelection: false,
      }),
      removedDuplicates: ["C:\\dup"],
      removedMissing: [],
      userDiffs: [
        { name: "PATH", scope: "User" as const, kind: "changed" as const, before: "a", after: "b" },
      ],
    };
    const undoLastWhichcraftApply = vi.fn(async () => ({ restored: 1, conflicts: [] }));
    renderShell({
      getEnvVars: async () => [],
      planPathCleanup: async () => cleanupPlan,
      applyToolPlan: vi.fn(async () => ({ planId: "path-cleanup", stale: false, needsElevation: false })),
      undoLastWhichcraftApply,
      listToolInstallations: async () => [
        inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
      ],
    });

    const user = userEvent.setup();
    const toolbar = await screen.findByRole("toolbar", { name: /environment actions/i });
    await user.click(within(toolbar).getByRole("button", { name: /clean up path$/i }));
    await user.click(await screen.findByRole("button", { name: /^apply plan$/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^apply plan$/i })).not.toBeInTheDocument());

    await user.click(within(toolbar).getByRole("button", { name: /undo last whichcraft apply/i }));
    await waitFor(() => expect(undoLastWhichcraftApply).toHaveBeenCalled());
    expect(await screen.findByText(/undo restored 1 variable/i)).toBeInTheDocument();
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
