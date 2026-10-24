import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { splitEnvarlyApi } from "../../composition/appServices";
import { configureProductionServices } from "../../composition/createProductionServices";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
import { fakeToolsRuntime, inst } from "../../test/toolsTestHarness";
import { DesktopShellApp } from "./DesktopShellApp";

const sdkMocks = {
  getSelectedAccount: async () => null,
  getEnvVars: async () => [],
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
  listProfiles: async () => [],
  profileStatus: async (p: { profile: unknown }) => ({
    profile: p.profile,
    matchesEffective: true,
    unavailable: [],
  }),
};

function renderDesktopShell(services: ReturnType<typeof splitEnvarlyApi>) {
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

describe("desktop shell settings and install", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(null, "", "/?presentation=desktop-shell");
  });

  it("saves scan roots and terminal, keeps previous store history, and lists old-store installs after store change", async () => {
    const oldStoreInstall = inst("java", "11.0.2", "D:\\old-store\\java\\11", {
      managed: true,
      effective: true,
      selected: true,
    });
    const listToolInstallations = vi.fn(async () => [oldStoreInstall]);
    const saveWhichcraftSettings = vi.fn(async (settings: unknown) => settings);
    const getWhichcraftSettings = vi.fn(async () => ({
      installStore: "D:\\old-store",
      scanRoots: ["C:\\scan"],
      terminal: "windows_terminal" as const,
      installStoreConfirmed: true,
      previousInstallStores: ["D:\\legacy-store"],
    }));
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getWhichcraftSettings,
        saveWhichcraftSettings,
        listToolInstallations,
      }).api,
    );
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools" }));
    renderDesktopShell(services);

    const user = userEvent.setup();
    await screen.findByRole("button", { name: /Java/i });
    await waitFor(() => expect(getWhichcraftSettings).toHaveBeenCalled());
    await user.click(screen.getByRole("link", { name: /^settings/i }));
    await screen.findByTestId("shell-settings-ready");
    expect(screen.getByText("D:\\legacy-store")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /terminal/i }), "power_shell");
    await waitFor(() =>
      expect(saveWhichcraftSettings).toHaveBeenCalledWith(
        expect.objectContaining({ terminal: "power_shell" }),
      ),
    );

    await user.type(screen.getByRole("textbox", { name: /folder to scan/i }), "E:\\extra");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() =>
      expect(saveWhichcraftSettings).toHaveBeenCalledWith(
        expect.objectContaining({ scanRoots: expect.arrayContaining(["C:\\scan", "E:\\extra"]) }),
      ),
    );

    const storeInput = screen.getByRole("textbox", { name: "Install folder" });
    await user.clear(storeInput);
    await user.type(storeInput, "E:\\new-store");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(saveWhichcraftSettings).toHaveBeenCalled());
    await waitFor(() => expect(listToolInstallations.mock.calls.length).toBeGreaterThan(1));

    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    expect(
      await screen.findByRole("button", { name: /Java, Windows uses 11\.0\.2/i }),
    ).toBeInTheDocument();
  });

  it("refreshes the tool overview after install via coordinator invalidation", async () => {
    const node20 = inst("node", "20.0.0", "C:\\node20", { effective: true, selected: true });
    const node22 = inst("node", "22.0.1", "C:\\store\\node\\22.0.1", { managed: true });
    let installFinished = false;
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool !== "node") return [];
      return installFinished ? [node20, node22] : [node20];
    });
    const listRemoteVersions = vi.fn(async () => [
      { version: "22.0.1", downloadBytes: 1000, installBytes: 2000 },
    ]);
    const installManaged = vi.fn(async () => {
      installFinished = true;
      return "C:\\store\\node\\22.0.1";
    });
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getWhichcraftSettings: async () => ({
          installStore: "C:\\store",
          scanRoots: [],
          terminal: "windows_terminal" as const,
          installStoreConfirmed: true,
        }),
        listToolInstallations,
        listRemoteVersions,
        getMiseStatus: async () => ({
          version: "2026.10.1",
          present: true,
          downloadBytes: 1,
          oldVersions: [],
          fetching: false,
        }),
        downloadSize: async () => ({ downloadBytes: 1000, diskBytes: 2000 }),
        installManaged,
      }).api,
    );
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "tools", installOpen: true }),
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Node\.js/i }));
    await waitFor(() => expect(listRemoteVersions).toHaveBeenCalledTimes(1));
    const installSection = await screen.findByRole("region", { name: /install node/i });
    await user.click(within(installSection).getByRole("button", { name: "22.0.1" }));
    await user.click(within(installSection).getByRole("button", { name: /^install$/i }));

    await waitFor(() => expect(installManaged).toHaveBeenCalledWith("node", "22.0.1"));
    await waitFor(() => expect(listToolInstallations.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(
      await screen.findByRole("button", {
        name: /Node\.js, Windows uses 20\.0\.0.*2 installations/i,
      }),
    ).toBeInTheDocument();
  });

  it("lists remote versions and keeps install busy status after navigating to Settings", async () => {
    const listRemoteVersions = vi.fn(async () => [
      { version: "22.0.1", downloadBytes: 1000, installBytes: 2000 },
    ]);
    let installDone: (() => void) | null = null;
    const installManaged = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          installDone = resolve;
        }),
    );
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getWhichcraftSettings: async () => ({
          installStore: "C:\\store",
          scanRoots: [],
          terminal: "windows_terminal" as const,
          installStoreConfirmed: true,
        }),
        listToolInstallations: async () => [
          inst("node", "20.0.0", "C:\\node20", { effective: true, selected: true }),
        ],
        listRemoteVersions,
        getMiseStatus: async () => ({
          version: "2026.10.1",
          present: true,
          downloadBytes: 1,
          oldVersions: [],
          fetching: false,
        }),
        downloadSize: async () => ({ downloadBytes: 1000, diskBytes: 2000 }),
        installManaged,
      }).api,
    );
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "tools", installOpen: true }),
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Node\.js/i }));
    await waitFor(() => expect(listRemoteVersions).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /22\.0\.1/ }));
    await user.click(screen.getByRole("button", { name: /^install$/i }));

    await waitFor(() => expect(installManaged).toHaveBeenCalledWith("node", "22.0.1"));
    expect(screen.getAllByText(/installing/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("link", { name: /^settings/i }));
    expect(screen.getAllByText(/installing/i).length).toBeGreaterThan(0);

    installDone?.();
    await waitFor(() => expect(screen.queryAllByText(/installing/i)).toHaveLength(0));
  });

  it("does not reopen install listing or wipe a failed install error when returning to install=1", async () => {
    const listRemoteVersions = vi.fn(async () => [
      { version: "22.0.1", downloadBytes: 1000, installBytes: 2000 },
    ]);
    const installManaged = vi.fn(async () => {
      throw new Error("download cancelled by user");
    });
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getWhichcraftSettings: async () => ({
          installStore: "C:\\store",
          scanRoots: [],
          terminal: "windows_terminal" as const,
          installStoreConfirmed: true,
        }),
        listToolInstallations: async () => [
          inst("node", "20.0.0", "C:\\node20", { effective: true, selected: true }),
        ],
        listRemoteVersions,
        getMiseStatus: async () => ({
          version: "2026.10.1",
          present: true,
          downloadBytes: 1,
          oldVersions: [],
          fetching: false,
        }),
        downloadSize: async () => ({ downloadBytes: 1000, diskBytes: 2000 }),
        installManaged,
      }).api,
    );
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "tools", installOpen: true }),
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Node\.js/i }));
    await waitFor(() => expect(listRemoteVersions).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /22\.0\.1/ }));
    await user.click(screen.getByRole("button", { name: /^install$/i }));
    expect(await screen.findAllByText(/download cancelled by user/i)).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /close install/i }));
    window.history.pushState(null, "", shellNavigationHref({ page: "tools", installOpen: true }));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(await screen.findAllByText(/download cancelled by user/i)).not.toHaveLength(0);
    expect(listRemoteVersions).toHaveBeenCalledTimes(1);
  });

  it("installs without applying a tool plan or writing the environment", async () => {
    const applyToolPlan = vi.fn(async () => ({ planId: "p", stale: false, needsElevation: false }));
    const setEnvVar = vi.fn(async () => {});
    const listRemoteVersions = vi.fn(async () => [
      { version: "22.0.1", downloadBytes: 1000, installBytes: 2000 },
    ]);
    const installManaged = vi.fn(async () => "C:\\store\\node\\22.0.1");
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        setEnvVar,
        applyToolPlan,
        getWhichcraftSettings: async () => ({
          installStore: "C:\\store",
          scanRoots: [],
          terminal: "windows_terminal" as const,
          installStoreConfirmed: true,
        }),
        listToolInstallations: async () => [
          inst("node", "20.0.0", "C:\\node20", { effective: true, selected: true }),
        ],
        listRemoteVersions,
        getMiseStatus: async () => ({
          version: "2026.10.1",
          present: true,
          downloadBytes: 1,
          oldVersions: [],
          fetching: false,
        }),
        downloadSize: async () => ({ downloadBytes: 1000, diskBytes: 2000 }),
        installManaged,
      }).api,
    );
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "tools", installOpen: true }),
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Node\.js/i }));
    await user.click(await screen.findByRole("button", { name: /22\.0\.1/ }));
    await user.click(screen.getByRole("button", { name: /^install$/i }));

    await waitFor(() => expect(installManaged).toHaveBeenCalled());
    expect(applyToolPlan).not.toHaveBeenCalled();
    expect(setEnvVar).not.toHaveBeenCalled();
  });

  it("does not offer install or update for Git", async () => {
    const listRemoteVersions = vi.fn(async () => [
      { version: "2.50.0", downloadBytes: null, installBytes: null },
    ]);
    const updateCandidates = vi.fn(async () => [
      { root: "C:\\Git", current: "2.45.0", latest: "2.50.0" },
    ]);
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        listRemoteVersions,
        updateCandidates,
        listToolInstallations: async (tool: string) =>
          tool === "git"
            ? [inst("git", "2.45.0", "C:\\Git", { effective: true, selected: true })]
            : [],
      }).api,
    );
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "tools", installOpen: true }),
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Git/i }));
    expect(screen.getByText(/switch-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^install$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check for updates/i })).not.toBeInTheDocument();
    expect(listRemoteVersions).not.toHaveBeenCalled();
    expect(updateCandidates).not.toHaveBeenCalled();
  });

  it("asks which tool to install when Install tool is pressed with nothing selected", async () => {
    const listRemoteVersions = vi.fn(async () => [
      { version: "22.0.1", downloadBytes: 1000, installBytes: 2000 },
    ]);
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        getWhichcraftSettings: async () => ({
          installStore: "C:\\store",
          scanRoots: [],
          terminal: "windows_terminal" as const,
          installStoreConfirmed: true,
        }),
        listToolInstallations: async () => [],
        listRemoteVersions,
        getMiseStatus: async () => ({
          version: "2026.10.1",
          present: true,
          downloadBytes: 1,
          oldVersions: [],
          fetching: false,
        }),
      }).api,
    );
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /install tool/i }));
    const picker = await screen.findByRole("group", { name: /choose a tool to install/i });
    expect(within(picker).queryByRole("radio", { name: /^git$/i })).not.toBeInTheDocument();
    expect(listRemoteVersions).not.toHaveBeenCalled();

    await user.click(within(picker).getByRole("radio", { name: /node\.js/i }));
    await waitFor(() => expect(listRemoteVersions).toHaveBeenCalledWith("node"));
  });

  it("summarizes the scanned inventory in the status bar", async () => {
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        listToolInstallations: async (tool: string) =>
          tool === "node"
            ? [
                inst("node", "20.0.0", "C:\\node20", { effective: true, selected: true }),
                inst("node", "18.0.0", "C:\\node18", { available: false }),
              ]
            : [],
      }).api,
    );
    renderDesktopShell(services);

    const footer = await screen.findByRole("contentinfo");
    await waitFor(() =>
      expect(footer).toHaveTextContent(/2 installations across 6 tools · 1 unavailable/i),
    );
    expect(screen.getByTitle(/inventory of this pc is up to date/i)).toBeInTheDocument();
  });

  it("does not present a partly failed scan as an up-to-date PC", async () => {
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        listToolInstallations: async (tool: string) => {
          if (tool === "go") throw new Error("scan root unreadable");
          return [];
        },
      }).api,
    );
    renderDesktopShell(services);

    const footer = await screen.findByRole("contentinfo");
    await waitFor(() => expect(footer).toHaveTextContent(/1 tool could not be scanned/i));
    expect(screen.getByTitle(/inventory is incomplete/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/up to date/i)).not.toBeInTheDocument();
  });
});
