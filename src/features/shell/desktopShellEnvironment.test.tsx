import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { ENVIRONMENT_PENDING_TOOLS_MESSAGE, WRITE_BUSY_MESSAGE } from "../../coordination/types";
import { fakeToolsRuntime, inst, planFor } from "../tools/testHarness";
import { DesktopShellApp } from "./DesktopShellApp";
import { shellNavigationHref } from "../../lib/shellNavigation";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

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

function renderDesktopShell(services = splitEnvarlyApi(fakeToolsRuntime({ ...sdkMocks }).api)) {
  configureProductionServices(services);
  return render(
    <AppServicesProvider services={services}>
      <WriteCoordinatorProvider>
        <DesktopShellApp />
      </WriteCoordinatorProvider>
    </AppServicesProvider>,
  );
}

describe("desktop shell environment workspace", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(null, "", "/?presentation=desktop-shell");
  });

  it("loads variables and keeps staged edits when switching environment tabs", async () => {
    const getEnvVars = vi.fn(async () => [
      {
        name: "STAGE_ME",
        value: "one",
        valueKind: "String" as const,
        scope: "User" as const,
        listSeparator: null,
      },
    ]);
    const services = splitEnvarlyApi(fakeToolsRuntime({ ...sdkMocks, getEnvVars }).api);
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "variables" }),
    );
    renderDesktopShell(services);

    await waitFor(() => expect(getEnvVars).toHaveBeenCalled());
    expect(await screen.findByText("STAGE_ME")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText("STAGE_ME"));
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    await user.type(editor, "two");
    await user.click(screen.getByRole("button", { name: /^stage$/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("tab", { name: /snapshots/i }));
    await user.click(screen.getByRole("tab", { name: /variables/i }));
    expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument();
  });

  it("blocks tool apply while staged environment edits are pending", async () => {
    const applyToolPlan = vi.fn(async () => ({ planId: "p", stale: false, needsElevation: false }));
    const jdk17 = inst("java", "17.0.2", "C:\\jdk17", { effective: true, selected: true });
    const jdk21 = inst("java", "21.0.1", "C:\\jdk21");
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getEnvVars: async () => [
          {
            name: "BLOCK_TOOLS",
            value: "x",
            valueKind: "String" as const,
            scope: "User" as const,
            listSeparator: null,
          },
        ],
        listToolInstallations: async (tool: string) => (tool === "java" ? [jdk17, jdk21] : []),
        planToolApply: async () => planFor(jdk21),
        applyToolPlan,
      }).api,
    );
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools" }));
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Java/i }));
    await user.click(
      await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 21\.0\.1/i }),
    );
    await screen.findByRole("button", { name: /^Apply plan$/i });

    await user.click(screen.getByRole("link", { name: /^environment/i }));
    await screen.findByText("BLOCK_TOOLS");
    await user.click(screen.getByText("BLOCK_TOOLS"));
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    await user.type(editor, "changed");
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    await user.click(await screen.findByRole("button", { name: /^Apply plan$/i }));

    await waitFor(() => expect(applyToolPlan).not.toHaveBeenCalled());
    expect(screen.getAllByText(ENVIRONMENT_PENDING_TOOLS_MESSAGE).length).toBeGreaterThan(0);
  });

  it("releases coordinator admission when apply progress subscription fails", async () => {
    const onApplyProgress = vi.fn(async () => {
      throw new Error("subscribe failed");
    });
    const applyEnvChanges = vi.fn(async () => {});
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getEnvVars: async () => [
          {
            name: "APPLY_ME",
            value: "v",
            valueKind: "String" as const,
            scope: "User" as const,
            listSeparator: null,
          },
        ],
        onApplyProgress,
        applyEnvChanges,
        getRegistrySnapshot: async () => ({ user: {}, system: {} }),
        getUnsupportedEnvValues: async () => [],
        validatePaths: async () => [],
      }).api,
    );
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "variables" }),
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await screen.findByText("APPLY_ME");
    await user.click(screen.getByText("APPLY_ME"));
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    await user.type(editor, "next");
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await user.click(screen.getByRole("button", { name: /1 staged/i }));
    await user.click(await screen.findByRole("button", { name: /apply 1 change to registry/i }));

    await waitFor(() => expect(onApplyProgress).toHaveBeenCalled());
    expect(applyEnvChanges).not.toHaveBeenCalled();
    expect(await screen.findByText(/subscribe failed/i)).toBeInTheDocument();

    const applyButton = screen.getByRole("button", { name: /apply 1 change to registry/i });
    await user.click(applyButton);
    await waitFor(() => expect(onApplyProgress).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(WRITE_BUSY_MESSAGE)).not.toBeInTheDocument();
    expect(applyEnvChanges).not.toHaveBeenCalled();
  });

  it("keeps staged apply error visible after leaving the Environment page", async () => {
    const onApplyProgress = vi.fn(async () => {
      throw new Error("subscribe failed");
    });
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getEnvVars: async () => [
          {
            name: "KEEP_ERR",
            value: "v",
            valueKind: "String" as const,
            scope: "User" as const,
            listSeparator: null,
          },
        ],
        onApplyProgress,
        applyEnvChanges: vi.fn(async () => {}),
        getRegistrySnapshot: async () => ({ user: {}, system: {} }),
        getUnsupportedEnvValues: async () => [],
        validatePaths: async () => [],
        listToolInstallations: async () => [],
      }).api,
    );
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "variables" }),
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await screen.findByText("KEEP_ERR");
    await user.click(screen.getByText("KEEP_ERR"));
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    await user.type(editor, "next");
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await user.click(screen.getByRole("button", { name: /1 staged/i }));
    await user.click(await screen.findByRole("button", { name: /apply 1 change to registry/i }));
    await waitFor(() => expect(screen.getByText(/subscribe failed/i)).toBeInTheDocument());

    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    expect(screen.getByText(/subscribe failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply 1 change to registry/i })).toBeInTheDocument();
  });
});
