import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { splitWhichcraftApi } from "../../composition/appServices";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { fakeApi } from "../../test/toolsTestHarness";
import { ConfigurationProvider } from "./useConfiguration";
import { ConfigurationWorkspace } from "./ConfigurationWorkspace";
import { configurationFixture, fakeConfigurationApi } from "../../test/fakeConfigurationApi";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import { ConfigurationOperationBanner } from "./ConfigurationWorkspace";
import { WRITE_BUSY_MESSAGE } from "../../coordination/types";
import { DesktopShellApp } from "../shell/DesktopShellApp";
import { UndoProvider } from "../../contexts/UndoContext";
import { inst } from "../../test/toolsTestHarness";

beforeEach(() => window.history.replaceState(null, "", "/"));
it("shows native identity origins and reviews, cancels, applies and undoes an email edit", async () => {
  const user = userEvent.setup();
  const api = fakeConfigurationApi();
  render(
    <AppServicesProvider services={splitWhichcraftApi(fakeApi(api))}>
      <WriteCoordinatorProvider>
        <ConfigurationProvider>
          <ConfigurationWorkspace page="git-config" />
        </ConfigurationProvider>
      </WriteCoordinatorProvider>
    </AppServicesProvider>,
  );
  await screen.findByText("local@example.test");
  expect(screen.getAllByText("E:/repos/sample/.git/config").length).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: "Edit user.email" }));
  await user.clear(screen.getByLabelText("Value"));
  await user.type(screen.getByLabelText("Value"), "new@example.test");
  await user.click(screen.getByRole("button", { name: "Preview" }));
  let review = await screen.findByRole("dialog", { name: "Review configuration change" });
  expect(within(review).getByText("verified")).toBeInTheDocument();
  await user.click(within(review).getByRole("button", { name: "Cancel" }));
  expect(api.applyConfiguration).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Preview" }));
  review = await screen.findByRole("dialog", { name: "Review configuration change" });
  await user.click(within(review).getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(api.applyConfiguration).toHaveBeenCalled());
  await user.click(await screen.findByRole("button", { name: "Undo configuration change" }));
  await waitFor(() => expect(api.undoConfiguration).toHaveBeenCalledWith("operation-1"));
});

it("ignores a late result from the previous repository", async () => {
  const user = userEvent.setup();
  let resolve!: (v: ReturnType<typeof configurationFixture>) => void;
  const api = fakeConfigurationApi();
  api.inspectConfiguration = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue(configurationFixture("E:/repos/new"));
  render(
    <AppServicesProvider
      services={splitWhichcraftApi(fakeApi({ ...api, pickFolder: async () => "E:/repos/new" }))}
    >
      <WriteCoordinatorProvider>
        <ConfigurationProvider>
          <ConfigurationWorkspace page="git-config" />
        </ConfigurationProvider>
      </WriteCoordinatorProvider>
    </AppServicesProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Choose repository" }));
  await screen.findByText("local@example.test");
  resolve(configurationFixture("E:/repos/old"));
  await waitFor(() => expect(screen.getByLabelText("Repository")).toHaveValue("E:/repos/new"));
});

it("shows a stale-plan conflict, requires refresh, and keeps writes mutually exclusive", async () => {
  const user = userEvent.setup();
  const api = fakeConfigurationApi();
  const coordinator = createWriteCoordinator();
  api.applyConfiguration = vi
    .fn()
    .mockRejectedValue(new Error("Source changed; refresh and review again"));
  render(
    <AppServicesProvider services={splitWhichcraftApi(fakeApi(api))}>
      <WriteCoordinatorProvider coordinator={coordinator}>
        <ConfigurationProvider>
          <ConfigurationWorkspace page="git-config" />
        </ConfigurationProvider>
      </WriteCoordinatorProvider>
    </AppServicesProvider>,
  );
  await screen.findByText("local@example.test");
  await user.click(screen.getByRole("button", { name: "Edit user.email" }));
  await user.click(screen.getByRole("button", { name: "Preview" }));
  const gate = coordinator.tryBeginToolsWrite("apply-plan");
  expect(gate.ok).toBe(true);
  const dialog = await screen.findByRole("dialog", { name: "Review configuration change" });
  await user.click(within(dialog).getByRole("button", { name: "Apply" }));
  await screen.findByText(WRITE_BUSY_MESSAGE);
  expect(api.applyConfiguration).not.toHaveBeenCalled();
  if (gate.ok) coordinator.endToolsWrite(gate.admission, "cancel");
  await user.click(screen.getByRole("button", { name: "Preview" }));
  await user.click(
    within(await screen.findByRole("dialog", { name: "Review configuration change" })).getByRole(
      "button",
      { name: "Apply" },
    ),
  );
  await screen.findByText(/Source changed/);
  expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(screen.queryByLabelText("Value")).not.toBeInTheDocument());
});

