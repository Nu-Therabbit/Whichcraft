import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useMemo, useState } from "react";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { createUnavailableWhichcraftApi, splitWhichcraftApi } from "../../composition/appServices";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { configurationFixture } from "../../test/configurationFixture";
import { ShellSidebar } from "../shell/ShellSidebar";
import { OVERVIEW_TOOL_KINDS } from "../shell/overviewTools";
import type { ToolScanSlice } from "../shell/toolOverviewModel";
import type { ToolKind } from "../tools/types";
import type { ConfigurationPlan } from "./api";
import { ConfigurationWorkspace, ConfigurationOperationBanner } from "./ConfigurationWorkspace";
import { ConfigurationProvider } from "./useConfiguration";

function ConfigurationStory({
  page = "git-config",
  recovery = false,
}: {
  page?: "git-config" | "ssh";
  recovery?: boolean;
}) {
  const [shown, setShown] = useState(page);
  const services = useMemo(() => {
    const fixture = configurationFixture();
    const path = "C:/Users/sample/.gitconfig";
    fixture.git.sources.unshift({
      path,
      scope: "global",
      includedFrom: null,
      revision: "global",
      content:
        '# Personal defaults\n[user]\nname = Sample Developer\nemail = personal@example.test\n[includeIf "gitdir/i:E:/Work/"]\npath = ~/.gitconfig-work\n',
      writable: true,
      reason: null,
    });
    fixture.git.rules = [
      {
        id: "rule",
        condition: "gitdir/i:E:/Work/",
        target: "~/.gitconfig-work",
        source: path,
        line: 7,
        editable: true,
        reason: null,
        active: false,
      },
    ];
    const source = "C:/Users/sample/.ssh/config";
    const identity = {
      id: "identity",
      key: "identityfile",
      value: "~/.ssh/id_personal",
      source,
      scope: "user",
      line: 5,
      editable: true,
      reason: null,
    };
    fixture.ssh = {
      client: "C:/Program Files/Git/usr/bin/ssh.exe",
      clients: [
        { path: "C:/Program Files/Git/usr/bin/ssh.exe", label: "Git bundled SSH", effective: true },
      ],
      command: "ssh -i ~/.ssh/id_personal",
      sources: [
        {
          path: source,
          scope: "user",
          includedFrom: null,
          revision: "ssh",
          content:
            "# Shared SSH configuration\nHost github-personal\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/id_personal\n",
          writable: true,
          reason: null,
        },
      ],
      hosts: [
        {
          name: "github-personal",
          values: [
            {
              ...identity,
              id: "hostname",
              key: "hostname",
              value: "github.com",
              editable: false,
              reason: "Static inspection only",
            },
            {
              ...identity,
              id: "user",
              key: "user",
              value: "git",
              editable: false,
              reason: "Static inspection only",
            },
            identity,
          ],
          unresolved: [],
        },
        {
          name: "bitbucket.org",
          values: [{ ...identity, id: "work", value: "~/.ssh/id_work" }],
          unresolved: ["Unresolved Match condition; no commands were executed"],
        },
      ],
      keys: [
        {
          path: "C:/Users/sample/.ssh/id_personal",
          exists: true,
          referenced: true,
          algorithm: "ssh-ed25519",
          fingerprint: "SHA256:examplePublicFingerprint",
        },
      ],
      diagnostics: [],
    };
    const services = splitWhichcraftApi(createUnavailableWhichcraftApi("Not used in this story"));
    const plan: ConfigurationPlan = {
      id: "plan",
      source: path,
      scope: "global",
      before: fixture.git.sources[0].content,
      after: fixture.git.sources[0].content.replace(
        "personal@example.test",
        "updated@example.test",
      ),
      impacts: [
        {
          repository: "E:/repos/sample",
          status: "verified",
          reason: null,
          before: fixture.git.identity,
          after: {
            ...fixture.git.identity,
            email: { ...fixture.git.occurrences[1], value: "updated@example.test" },
          },
          matched: null,
        },
      ],
      warnings: [
        "Only the current and recent repositories are covered. Other repositories may be affected.",
      ],
    };
    services.configuration = {
      inspectConfiguration: async () => fixture,
      planConfiguration: async () => plan,
      applyConfiguration: async () => ({
        status: "written",
        readback: "verified",
        message: null,
        operation: { id: "operation", source: path, status: "applied", recovery: null },
      }),
      undoConfiguration: async () => ({
        status: "restored",
        readback: "verified",
        message: null,
        operation: null,
      }),
      configurationOperation: async () =>
        recovery ? { id: "pending", source, status: "pending", recovery: "after" } : null,
      acknowledgeConfigurationRecovery: async () => {},
      forgetConfigurationRepository: async () => {},
    };
    services.platform.pickFolder = async () => "E:/Work";
    services.platform.pickFile = async () => "C:/Users/sample/.gitconfig-work";
    return services;
  }, [recovery]);
  const byTool = Object.fromEntries(
    OVERVIEW_TOOL_KINDS.map((tool) => [
      tool,
      { loading: false, boundRequestId: 1, installations: [], error: null },
    ]),
  ) as Record<ToolKind, ToolScanSlice>;
  return (
    <AppServicesProvider services={services}>
      <WriteCoordinatorProvider>
        <ConfigurationProvider>
          <div className="desktop-workbench @container" style={{ height: "100vh", minHeight: 0 }}>
            <ShellSidebar
              activePage={shown}
              openTool={null}
              byTool={byTool}
              onPage={(page) => {
                if (page === "git-config" || page === "ssh") setShown(page);
              }}
              onTool={() => {}}
            />
            <div className="shell-main">
              <main className="shell-sheet" aria-label="Configuration">
                <ConfigurationOperationBanner />
                <header className="shell-header">
                  <h1>{shown === "git-config" ? "Git config" : "SSH"}</h1>
                </header>
                <div className="shell-page">
                  <ConfigurationWorkspace page={shown} onNavigate={setShown} />
                </div>
              </main>
            </div>
          </div>
        </ConfigurationProvider>
      </WriteCoordinatorProvider>
    </AppServicesProvider>
  );
}
const meta: Meta<typeof ConfigurationStory> = {
  title: "Workspaces/Configuration",
  component: ConfigurationStory,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConfigurationStory>;
export const Git: Story = { args: { page: "git-config" } };
export const Ssh: Story = { args: { page: "ssh" } };
export const Recovery: Story = { args: { page: "ssh", recovery: true } };
export const Review: Story = {
  args: { page: "git-config" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Edit user.email" }));
    const input = canvas.getByLabelText("Value");
    await userEvent.clear(input);
    await userEvent.type(input, "updated@example.test");
    await userEvent.click(canvas.getByRole("button", { name: "Preview" }));
    await expect(
      within(document.body).findByRole("dialog", { name: "Review configuration change" }),
    ).resolves.toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 250));
  },
};

export const GitLight: Story = { ...Git, globals: { theme: "light" } };
export const SshLight: Story = { ...Ssh, globals: { theme: "light" } };
export const ReviewLight: Story = { ...Review, globals: { theme: "light" } };
