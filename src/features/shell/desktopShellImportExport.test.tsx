import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { splitWhichcraftApi } from "../../composition/appServices";
import { configureProductionServices } from "../../composition/createProductionServices";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
import { fakeToolsRuntime, inst } from "../../test/toolsTestHarness";
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

const IMPORT_SNAP = {
  user: { IMPORTED: { value: "from-file", kind: "String" as const } },
  system: {},
};

function renderShell(apiOverrides: Record<string, unknown> = {}) {
  const services = splitWhichcraftApi(fakeToolsRuntime({ ...sdkMocks, ...apiOverrides }).api);
  configureProductionServices(services);
  return render(
    <UndoProvider>
      <AppServicesProvider services={services}>
        <WriteCoordinatorProvider>
          <DesktopShellApp />
        </WriteCoordinatorProvider>
      </AppServicesProvider>
    </UndoProvider>,
  );
}

describe("desktop shell import export", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "import-export" }),
    );
  });

  it("parses import preview and stages without registry writes", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const parseImport = vi.fn(async () => IMPORT_SNAP);
    const applyEnvChanges = vi.fn(async () => {});
    const setEnvVar = vi.fn(async () => {});
    renderShell({
      getEnvVars: async () => [],
      parseImport,
      applyEnvChanges,
      setEnvVar,
      getRegistrySnapshot: async () => ({ user: {}, system: {} }),
    });

    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /import \/ export/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    const textarea = await screen.findByPlaceholderText(/paste file contents/i);
    fireEvent.change(textarea, { target: { value: '{"user":{}}' } });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await waitFor(() => expect(parseImport).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: /stage 1 variable/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );
    expect(applyEnvChanges).not.toHaveBeenCalled();
    expect(setEnvVar).not.toHaveBeenCalled();
  });

  it("reads a chosen .reg file and parses it in REG format", async () => {
    const parseImport = vi.fn(async () => IMPORT_SNAP);
    renderShell({
      getEnvVars: async () => [],
      parseImport,
      getRegistrySnapshot: async () => ({ user: {}, system: {} }),
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /^import$/i }));
    const regFile = new File(
      ['Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Environment]\r\n"FOO"="bar"\r\n'],
      "backup.reg",
      { type: "text/plain" },
    );
    await user.upload(screen.getByLabelText(/^import file$/i), regFile);
    const contents = screen.getByPlaceholderText(/paste file contents/i) as HTMLTextAreaElement;
    await waitFor(() => expect(contents.value).toContain('"FOO"="bar"'));
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await waitFor(() =>
      expect(parseImport).toHaveBeenCalledWith(expect.stringContaining('"FOO"="bar"'), "reg"),
    );
    expect(await screen.findByRole("button", { name: /stage 1 variable/i })).toBeInTheDocument();
  });

  it("reports parse errors without staging", async () => {
    const parseImport = vi.fn(async () => {
      throw new Error("invalid json");
    });
    renderShell({ getEnvVars: async () => [], parseImport });
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /import \/ export/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    fireEvent.change(await screen.findByPlaceholderText(/paste file contents/i), {
      target: { value: "{bad" },
    });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    expect(await screen.findByText(/parse failed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /staged/i })).not.toBeInTheDocument();
  });

  it("asks before replacing existing staged work when staging an import", async () => {
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "variables" }),
    );
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
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
      parseImport: async () => IMPORT_SNAP,
      getRegistrySnapshot: async () => ({ user: {}, system: {} }),
    });

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getAllByText("KEEP").length).toBeGreaterThan(0));
    await user.click(screen.getAllByText("KEEP")[0]);
    const editor = await screen.findByLabelText(/^value$/i);
    await user.clear(editor);
    await user.type(editor, "pending");
    await user.click(screen.getByRole("button", { name: /^stage$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("tab", { name: /^import \/ export$/i }));
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    fireEvent.change(await screen.findByPlaceholderText(/paste file contents/i), {
      target: { value: '{"user":{}}' },
    });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await user.click(await screen.findByRole("button", { name: /stage 1 variable/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^variables$/i }));
    await user.click(screen.getAllByText("KEEP")[0]);
    expect(await screen.findByLabelText(/^value$/i)).toHaveValue("pending");

    await user.click(screen.getByRole("tab", { name: /^import \/ export$/i }));
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    fireEvent.change(await screen.findByPlaceholderText(/paste file contents/i), {
      target: { value: '{"user":{}}' },
    });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await user.click(await screen.findByRole("button", { name: /stage 1 variable/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("tab", { name: /^variables$/i }));
    await user.click(screen.getAllByText("KEEP")[0]);
    expect(await screen.findByLabelText(/^value$/i)).toHaveValue("current");
    confirmSpy.mockRestore();
  });

  it("export uses the platform API and does not rescan tool installations", async () => {
    const exportVars = vi.fn(async () => "C:\\out\\env.json");
    const listToolInstallations = vi.fn(async () => [
      inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true }),
    ]);
    renderShell({
      getEnvVars: async () => [
        {
          name: "A",
          value: "1",
          valueKind: "String" as const,
          scope: "User" as const,
          listSeparator: null,
        },
      ],
      exportVars,
      listToolInstallations,
    });

    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /import \/ export/i })).toBeInTheDocument(),
    );
    await waitFor(() => expect(listToolInstallations.mock.calls.length).toBeGreaterThan(0));
    const callsBefore = listToolInstallations.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /export all/i }));
    await waitFor(() => expect(exportVars).toHaveBeenCalled());
    expect(listToolInstallations.mock.calls.length).toBe(callsBefore);
  });
});
