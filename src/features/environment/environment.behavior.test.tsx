import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../../contexts/UndoContext";
import { createToolsRuntime, splitEnvarlyApi } from "../../composition/appServices";
import { AppServicesProvider, useAppServices } from "../../composition/AppServicesContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { fakeToolsRuntime } from "../tools/testHarness";
import { useToolsStore } from "../tools/useToolsStore";
import { EnvironmentProvider } from "./EnvironmentContext";
import { LegacyEnvironmentView } from "./LegacyEnvironmentView";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

function LegacyHarness() {
  const services = useAppServices();
  const toolsRuntime = useMemo(() => createToolsRuntime(services), [services]);
  const { state, dispatch } = useToolsStore("java", toolsRuntime);
  return <LegacyEnvironmentView tools={state} sendTools={dispatch} />;
}

function renderEnvironmentApp(overrides: Parameters<typeof fakeToolsRuntime>[0] = {}) {
  const { api: fake } = fakeToolsRuntime(overrides);
  configureProductionServices(splitEnvarlyApi(fake));
  return { fake, ...render(
    <UndoProvider>
      <AppServicesProvider>
        <EnvironmentProvider>
          <LegacyHarness />
        </EnvironmentProvider>
      </AppServicesProvider>
    </UndoProvider>,
  ) };
}

describe("environment controller behaviour", () => {
  beforeEach(() => {
    configureProductionServices(null);
  });

  it("loads variables through injected environment API", async () => {
    const getEnvVars = vi.fn(async () => [
      {
        name: "MY_VAR",
        value: "hello",
        valueKind: "String" as const,
        scope: "User" as const,
        listSeparator: null,
      },
    ]);
    renderEnvironmentApp({ getEnvVars });

    await waitFor(() => expect(getEnvVars).toHaveBeenCalled());
    expect(await screen.findByText("MY_VAR")).toBeInTheDocument();
  });

  it("shows registry error banner when environment refresh fails", async () => {
    const getEnvVars = vi.fn(async () => {
      throw new Error("registry read failed");
    });
    renderEnvironmentApp({ getEnvVars });

    expect(await screen.findByText(/registry read failed/i)).toBeInTheDocument();
  });

  it("runs check command through injected environment API", async () => {
    const checkCommand = vi.fn(async () => ({
      input: "node",
      queriedName: "node.EXE",
      hadExtension: false,
      hits: [{ directory: "C:\\Tools", matchedFile: "node.EXE", source: "System" as const }],
      fullPathStatus: null,
    }));
    renderEnvironmentApp({ getEnvVars: async () => [], checkCommand });

    await waitFor(() => expect(screen.getByRole("button", { name: /check command/i })).toBeEnabled());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /check command/i }));
    const input = await screen.findByTestId("check-command-input");
    await user.type(input, "node");
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    await waitFor(() => expect(checkCommand).toHaveBeenCalledWith("node"));
    expect(await screen.findByText(/C:\\Tools/i)).toBeInTheDocument();
  });

  it("exercises snapshots, import/export, and staged apply through injected environment API", async () => {
    const listSnapshots = vi.fn(async () => [
      {
        version: 2 as const,
        id: "snap-1",
        createdAt: "2024-01-01T12:00:00Z",
        label: "Baseline",
        snapshot: { user: {}, system: {} },
      },
    ]);
    const parseImport = vi.fn(async () => ({
      user: { STAGED_VAR: { value: "from-import", kind: "String" as const } },
      system: {},
    }));
    const applyEnvChanges = vi.fn(async () => {});
    const onApplyProgress = vi.fn(async () => () => {});
    const getRegistrySnapshot = vi.fn(async () => ({ user: {}, system: {} }));
    const getUnsupportedEnvValues = vi.fn(async () => []);
    const validatePaths = vi.fn(async () => []);

    renderEnvironmentApp({
      getEnvVars: async () => [],
      listSnapshots,
      parseImport,
      applyEnvChanges,
      onApplyProgress,
      getRegistrySnapshot,
      getUnsupportedEnvValues,
      validatePaths,
    });

    await waitFor(() => expect(screen.getByRole("button", { name: /snapshots/i })).toBeEnabled());
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /snapshots/i }));
    await waitFor(() => expect(listSnapshots).toHaveBeenCalled());
    expect(await screen.findByText("Baseline")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /import \/ export/i }));
    await user.click(screen.getByRole("radio", { name: /^import$/i }));
    fireEvent.change(screen.getByPlaceholderText(/paste file contents/i), {
      target: { value: '{"user":{},"system":{}}' },
    });
    await user.click(screen.getByRole("button", { name: /^parse$/i }));
    await waitFor(() => expect(parseImport).toHaveBeenCalled());
    await user.click(await screen.findByRole("button", { name: /stage 1 variable/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /1 staged/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /1 staged/i }));
    await user.click(await screen.findByRole("button", { name: /apply 1 change to registry/i }));

    await waitFor(() => expect(applyEnvChanges).toHaveBeenCalled());
    await waitFor(() => expect(onApplyProgress).toHaveBeenCalled());
  });
});
