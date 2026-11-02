import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { splitWhichcraftApi } from "../../composition/appServices";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { UndoProvider } from "../../contexts/UndoContext";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { shellNavigationHref } from "../../lib/shellNavigation";
import { fakeToolsRuntime, inst, planFor } from "../../test/toolsTestHarness";
import { DesktopShellApp } from "./DesktopShellApp";

const sdkMocks = {
  getSelectedAccount: async () => null,
  getPythonLauncherInfo: async () => ({ launcherLines: [], launcherInstalled: false, storeStub: null, note: "" }),
  getAndroidInventory: async () => ({ sdkRoot: null, rootSource: null, platforms: [], buildTools: [], ndk: [], platformTools: null, emulator: null, cmake: [] }),
  getMsvcInventory: async () => ({ instances: [], windowsSdks: [] }),
  getRecoveryStatus: async () => null,
  unfinishedUninstalls: async () => [],
  getWhichcraftSettings: async () => ({ installStore: "C:\\store", scanRoots: [], terminal: "windows_terminal" as const, installStoreConfirmed: true }),
  listProfiles: async () => [],
};

const effective = inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true });
const other = inst("java", "17.0.2", "C:\\jdk17");
const javaOnly = async (tool: string) => (tool === "java" ? [effective, other] : []);
const differs = async (tool: string) => (tool === "java" ? [{ ...effective, selected: false }, { ...other, selected: true }] : []);

function renderShell(api: Parameters<typeof fakeToolsRuntime>[0]) {
  const coordination = createWriteCoordinator();
  const { api: fake } = fakeToolsRuntime({ ...sdkMocks, ...api }, coordination);
  configureProductionServices(splitWhichcraftApi(fake));
  return render(
    <UndoProvider>
      <AppServicesProvider>
        <WriteCoordinatorProvider coordinator={coordination}>
          <DesktopShellApp />
        </WriteCoordinatorProvider>
      </AppServicesProvider>
    </UndoProvider>,
  );
}

const sheet = () => screen.findByRole("complementary", { name: /installation details/i });
const noSheet = () => waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());

describe("desktop shell tool sheet", () => {
  beforeEach(() => {
    configureProductionServices(null);
    localStorage.clear();
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools" }));
  });

  it("takes focus when it opens, and Escape returns focus to the card that opened it", async () => {
    renderShell({ listToolInstallations: javaOnly });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Java,/ }));
    await sheet();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Java" })).toHaveFocus());

    await user.keyboard("{Escape}");
    await noSheet();
    await waitFor(() => expect(screen.getByRole("button", { name: /^Java,/ })).toHaveFocus());
  });

  it("leaves Escape to a dialog above it, and writes nothing", async () => {
    const applyToolPlan = vi.fn();
    renderShell({ listToolInstallations: javaOnly, planToolApply: vi.fn(async () => planFor(other)), applyToolPlan });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Java,/ }));
    await user.click(await screen.findByRole("button", { name: /Switch to Eclipse Adoptium 17\.0\.2/ }));
    await screen.findByRole("button", { name: /^Apply plan$/ });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Apply plan$/ })).not.toBeInTheDocument());
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(applyToolPlan).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await noSheet();
  });

  it("opens a tool from the sidebar on any page", async () => {
    window.history.replaceState(null, "", shellNavigationHref({ page: "settings" }));
    renderShell({ listToolInstallations: javaOnly });
    const user = userEvent.setup();
    await screen.findByTestId("shell-settings-ready");
    await user.click(screen.getByRole("button", { name: "Java" }));
    const details = await sheet();
    expect(within(details).getByRole("heading", { level: 1, name: "Java" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Java" })).toHaveAttribute("aria-current", "true");
  });

  it("goes back from the sheet with Developer tools, and keeps it across other pages", async () => {
    renderShell({ listToolInstallations: javaOnly });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Java,/ }));
    await sheet();

    await user.click(screen.getByRole("link", { name: /^settings/i }));
    await noSheet();
    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    await sheet();

    await user.click(screen.getByRole("link", { name: /^developer tools/i }));
    await noSheet();
    expect(screen.getByRole("link", { name: /^developer tools/i })).toHaveAttribute("aria-current", "page");
  });

  it("names the open tool on the Tools section while it is folded", async () => {
    renderShell({ listToolInstallations: javaOnly });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Java,/ }));
    await sheet();
    const section = screen.getByRole("button", { name: /^Tools/ });
    expect(section).not.toHaveTextContent("Java");
    await user.click(section);
    expect(section).toHaveAttribute("aria-expanded", "false");
    expect(section).toHaveTextContent("Java");
  });

  it("names the installation on each row's Uninstall", async () => {
    renderShell({ listToolInstallations: javaOnly });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Java,/ }));
    const details = await sheet();
    expect(await within(details).findByRole("button", { name: "Uninstall Eclipse Adoptium 17.0.2" })).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Uninstall Eclipse Adoptium 21.0.1" })).toBeInTheDocument();
  });

  it("applies a Tool Profile that includes the tool from its sheet", async () => {
    const profile = { id: "p1", name: "Old client", tools: [{ tool: "java" as const, vendor: "Eclipse Adoptium", version: "17.0.2", preferredRoot: null }] };
    const planProfile = vi.fn(async () => planFor(other, { planId: "profile-plan" }));
    renderShell({
      listToolInstallations: javaOnly,
      listProfiles: async () => [profile],
      profileStatus: async () => ({ profile, matchesEffective: false, unavailable: [] }),
      planProfile,
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Java,/ }));
    const details = await sheet();
    await user.click(await within(details).findByRole("button", { name: "Apply profile Old client" }));
    await waitFor(() => expect(planProfile).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /^Apply plan$/ })).toBeInTheDocument();
  });
});

