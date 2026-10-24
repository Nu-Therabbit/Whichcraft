import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

import { AppServicesProvider } from "../../composition/AppServicesContext";
import { splitEnvarlyApi } from "../../composition/appServices";
import { configureProductionServices } from "../../composition/createProductionServices";
import {
  createWriteCoordinator,
  type WriteCoordinatorFacade,
} from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
import type { EnvSnapshot, SnapshotMeta } from "../../types";
import { fakeToolsRuntime, inst } from "../tools/testHarness";
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
  listProfiles: async () => [{ id: "p1", name: "Work", tools: {} }],
  profileStatus: async (p: { profile: unknown }) => ({
    profile: p.profile,
    matchesEffective: true,
    unavailable: [],
  }),
};

const REGISTRY_VARS = [
  {
    name: "KEEP",
    value: "current",
    valueKind: "String" as const,
    scope: "User" as const,
    listSeparator: null,
  },
  {
    name: "REMOVE",
    value: "gone",
    valueKind: "String" as const,
    scope: "User" as const,
    listSeparator: null,
  },
  {
    name: "KINDONLY",
    value: "same",
    valueKind: "String" as const,
    scope: "User" as const,
    listSeparator: null,
  },
];

const CURRENT: EnvSnapshot = {
  user: {
    KEEP: { value: "current", kind: "String" },
    REMOVE: { value: "gone", kind: "String" },
    KINDONLY: { value: "same", kind: "String" },
  },
  system: {},
};

const SNAP: SnapshotMeta = {
  version: 2,
  id: "snap-1",
  createdAt: "2024-01-01T12:00:00Z",
  label: "Before change",
  snapshot: {
    user: {
      KEEP: { value: "saved", kind: "String" },
      NEW: { value: "x", kind: "String" },
      KINDONLY: { value: "same", kind: "ExpandString" },
    },
    system: {},
  },
};

function renderShell(
  apiOverrides: Record<string, unknown> = {},
  coordination: WriteCoordinatorFacade = createWriteCoordinator(),
) {
  const { api } = fakeToolsRuntime({ ...sdkMocks, ...apiOverrides }, coordination);
  configureProductionServices(splitEnvarlyApi(api));
  return {
    coordination,
    ...render(
      <AppServicesProvider services={splitEnvarlyApi(api)}>
        <WriteCoordinatorProvider coordinator={coordination}>
          <DesktopShellApp />
        </WriteCoordinatorProvider>
      </AppServicesProvider>,
    ),
  };
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
      getEnvVars: async () => REGISTRY_VARS,
      createSnapshot,
      listSnapshots,
      getRegistrySnapshot,
      applyEnvChanges,
      getUnsupportedEnvValues: async () => [],
      validatePaths: async () => [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Before change")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^save snapshot$/i }));
    await waitFor(() => expect(createSnapshot).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => expect(getRegistrySnapshot).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /^stage restore$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^stage restore$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /4 staged/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("tab", { name: /^variables$/i }));
    await user.click(screen.getByText("REMOVE"));
    expect(await screen.findByText(/staged: delete/i)).toBeInTheDocument();
    expect(applyEnvChanges).not.toHaveBeenCalled();
  });

  it("asks before replacing existing staged work when restoring a snapshot", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderShell({
      getEnvVars: async () => REGISTRY_VARS,
      listSnapshots: async () => [SNAP],
      getRegistrySnapshot: async () => CURRENT,
      createSnapshot: vi.fn(),
      getUnsupportedEnvValues: async () => [],
      validatePaths: async () => [],
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("Before change")).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /variables/i }));
    await user.click(await screen.findByText("KEEP"));
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    await user.type(editor, "pending");
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /new variable/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^name$/i), "ORPHAN");
    await user.type(within(dialog).getByLabelText(/^value$/i), "only-staged");
    await user.click(within(dialog).getByRole("button", { name: /^stage new variable$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /2 staged/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("tab", { name: /snapshots/i }));
    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^stage restore$/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /2 staged/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^preview$/i }));
    await user.click(await screen.findByRole("button", { name: /^stage restore$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /4 staged/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText("ORPHAN")).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("refreshes tool and profile read models after a successful environment apply", async () => {
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "variables" }),
    );
    const coordination = createWriteCoordinator();
    const jdk = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    const listToolInstallations = vi.fn(async (tool: string) => (tool === "java" ? [jdk] : []));
    const listProfiles = vi.fn(async () => [{ id: "p1", name: "Work", tools: {} }]);
    const applyEnvChanges = vi.fn(async () => {});
    const onApplyProgress = vi.fn(async (cb: (event: { index: number; total: number }) => void) => {
      cb({ index: 1, total: 1 });
      return () => {};
    });

    renderShell(
      {
        getEnvVars: async () => [
          {
            name: "PATH",
            value: "C:\\old",
            valueKind: "ExpandString" as const,
            scope: "User" as const,
            listSeparator: null,
          },
        ],
        listSnapshots: async () => [],
        getRegistrySnapshot: async () => ({ user: {}, system: {} }),
        getUnsupportedEnvValues: async () => [],
        validatePaths: async () => [],
        listToolInstallations,
        listProfiles,
        applyEnvChanges,
        onApplyProgress,
      },
      coordination,
    );

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("PATH")).toBeInTheDocument());
    const installsBeforeApply = listToolInstallations.mock.calls.length;
    const profilesBeforeApply = listProfiles.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /^PATH$/i }));
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    fireEvent.change(editor, { target: { value: "C:\\new" } });
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await user.click(screen.getByRole("button", { name: /1 staged/i }));
    await user.click(await screen.findByRole("button", { name: /apply 1 change to registry/i }));

    await waitFor(() => expect(applyEnvChanges).toHaveBeenCalled());
    await waitFor(() =>
      expect(listToolInstallations.mock.calls.length).toBeGreaterThan(installsBeforeApply),
    );
    await waitFor(() =>
      expect(listProfiles.mock.calls.length).toBeGreaterThan(profilesBeforeApply),
    );
  });
});
