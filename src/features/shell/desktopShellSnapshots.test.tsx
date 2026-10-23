import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));
import { UndoProvider } from "../../contexts/UndoContext";
import { splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { EnvironmentProvider } from "../environment/EnvironmentContext";
import { fakeToolsRuntime } from "../tools/testHarness";
import { DesktopShellApp } from "./DesktopShellApp";
import { ShellEnvironmentUiProvider } from "./ShellEnvironmentUiContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
import type { EnvSnapshot, SnapshotMeta } from "../../types";

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

const CURRENT: EnvSnapshot = {
  user: { KEEP: { value: "current", kind: "String" } },
  system: {},
};

const SNAP: SnapshotMeta = {
  version: 2,
  id: "snap-1",
  createdAt: "2024-01-01T12:00:00Z",
  label: "Before change",
  snapshot: {
    user: { KEEP: { value: "saved", kind: "String" }, NEW: { value: "x", kind: "String" } },
    system: {},
  },
};

function renderShell(apiOverrides: Record<string, unknown> = {}) {
  const services = splitEnvarlyApi(fakeToolsRuntime({ ...sdkMocks, ...apiOverrides }).api);
  configureProductionServices(services);
  return render(
    <UndoProvider>
      <AppServicesProvider services={services}>
        <WriteCoordinatorProvider>
          <EnvironmentProvider>
            <ShellEnvironmentUiProvider>
              <DesktopShellApp />
            </ShellEnvironmentUiProvider>
          </EnvironmentProvider>
        </WriteCoordinatorProvider>
      </AppServicesProvider>
    </UndoProvider>,
  );
}

describe("desktop shell environment snapshots", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "snapshots" }),
    );
  });

  it("lists snapshots and stages restore preview without writing the registry", async () => {
    const createSnapshot = vi.fn(async (label: string) => ({ ...SNAP, label }));
    const listSnapshots = vi.fn(async () => [SNAP]);
    const getRegistrySnapshot = vi.fn(async () => CURRENT);
    const applyEnvChanges = vi.fn(async () => {});
    renderShell({
      getEnvVars: async () => [
        {
          name: "KEEP",
          value: "current",
          valueKind: "String" as const,
          scope: "User" as const,
          listSeparator: null,
        },
      ],
      createSnapshot,
      listSnapshots,
      getRegistrySnapshot,
      applyEnvChanges,
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Before change")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^save snapshot$/i }));
    await waitFor(() => expect(createSnapshot).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => expect(getRegistrySnapshot).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /^stage restore$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^stage restore$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /2 staged/i })).toBeInTheDocument());
    expect(applyEnvChanges).not.toHaveBeenCalled();
  });

  it("asks before replacing existing staged work when restoring a snapshot", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderShell({
      getEnvVars: async () => [
        {
          name: "KEEP",
          value: "current",
          valueKind: "String" as const,
          scope: "User" as const,
          listSeparator: null,
        },
      ],
      listSnapshots: async () => [SNAP],
      getRegistrySnapshot: async () => CURRENT,
      createSnapshot: vi.fn(),
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Before change")).toBeInTheDocument());

    await user.click(screen.getByRole("link", { name: /^environment/i }));
    await user.click(screen.getByRole("tab", { name: /variables/i }));
    await user.click(await screen.findByText("KEEP"));
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    await user.type(editor, "pending");
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /snapshots/i }));
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^stage restore$/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^stage restore$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /2 staged/i })).toBeInTheDocument());
    confirmSpy.mockRestore();
  });
});