describe("desktop shell tool cards", () => {
  beforeEach(() => {
    configureProductionServices(null);
    localStorage.clear();
    window.history.replaceState(null, "", shellNavigationHref({ page: "tools" }));
  });

  it("does not build a plan from a card when the installation has gone by the latest read", async () => {
    let gone = false;
    const planToolApply = vi.fn(async () => planFor(other));
    renderShell({
      listToolInstallations: async (tool: string) => (tool !== "java" ? [] : [{ ...effective, selected: false }, { ...other, selected: true, available: !gone }]),
      planToolApply,
    });
    const user = userEvent.setup();
    const use = await screen.findByRole("button", { name: /^Use Java 17\.0\.2/ });
    gone = true;
    await user.click(use);
    // The card catches up with the machine, and focus stays next to it rather than falling off the page.
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Use Java 17\.0\.2/ })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: /^Java,/ })).toHaveFocus());
    expect(planToolApply).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Apply plan$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("keeps the last result on screen and focus on Rescan while it runs", async () => {
    let release: () => void = () => {};
    let gate: Promise<void> | null = null;
    renderShell({
      listToolInstallations: async (tool: string) => {
        if (gate) await gate;
        return differs(tool);
      },
    });
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /^Use Java 17\.0\.2/ });
    gate = new Promise((resolve) => {
      release = resolve;
    });
    const rescan = screen.getByRole("button", { name: /^rescan$/i });
    await user.click(rescan);

    await waitFor(() => expect(screen.getByRole("button", { name: /^rescanning/i })).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("button", { name: /^rescanning/i })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^Use Java 17\.0\.2/ })).toBeInTheDocument();

    gate = null;
    release();
    await screen.findByRole("button", { name: /^rescan$/i });
  });

  it("offers Retry scan on a failed card, with the reason as its description", async () => {
    let fail = true;
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool === "java" && fail) throw new Error("registry denied");
      return differs(tool);
    });
    renderShell({ listToolInstallations });
    const user = userEvent.setup();
    const retry = await screen.findByRole("button", { name: "Retry scan" });
    expect(retry).toHaveAccessibleDescription(/registry denied/);
    // The raw message stays off the card. The status bar says it in words.
    expect(within(retry.closest("li") as HTMLElement).queryByText(/registry denied/)).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(/registry denied/);

    fail = false;
    await user.click(retry);
    await screen.findByRole("button", { name: /^Use Java 17\.0\.2/ });
    expect(screen.queryByRole("button", { name: "Retry scan" })).not.toBeInTheDocument();
  });

  it("shows what Windows uses and counts the rest, which open from the card", async () => {
    const extra = inst("java", "11.0.3", "C:\\jdk11");
    renderShell({ listToolInstallations: async (tool: string) => (tool === "java" ? [effective, other, extra] : []) });
    const user = userEvent.setup();
    const more = await screen.findByRole("button", { name: "Java: + 2 more versions" });
    const card = more.closest(".shell-card") as HTMLElement;
    expect(within(card).getByText("21.0.1")).toBeInTheDocument();
    expect(within(card).queryByText("17.0.2")).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /^Use Java/ })).not.toBeInTheDocument();

    await user.click(more);
    const details = await sheet();
    expect(await within(details).findByRole("button", { name: /Switch to Eclipse Adoptium 11\.0\.3/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await noSheet();
    await waitFor(() => expect(screen.getByRole("button", { name: "Java: + 2 more versions" })).toHaveFocus());
  });

  it("keeps a Selection that differs on the card, with Use", async () => {
    renderShell({ listToolInstallations: differs });
    const use = await screen.findByRole("button", { name: /^Use Java 17\.0\.2/ });
    const card = use.closest(".shell-card") as HTMLElement;
    expect(within(card).getByText("21.0.1")).toBeInTheDocument();
    expect(within(card).getByText("17.0.2")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /more version/ })).not.toBeInTheDocument();
  });

  it("keeps the count beside a Selection that differs, and it opens the sheet", async () => {
    const extra = inst("java", "11.0.3", "C:\\jdk11");
    renderShell({ listToolInstallations: async (tool: string) => (tool === "java" ? [{ ...effective, selected: false }, { ...other, selected: true }, extra] : []) });
    const user = userEvent.setup();
    const more = await screen.findByRole("button", { name: "Java: + 1 more version" });
    expect(more).toHaveTextContent("+1");
    await user.click(more);
    expect(await within(await sheet()).findByRole("button", { name: /Switch to Eclipse Adoptium 11\.0\.3/ })).toBeInTheDocument();
  });

  it("offers a rescan on a card whose rescan failed, even with an earlier result", async () => {
    let fail = false;
    renderShell({
      listToolInstallations: async (tool: string) => {
        if (tool === "java" && fail) throw new Error("registry denied");
        return javaOnly(tool);
      },
    });
    const user = userEvent.setup();
    const card = (await screen.findByRole("button", { name: /^Java,/ })).closest(".shell-card") as HTMLElement;
    await within(card).findByText("21.0.1");
    fail = true;
    await user.click(screen.getByRole("button", { name: /^rescan/i }));
    expect(await within(card).findByRole("button", { name: /rescan|retry/i })).toBeInTheDocument();
  });

  it("says a tool has one version when there is nothing more to open", async () => {
    renderShell({ listToolInstallations: async (tool: string) => (tool === "java" ? [effective] : []) });
    const row = await screen.findByText("1 version installed");
    expect(within(row.closest(".shell-card") as HTMLElement).getByText("21.0.1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more version/ })).not.toBeInTheDocument();
  });

  it("names the Selection's vendor only when that is what tells the two apart", async () => {
    const zulu = inst("java", "21.0.1", "C:\\zulu21", { selected: true, vendor: "Azul Zulu" });
    renderShell({ listToolInstallations: async (tool: string) => (tool === "java" ? [{ ...effective, selected: false }, zulu] : []) });
    await screen.findByRole("button", { name: /^Use Java 21\.0\.1/ });
    expect(screen.getByText("Azul Zulu")).toBeInTheDocument();
  });

  it("shows the folder when two installations have the same version and vendor", async () => {
    const twin = inst("java", "21.0.1", "C:\\other\\jdk21", { selected: true });
    renderShell({ listToolInstallations: async (tool: string) => (tool === "java" ? [{ ...effective, selected: false }, twin] : []) });
    await screen.findByRole("button", { name: /^Use Java 21\.0\.1/ });
    expect(screen.getByText("C:\\jdk21")).toBeInTheDocument();
    expect(screen.getByText("C:\\other\\jdk21")).toBeInTheDocument();
  });

  it("says once that a tool has nothing installed", async () => {
    renderShell({ listToolInstallations: javaOnly });
    await screen.findByRole("button", { name: /^Java: \+ 1 more version/ });
    const flutter = screen.getByRole("button", { name: /^Flutter,/ }).closest("li") as HTMLElement;
    expect(within(flutter).getAllByText(/no installations found|nothing installed/i)).toHaveLength(1);
    expect(within(flutter).getByRole("button", { name: "Install Flutter" })).toBeInTheDocument();
  });
});

describe("desktop shell appearance", () => {
  beforeEach(() => {
    configureProductionServices(null);
    localStorage.clear();
    delete document.documentElement.dataset.accent;
    window.history.replaceState(null, "", shellNavigationHref({ page: "settings" }));
  });

  it("applies and remembers the accent colour", async () => {
    const first = renderShell({ listToolInstallations: javaOnly });
    const user = userEvent.setup();
    await screen.findByTestId("shell-settings-ready");
    expect(screen.getByRole("radio", { name: "Emerald" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Plum" }));
    expect(document.documentElement.dataset.accent).toBe("plum");
    first.unmount();

    renderShell({ listToolInstallations: javaOnly });
    await screen.findByTestId("shell-settings-ready");
    expect(screen.getByRole("radio", { name: "Plum" })).toBeChecked();
  });

  it("keeps the header's theme toggle and Settings in step", async () => {
    localStorage.setItem("whichcraft-theme", "dark");
    renderShell({ listToolInstallations: javaOnly });
    const user = userEvent.setup();
    await screen.findByTestId("shell-settings-ready");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Light" })).toBeChecked());
    expect(document.documentElement).toHaveClass("light");

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Light" })).toBeChecked());
  });
});