it("converts a picked folder into an exact gitdir/i rule and shows a matched rule with a local override", async () => {
  const user = userEvent.setup();
  const api = fakeConfigurationApi();
  const fixture = configurationFixture();
  fixture.git.sources.push({
    path: "C:/Users/sample/.gitconfig",
    scope: "global",
    includedFrom: null,
    revision: "global",
    content: "[user]\nname = Sample\n",
    writable: true,
    reason: null,
  });
  api.inspectConfiguration = vi.fn(async () => fixture);
  const plan = await api.planConfiguration({
    inspection: "",
    intent: { kind: "gitValue", occurrence: "", value: "" },
  });
  plan.impacts[0].matched = true;
  api.planConfiguration = vi.fn(async () => plan);
  render(
    <AppServicesProvider
      services={splitWhichcraftApi(
        fakeApi({
          ...api,
          pickFolder: async () => "E:\\Work",
          pickFile: async () => "C:/Users/sample/work.gitconfig",
        }),
      )}
    >
      <WriteCoordinatorProvider>
        <ConfigurationProvider>
          <ConfigurationWorkspace page="git-config" />
        </ConfigurationProvider>
      </WriteCoordinatorProvider>
    </AppServicesProvider>,
  );
  await screen.findByText("local@example.test");
  await user.click(screen.getByRole("button", { name: "includeIf" }));
  await user.click(screen.getByRole("button", { name: "Add include rule" }));
  await user.click(screen.getByRole("button", { name: "Choose folder (case insensitive)" }));
  expect(screen.getByLabelText("Condition")).toHaveValue("gitdir/i:E:/Work/");
  await user.click(screen.getByRole("button", { name: "Choose existing include file" }));
  await screen.findByText(/Rule matched/);
  expect(screen.getByLabelText("Condition")).toHaveValue("gitdir/i:E:/Work/");
  await user.click(screen.getByRole("button", { name: "Preview" }));
  const dialog = await screen.findByRole("dialog", { name: "Review configuration change" });
  expect(within(dialog).getByText("Rule matched")).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Apply" }));
  await user.click(await screen.findByRole("button", { name: "Undo configuration change" }));
  await waitFor(() => expect(api.undoConfiguration).toHaveBeenCalled());
});

it("recognizes an interrupted operation at startup and acknowledges its inspected state", async () => {
  const user = userEvent.setup();
  const api = fakeConfigurationApi();
  api.configurationOperation = vi.fn(async () => ({
    id: "pending",
    source: "~/.ssh/config",
    status: "pending",
    recovery: "after",
  }));
  render(
    <AppServicesProvider services={splitWhichcraftApi(fakeApi(api))}>
      <WriteCoordinatorProvider>
        <ConfigurationProvider>
          <ConfigurationOperationBanner />
        </ConfigurationProvider>
      </WriteCoordinatorProvider>
    </AppServicesProvider>,
  );
  await screen.findByText("An interrupted configuration operation needs review");
  await user.click(screen.getByRole("button", { name: "Acknowledge current content" }));
  await waitFor(() => expect(api.acknowledgeConfigurationRecovery).toHaveBeenCalledWith("pending"));
});

it("opens Git configuration from the real Git tool sheet and navigates to SSH hosts", async () => {
  const user = userEvent.setup();
  const api = fakeConfigurationApi();
  const fixture = configurationFixture();
  fixture.ssh.hosts = [{ name: "github-personal", values: [], unresolved: [] }];
  api.inspectConfiguration = vi.fn(async () => fixture);
  const services = splitWhichcraftApi(
    fakeApi({
      ...api,
      listToolInstallations: async (tool) =>
        tool === "git" ? [inst("git", "2.56", "C:/Git", { effective: true })] : [],
    }),
  );
  render(
    <UndoProvider>
      <AppServicesProvider services={services}>
        <WriteCoordinatorProvider>
          <DesktopShellApp />
        </WriteCoordinatorProvider>
      </AppServicesProvider>
    </UndoProvider>,
  );
  await user.click(await screen.findByRole("button", { name: /^Git$/i }));
  await user.click(await screen.findByRole("button", { name: "Configure Git" }));
  await screen.findByText("local@example.test");
  expect(screen.getByRole("link", { name: "Git config" })).toHaveAttribute("aria-current", "page");
  await user.click(screen.getByRole("link", { name: "Inspect SSH host and key references" }));
  await screen.findByRole("button", { name: "github-personal" });
  expect(screen.getByRole("link", { name: "SSH" })).toHaveAttribute("aria-current", "page");
});

