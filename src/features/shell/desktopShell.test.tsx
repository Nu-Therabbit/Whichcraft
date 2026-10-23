import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { splitEnvarlyApi } from "../../composition/appServices";
import { inst, fakeToolsRuntime } from "../tools/testHarness";
import { DesktopShellApp } from "./DesktopShellApp";

describe("desktop shell read journey", () => {
  beforeEach(() => {
    configureProductionServices(null);
  });

  it("loads per-tool inventory and shows selection vs effective separately", async () => {
    const listToolInstallations = vi.fn(async (tool: string) => {
      if (tool !== "java") return [];
      return [
        inst("java", "21.0.1", "C:\\effective", { effective: true, selected: false }),
        inst("java", "17.0.2", "C:\\selected", { effective: false, selected: true }),
      ];
    });
    const { api: fake } = fakeToolsRuntime({
      listToolInstallations,
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
    });
    configureProductionServices(splitEnvarlyApi(fake));

    render(
      <AppServicesProvider>
        <DesktopShellApp />
      </AppServicesProvider>,
    );

    await waitFor(() => expect(listToolInstallations).toHaveBeenCalled());
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Java/i }));

    const details = await screen.findByRole("complementary", { name: /installation details/i });
    expect(details).toHaveTextContent(/Selection/i);
    expect(details).toHaveTextContent(/17\.0\.2/);
    expect(details).toHaveTextContent(/Effective installation/i);
    expect(details).toHaveTextContent(/21\.0\.1/);
  });
});
