import { render, screen, waitFor } from "@testing-library/react";
import { isTauri } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { AppServicesProvider } from "./composition/AppServicesContext";
import { configureProductionServices } from "./composition/createProductionServices";
import { WriteCoordinatorProvider } from "./coordination/WriteCoordinatorContext";
import { UndoProvider } from "./contexts/UndoContext";
import { fakeToolsRuntime } from "./features/tools/testHarness";
import en from "./locales/en.json";
import { freezeAppPresentation, resetAppPresentationForTests } from "./lib/appPresentation";
import { splitEnvarlyApi } from "./composition/appServices";

function renderApp(search: string) {
  resetAppPresentationForTests();
  const presentation = freezeAppPresentation(search);
  return {
    presentation,
    ...render(
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider>
            <App presentation={presentation} />
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    ),
  };
}

describe("App presentation cutover", () => {
  beforeEach(() => {
    resetAppPresentationForTests();
    vi.mocked(isTauri).mockReturnValue(true);
    const { api: fake } = fakeToolsRuntime({
      getEnvVars: vi.fn(async () => []),
      prepareMise: vi.fn(async () => false),
    });
    configureProductionServices(splitEnvarlyApi(fake));
  });

  it("mounts the desktop shell by default instead of the legacy environment header", async () => {
    renderApp("");
    await waitFor(() =>
      expect(screen.getByRole("navigation", { name: en.desktop_shell.nav_label })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: en.header.snapshots })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: en.desktop_shell.open_legacy })).not.toBeInTheDocument();
  });

  it("mounts legacy only when presentation=legacy was frozen at startup", async () => {
    renderApp("?presentation=legacy");
    await waitFor(() => expect(screen.getByRole("button", { name: en.header.snapshots })).toBeInTheDocument());
    expect(screen.queryByRole("navigation", { name: en.desktop_shell.nav_label })).not.toBeInTheDocument();
  });

  it("does not switch presentation when location.search changes after startup", async () => {
    const { presentation, rerender } = renderApp("");
    await waitFor(() =>
      expect(screen.getByRole("navigation", { name: en.desktop_shell.nav_label })).toBeInTheDocument(),
    );

    window.history.replaceState(null, "", "/?presentation=legacy");
    rerender(
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider>
            <App presentation={presentation} />
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    );

    expect(screen.getByRole("navigation", { name: en.desktop_shell.nav_label })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.header.snapshots })).not.toBeInTheDocument();
  });
});