it("selects a host and edits only its chosen IdentityFile through review and undo", async () => {
  const user = userEvent.setup();
  const api = fakeConfigurationApi();
  const fixture = configurationFixture();
  const identity = {
    id: "identity-work",
    key: "identityfile",
    value: "~/.ssh/id_work",
    source: "~/.ssh/work.conf",
    scope: "user",
    line: 3,
    editable: true,
    reason: null,
  };
  fixture.ssh.hosts = [
    { name: "github-personal", values: [], unresolved: [] },
    { name: "bitbucket.org", values: [identity], unresolved: [] },
  ];
  api.inspectConfiguration = vi.fn(async () => fixture);
  const services = splitWhichcraftApi(fakeApi(api));
  const workspace = (page: "git-config" | "ssh") => (
    <AppServicesProvider services={services}>
      <WriteCoordinatorProvider>
        <ConfigurationProvider>
          <ConfigurationWorkspace page={page} />
        </ConfigurationProvider>
      </WriteCoordinatorProvider>
    </AppServicesProvider>
  );
  const { rerender } = render(workspace("ssh"));
  await user.click(await screen.findByRole("button", { name: "bitbucket.org" }));
  await user.click(screen.getByRole("button", { name: "Edit identityfile" }));
  await user.clear(screen.getByLabelText("Value"));
  await user.type(screen.getByLabelText("Value"), "~/.ssh/new_work");
  rerender(workspace("git-config"));
  expect(screen.queryByRole("heading", { name: "Edit", exact: true })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
  rerender(workspace("ssh"));
  expect(screen.getByLabelText("Value")).toHaveValue("~/.ssh/new_work");
  expect(screen.getByLabelText("Value")).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Preview" }));
  expect(api.planConfiguration).toHaveBeenCalledWith({
    inspection: "inspection-1",
    intent: { kind: "sshIdentity", occurrence: "identity-work", value: "~/.ssh/new_work" },
  });
  await user.click(
    within(await screen.findByRole("dialog", { name: "Review configuration change" })).getByRole(
      "button",
      { name: "Apply" },
    ),
  );
  await user.click(await screen.findByRole("button", { name: "Undo configuration change" }));
  await waitFor(() => expect(api.undoConfiguration).toHaveBeenCalled());
});


it.each(["includeIf", "identity"] as const)(
  "keeps the %s editor on Git config when navigating to SSH and back",
  async (section) => {
    const user = userEvent.setup();
    const api = fakeConfigurationApi();
    const fixture = configurationFixture();
    fixture.git.sources.push({
      path: "C:/Users/sample/.gitconfig", scope: "global", includedFrom: null,
      revision: "global", content: "", writable: true, reason: null,
    });
    fixture.git.rules = [{
      id: "work-rule", condition: "gitdir/i:E:/Work/", target: "~/work.gitconfig",
      source: "C:/Users/sample/.gitconfig", line: 2, editable: true, reason: null, active: false,
    }];
    fixture.ssh.hosts = [{ name: "bitbucket.org", values: [], unresolved: [] }];
    api.inspectConfiguration = vi.fn(async () => fixture);
    let finishPreview!: () => void;
    const pendingPreview = new Promise<void>((resolve) => { finishPreview = resolve; });
    const plan = api.planConfiguration;
    api.planConfiguration = vi.fn(async (request) => { await pendingPreview; return plan(request); });
    render(
      <UndoProvider>
        <AppServicesProvider services={splitWhichcraftApi(fakeApi(api))}>
          <WriteCoordinatorProvider><DesktopShellApp /></WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    );
    await user.click(await screen.findByRole("link", { name: "Git config", exact: true }));
    await screen.findByText("local@example.test");
    if (section === "includeIf") {
      await user.click(screen.getByRole("button", { name: "includeIf" }));
      await user.click(screen.getByRole("button", { name: "Edit", exact: true }));
    } else {
      await user.click(screen.getByRole("button", { name: "Edit user.email" }));
    }
    const label = section === "includeIf" ? "Condition" : "Value";
    const edited = section === "includeIf" ? "gitdir/i:E:/Other/" : "draft@example.test";
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), edited);
    await user.click(screen.getByRole("button", { name: "Preview", exact: true }));
    await user.click(screen.getByRole("link", { name: "SSH", exact: true }));
    await screen.findByRole("button", { name: "bitbucket.org" });
    await act(async () => { finishPreview(); });
    expect(screen.queryByRole("dialog", { name: "Review configuration change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit", exact: true })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview", exact: true })).not.toBeInTheDocument();
    expect(api.applyConfiguration).not.toHaveBeenCalled();
    await user.click(screen.getByRole("link", { name: "Git config", exact: true }));
    expect(screen.getByLabelText(label)).toHaveValue(edited);
    const review = await screen.findByRole("dialog", { name: "Review configuration change" });
    expect(review).toContainElement(document.activeElement as HTMLElement);
  },
);
