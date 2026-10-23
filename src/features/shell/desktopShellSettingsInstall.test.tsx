import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../../contexts/UndoContext";
import { splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { EnvironmentProvider } from "../environment/EnvironmentContext";
import { fakeToolsRuntime, inst } from "../tools/testHarness";
import { DesktopShellApp } from "./DesktopShellApp";
import { shellNavigationHref } from "../../lib/shellNavigation";

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

function renderDesktopShell(
  services: ReturnType<typeof splitEnvarlyApi>,
  { withEnvironment = false }: { withEnvironment?: boolean } = {},
) {
  configureProductionServices(services);
  const app = <DesktopShellApp />;
  return render(
    <UndoProvider>
      <AppServicesProvider services={services}>
        <WriteCoordinatorProvider>
          {withEnvironment ? <EnvironmentProvider>{app}</EnvironmentProvider> : app}
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

  it("saves scan roots and install store from Settings without dropping old-store installations", async () => {
    const oldStoreInstall = inst("java", "11.0.2", "D:\\old-store\\java\\11", { managed: true });
    const listToolInstallations = vi.fn(async () => [oldStoreInstall]);
    const saveWhichcraftSettings = vi.fn(async (settings: unknown) => settings);
    const getWhichcraftSettings = vi.fn(async () => ({
      installStore: "D:\\old-store",
      scanRoots: ["C:\\scan"],
      terminal: "windows_terminal" as const,
      installStoreConfirmed: true,
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
    const storeInput = screen.getByRole("textbox", { name: "Install folder" });
    expect(storeInput).toHaveValue("D:\\old-store");
    expect(screen.getByText("C:\\scan")).toBeInTheDocument();
    await user.clear(storeInput);
    await user.type(storeInput, "E:\\new-store");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(saveWhichcraftSettings).toHaveBeenCalled());
    await waitFor(() => expect(listToolInstallations.mock.calls.length).toBeGreaterThan(0));

    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Java/i })).toBeInTheDocument());
    await waitFor(() =>
      expect(listToolInstallations.mock.calls.some(() => true)).toBe(true),
    );
    expect(await screen.findByRole("button", { name: /Java/i })).toBeInTheDocument();
  });

  it("lists remote versions and keeps install busy status after navigating to Settings", async () => {
    const listRemoteVersions = vi.fn(async () => [
      { version: "22.0.1", downloadBytes: 1000, installBytes: 2000 },
    ]);
    const getMiseStatus = vi.fn(async () => ({
      version: "2026.10.1",
      present: true,
      downloadBytes: 1,
      oldVersions: [],
      fetching: false,
    }));
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
        getMiseStatus,
        downloadSize: async () => ({ downloadBytes: 1000, diskBytes: 2000 }),
        installManaged,
      }).api,
    );
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools", installOpen: true }));
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Node\.js/i }));
    await waitFor(() => expect(listRemoteVersions).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /22\.0\.1/ })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /22\.0\.1/ }));
    await user.click(screen.getByRole("button", { name: /^install$/i }));

    await waitFor(() => expect(installManaged).toHaveBeenCalledWith("node", "22.0.1"));
    expect(screen.getAllByText(/installing/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("link", { name: /^settings/i }));
    expect(screen.getAllByText(/installing/i).length).toBeGreaterThan(0);

    installDone?.();
    await waitFor(() => expect(screen.queryAllByText(/installing/i)).toHaveLength(0));
  });

  it("does not offer install for Git", async () => {
    const services = splitEnvarlyApi(
      fakeToolsRuntime({
        ...sdkMocks,
        listToolInstallations: async (tool: string) =>
          tool === "git"
            ? [inst("git", "2.45.0", "C:\\Git", { effective: true, selected: true })]
            : [],
      }).api,
    );
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools", installOpen: true }));
    renderDesktopShell(services);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Git/i }));
    expect(screen.getByText(/switch-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^install$/i })).not.toBeInTheDocument();
  });
});
