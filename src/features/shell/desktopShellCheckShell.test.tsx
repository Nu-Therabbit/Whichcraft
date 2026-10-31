import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));
import { splitWhichcraftApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { fakeToolsRuntime, inst } from "../../test/toolsTestHarness";
import { DesktopShellApp } from "./DesktopShellApp";
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

function renderShell(apiOverrides: Record<string, unknown> = {}) {
  const coordination = createWriteCoordinator();
  const { api } = fakeToolsRuntime({ ...sdkMocks, ...apiOverrides }, coordination);
  configureProductionServices(splitWhichcraftApi(api));
  return {
    coordination,
    api,
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

async function openJavaDetail(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: /Java/i })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: /Java/i }));
  return screen.findByRole("complementary", { name: /installation details/i });
}

describe("desktop shell check command and shell resolution", () => {
  beforeEach(() => {
    configureProductionServices(null);
    window.history.replaceState(null, "", "/?presentation=desktop-shell");
  });

  it("runs check command through the environment API without executing the command", async () => {
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "check-command" }),
    );
    const probeInput = "wc-exec-probe-token.exe";
    const checkCommand = vi.fn(async (input: string) => ({
      input,
      queriedName: input,
      hadExtension: true,
      hits: [{ directory: "C:\\Windows", matchedFile: input, source: "System" as const }],
      fullPathStatus: null,
    }));
    renderShell({ getEnvVars: async () => [], checkCommand });

    const user = userEvent.setup();
    const input = await screen.findByTestId("check-command-input");
    await user.type(input, probeInput);
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await waitFor(() => expect(checkCommand).toHaveBeenCalledWith(probeInput));
    expect(await screen.findByTestId("check-command-hit")).toHaveTextContent(probeInput);
  });

  it("shows shell resolution versus effective installation in the tool inspector", async () => {
    const selected = inst("java", "21.0.1", "C:\\jdk17", { selected: true, effective: false });
    const effective = inst("java", "21.0.1", "C:\\jdk21", { selected: false, effective: true });
    const shellCheck = vi.fn(async () => ({
      tool: "java" as const,
      shell: "windows_terminal" as const,
      effectivePath: "C:\\jdk21\\bin\\java.exe",
      shellPath: "C:\\other\\java.exe",
      matches: false,
    }));
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [selected, effective] : []),
      shellCheck,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    expect(within(details).getByText(/C:\\jdk17/i)).toBeInTheDocument();
    await user.click(within(details).getByRole("button", { name: /check in shell/i }));
    await waitFor(() => expect(shellCheck).toHaveBeenCalledWith("java"));
    const status = await within(details).findByRole("status");
    expect(within(status).getByText(/C:\\jdk21\\bin\\java.exe/i)).toBeInTheDocument();
    expect(within(status).getByText(/C:\\other\\java.exe/i)).toBeInTheDocument();
    expect(within(status).queryByText(/C:\\jdk17\\bin/i)).not.toBeInTheDocument();
  });

  it("opens the configured terminal through the platform API", async () => {
    const jdk = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    const openTerminal = vi.fn(async () => {});
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [jdk] : []),
      openTerminal,
    });
    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await user.click(within(details).getByRole("button", { name: /open terminal/i }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalled());
  });

  it("clears shell check results when the environment read model changes", async () => {
    const jdk = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    let releaseShellCheck: (value: {
      tool: "java";
      shell: "windows_terminal";
      effectivePath: string;
      shellPath: string;
      matches: boolean;
    }) => void = () => {};
    const shellCheck = vi.fn(
      () =>
        new Promise<{
          tool: "java";
          shell: "windows_terminal";
          effectivePath: string;
          shellPath: string;
          matches: boolean;
        }>((resolve) => {
          releaseShellCheck = resolve;
        }),
    );
    const { coordination } = renderShell({
      getEnvVars: async () => [
        {
          name: "PATH",
          value: "C:\\old",
          valueKind: "String" as const,
          scope: "User" as const,
          listSeparator: null,
        },
      ],
      listToolInstallations: async (tool: string) => (tool === "java" ? [jdk] : []),
      shellCheck,
    });

    const user = userEvent.setup();
    const details = await openJavaDetail(user);
    await user.click(within(details).getByRole("button", { name: /check in shell/i }));
    await waitFor(() => expect(shellCheck).toHaveBeenCalledTimes(1));
    expect(within(details).queryByRole("status")).not.toBeInTheDocument();

    coordination.invalidate(["environment-variables"]);

    releaseShellCheck({
      tool: "java",
      shell: "windows_terminal",
      effectivePath: "C:\\jdk21\\bin\\java.exe",
      shellPath: "C:\\other\\java.exe",
      matches: false,
    });
    await waitFor(() => expect(shellCheck).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("link", { name: /^developer tools$/i }));
    const detailsAfter = await openJavaDetail(user);
    expect(within(detailsAfter).queryByRole("status")).not.toBeInTheDocument();
  });

  it("drops a late check command response after environment invalidation", async () => {
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "check-command" }),
    );
    let releaseCheck: (value: {
      input: string;
      queriedName: string;
      hadExtension: boolean;
      hits: { directory: string; matchedFile: string; source: "System" }[];
      fullPathStatus: null;
    }) => void = () => {};
    const checkCommand = vi.fn(
      () =>
        new Promise<{
          input: string;
          queriedName: string;
          hadExtension: boolean;
          hits: { directory: string; matchedFile: string; source: "System" }[];
          fullPathStatus: null;
        }>((resolve) => {
          releaseCheck = resolve;
        }),
    );
    const { coordination } = renderShell({
      getEnvVars: async () => [],
      checkCommand,
    });

    const user = userEvent.setup();
    const input = await screen.findByTestId("check-command-input");
    await user.type(input, "node.exe");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /checking/i })).toBeInTheDocument());

    coordination.invalidate(["environment-variables"]);
    expect(screen.queryByTestId("check-command-hit")).not.toBeInTheDocument();

    releaseCheck({
      input: "node.exe",
      queriedName: "node.exe",
      hadExtension: true,
      hits: [{ directory: "C:\\Windows", matchedFile: "node.exe", source: "System" }],
      fullPathStatus: null,
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /^check$/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId("check-command-hit")).not.toBeInTheDocument());
  });

  it("drops a late check command failure after environment invalidation", async () => {
    window.history.replaceState(
      null,
      "",
      shellNavigationHref({ page: "environment", envTab: "check-command" }),
    );
    let rejectCheck: (error: Error) => void = () => {};
    const checkCommand = vi.fn(
      () =>
        new Promise<never>((_, reject) => {
          rejectCheck = reject;
        }),
    );
    const { coordination } = renderShell({
      getEnvVars: async () => [],
      checkCommand,
    });

    const user = userEvent.setup();
    const input = await screen.findByTestId("check-command-input");
    await user.type(input, "node.exe");
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /checking/i })).toBeInTheDocument());

    coordination.invalidate(["environment-variables"]);
    rejectCheck(new Error("backend boom"));
    await waitFor(() => expect(screen.getByRole("button", { name: /^check$/i })).toBeInTheDocument());
    expect(screen.queryByText(/backend boom/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("check-command-hit")).not.toBeInTheDocument();
  });

  it("checks the inspected tool in the shell and opens a terminal from the command bar", async () => {
    const jdk = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
    const shellCheck = vi.fn(async () => ({
      tool: "java" as const,
      shell: "windows_terminal" as const,
      effectivePath: "C:\\jdk21\\bin\\java.exe",
      shellPath: "C:\\jdk21\\bin\\java.exe",
      matches: true,
    }));
    const openTerminal = vi.fn(async () => {});
    renderShell({
      listToolInstallations: async (tool: string) => (tool === "java" ? [jdk] : []),
      shellCheck,
      openTerminal,
    });
    const user = userEvent.setup();
    const commandBar = await screen.findByRole("toolbar", { name: /tool actions/i });
    expect(within(commandBar).getByRole("button", { name: /check in shell/i })).toBeDisabled();

    await user.click(within(commandBar).getByRole("button", { name: /open terminal/i }));
    await waitFor(() => expect(openTerminal).toHaveBeenCalledTimes(1));

    const details = await openJavaDetail(user);
    const check = within(commandBar).getByRole("button", { name: /check in shell/i });
    await waitFor(() => expect(check).toBeEnabled());
    await user.click(check);
    await waitFor(() => expect(shellCheck).toHaveBeenCalledWith("java"));
    expect(await within(details).findByRole("status")).toBeInTheDocument();
  });
});
