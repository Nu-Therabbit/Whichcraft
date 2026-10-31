import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../contexts/UndoContext";
import { createToolsRuntime, splitWhichcraftApi } from "../composition/appServices";
import { AppServicesProvider, useAppServices } from "../composition/AppServicesContext";
import { configureProductionServices } from "../composition/createProductionServices";
import { WriteCoordinatorProvider, useWriteCoordinator } from "./WriteCoordinatorContext";
import { ENVIRONMENT_PENDING_TOOLS_MESSAGE } from "./types";
import { EnvironmentProvider } from "../features/environment/EnvironmentContext";
import { LegacyEnvironmentView } from "../features/environment/LegacyEnvironmentView";
import { DesktopShellApp } from "../features/shell/DesktopShellApp";
import { fakeToolsRuntime, inst, planFor } from "../test/toolsTestHarness";
import { useToolsStore } from "../features/tools/useToolsStore";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

function LegacyHarness() {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const toolsRuntime = useMemo(() => createToolsRuntime(services, coordination), [services, coordination]);
  const { state, dispatch } = useToolsStore("java", toolsRuntime);
  return <LegacyEnvironmentView tools={state} sendTools={dispatch} />;
}

function renderLegacyApp(apiOverrides: Parameters<typeof fakeToolsRuntime>[0]) {
  const { api: fake } = fakeToolsRuntime(apiOverrides);
  configureProductionServices(splitWhichcraftApi(fake));
  return render(
    <UndoProvider>
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider>
            <EnvironmentProvider>
              <LegacyHarness />
            </EnvironmentProvider>
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>
    </UndoProvider>,
  );
}

describe("write coordination across workspaces", () => {
  beforeEach(() => {
    configureProductionServices(null);
  });

  it("refuses tool apply from the legacy screen while environment edits are staged", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true, available: true });
    const applyToolPlan = vi.fn(async () => ({ planId: "p", stale: false, needsElevation: false }));
    const planToolApply = vi.fn(async () => planFor(jdk));
    renderLegacyApp({
      getEnvVars: async () => [],
      listToolInstallations: async () => [jdk],
      planToolApply,
      applyToolPlan,
      parseImport: async () => ({
        user: { STAGED: { value: "1", kind: "String" as const } },
        system: {},
      }),
      onApplyProgress: async () => () => {},
      getRegistrySnapshot: async () => ({ user: {}, system: {} }),
      getUnsupportedEnvValues: async () => [],
      validatePaths: async () => [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: /import \/ export/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /developer tools/i }));
    await waitFor(() => expect(screen.getByText(/21.0.12/)).toBeInTheDocument());
    await user.click(screen.getByText(/21.0.12/));
    await waitFor(() => expect(planToolApply).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /import \/ export/i }));
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    fireEvent.change(screen.getByPlaceholderText(/paste file contents/i), {
      target: { value: '{"user":{},"system":{}}' },
    });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await user.click(await screen.findByRole("button", { name: /stage 1 variable/i }));

    await user.click(screen.getByRole("button", { name: /developer tools/i }));
    await user.click(screen.getByRole("button", { name: /apply plan/i }));
    await waitFor(() => expect(screen.getByText(ENVIRONMENT_PENDING_TOOLS_MESSAGE)).toBeInTheDocument());
    expect(applyToolPlan).not.toHaveBeenCalled();
  });

  it("refuses PATH cleanup planning from the legacy screen while edits are staged", async () => {
    const planPathCleanup = vi.fn(async () => ({
      planId: "cleanup",
      tool: "java" as const,
      requiresUac: false,
      warnings: [],
      limitationNotice: "",
      userDiffs: [{ name: "PATH", scope: "User" as const, kind: "changed" as const, before: "a", after: "b" }],
      systemDiffs: [],
      effectiveAfterUserOnly: false,
      selected: { tool: "java" as const, vendor: "x", version: "1", root: "C:\\x", managed: false },
      removedDuplicates: [],
      removedMissing: [],
    }));
    renderLegacyApp({
      getEnvVars: async () => [],
      listToolInstallations: async () => [],
      planPathCleanup,
      parseImport: async () => ({
        user: { STAGED: { value: "1", kind: "String" as const } },
        system: {},
      }),
      getRegistrySnapshot: async () => ({ user: {}, system: {} }),
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: /import \/ export/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /import \/ export/i }));
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    fireEvent.change(screen.getByPlaceholderText(/paste file contents/i), {
      target: { value: '{"user":{},"system":{}}' },
    });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await user.click(await screen.findByRole("button", { name: /stage 1 variable/i }));

    await user.click(screen.getByRole("button", { name: /developer tools/i }));
    await user.click(screen.getByRole("button", { name: /clean up path/i }));
    await waitFor(() => expect(screen.getByText(ENVIRONMENT_PENDING_TOOLS_MESSAGE)).toBeInTheDocument());
    expect(planPathCleanup).not.toHaveBeenCalled();
  });

  it("desktop shell rescan reads account context through the shared coordinator", async () => {
    const jdk = inst("java", "21.0.2", "C:\\new", { effective: true, selected: false });
    const getSelectedAccount = vi.fn(async () => ({
      sid: "S-1-2-3",
      username: "tester",
      hasProfile: true,
      currentlyLoggedIn: true,
    }));
    const listToolInstallations = vi.fn(async (tool: string) => (tool === "java" ? [jdk] : []));
    const { api: fake } = fakeToolsRuntime({
      listToolInstallations,
      getSelectedAccount,
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
    });
    configureProductionServices(splitWhichcraftApi(fake));

    render(
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider>
            <DesktopShellApp />
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    );

    await waitFor(() => expect(getSelectedAccount).toHaveBeenCalled());
    const user = userEvent.setup();
    const callsBefore = getSelectedAccount.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /^rescan$/i }));
    await waitFor(() => expect(getSelectedAccount.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() => expect(listToolInstallations.mock.calls.length).toBeGreaterThanOrEqual(12));
    expect(screen.getByText(/^This PC$/i)).toBeInTheDocument();
    void user;
  });
});
