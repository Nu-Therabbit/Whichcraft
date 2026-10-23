import { render, screen, waitFor } from "@testing-library/react";
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
  return render(
    <UndoProvider>
      <AppServicesProvider>
        <EnvironmentProvider>
          <LegacyHarness />
        </EnvironmentProvider>
      </AppServicesProvider>
    </UndoProvider>,
  );
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
});
