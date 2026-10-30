import { render, screen, waitFor } from "@testing-library/react";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import en from "../locales/en.json";
import { freezeAppPresentation, resetAppPresentationForTests } from "../lib/appPresentation";
import { UndoProvider } from "../contexts/UndoContext";
import { api, resetLegacyApiFacadeForTests } from "../api";
import { splitEnvarlyApi } from "./appServices";
import { WriteCoordinatorProvider } from "../coordination/WriteCoordinatorContext";
import { AppServicesProvider } from "./AppServicesContext";
import { configureProductionServices } from "./createProductionServices";
import { fakeToolsRuntime } from "../test/toolsTestHarness";

const TAURI_UNAVAILABLE = "Tauri runtime unavailable. Start Whichcraft with `npm run dev`.";

function renderProductionApp(search = "") {
  resetAppPresentationForTests();
  const presentation = freezeAppPresentation(search);
  return render(
    <UndoProvider>
      <AppServicesProvider>
        <WriteCoordinatorProvider>
          <App presentation={presentation} />
        </WriteCoordinatorProvider>
      </AppServicesProvider>
    </UndoProvider>,
  );
}

describe("production app startup", () => {
  beforeEach(() => {
    resetLegacyApiFacadeForTests();
    resetAppPresentationForTests();
    configureProductionServices(null);
    vi.mocked(isTauri).mockReturnValue(true);
  });

  it("loads Environment and fires Tools startup through configured production services", async () => {
    const getEnvVars = vi.fn(async () => []);
    const prepareMise = vi.fn(async () => false);
    const { api: fake } = fakeToolsRuntime({ getEnvVars, prepareMise });
    configureProductionServices(splitEnvarlyApi(fake));

    renderProductionApp();

    await waitFor(() => expect(getEnvVars).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(prepareMise).toHaveBeenCalledTimes(1));

    await api.getEnvVars();
    expect(getEnvVars).toHaveBeenCalledTimes(2);
  });

  it("shows AppLoading while production services are still resolving", async () => {
    let resolveServices!: (value: ReturnType<typeof splitEnvarlyApi>) => void;
    const deferred = new Promise<ReturnType<typeof splitEnvarlyApi>>((resolve) => {
      resolveServices = resolve;
    });
    configureProductionServices(deferred);

    renderProductionApp();
    expect(screen.getByText(en.app.loading)).toBeInTheDocument();

    const { api: fake } = fakeToolsRuntime({});
    resolveServices(splitEnvarlyApi(fake));
    await waitFor(() => expect(screen.queryByText(en.app.loading)).not.toBeInTheDocument());
  });

  it("surfaces the registry error banner when production bootstrap fails", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    renderProductionApp("");

    await waitFor(() =>
      expect(
        screen.getByText(
          en.app.registry_error.replace("{{error}}", `Error: ${TAURI_UNAVAILABLE}`),
        ),
      ).toBeInTheDocument(),
    );
  });

  it("wires services override before child mount effects use legacy api", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const getEnvVars = vi.fn(async () => []);
    const { api: fake } = fakeToolsRuntime({ getEnvVars });
    const services = splitEnvarlyApi(fake);

    function MountCaller() {
      useEffect(() => {
        void api.getEnvVars();
      }, []);
      return null;
    }

    render(
      <AppServicesProvider services={services}>
        <MountCaller />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(getEnvVars).toHaveBeenCalledTimes(1));
  });
});
