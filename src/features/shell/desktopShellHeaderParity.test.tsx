import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isTauri } from "@tauri-apps/api/core";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { UndoProvider } from "../../contexts/UndoContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { splitEnvarlyApi } from "../../composition/appServices";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { fakeToolsRuntime } from "../../test/toolsTestHarness";
import en from "../../locales/en.json";
import { DesktopShellApp } from "./DesktopShellApp";

function renderDefaultShell() {
  return render(
    <UndoProvider>
      <AppServicesProvider>
        <WriteCoordinatorProvider>
          <DesktopShellApp />
        </WriteCoordinatorProvider>
      </AppServicesProvider>
    </UndoProvider>,
  );
}

describe("desktop shell header parity", () => {
  const openUrl = vi.fn(async (_url: string) => {});

  beforeEach(() => {
    configureProductionServices(null);
    vi.mocked(isTauri).mockReturnValue(true);
    localStorage.removeItem("envarly.lastUpdateCheck");
    void i18n.changeLanguage("en");
    openUrl.mockClear();
    const checkForUpdate = vi.fn(async () => ({
      version: "9.9.9",
      url: "https://example.com/release",
    }));
    const { api: fake } = fakeToolsRuntime({
      getEnvVars: vi.fn(async () => []),
      prepareMise: vi.fn(async () => false),
      checkForUpdate,
      openUrl,
    });
    configureProductionServices(splitEnvarlyApi(fake));
  });

  it("opens the update page and the upstream source through the platform API", async () => {
    renderDefaultShell();

    await userEvent.click(await screen.findByRole("button", { name: /9\.9\.9/ }));
    expect(openUrl).toHaveBeenCalledWith("https://example.com/release");

    await userEvent.click(screen.getByRole("button", { name: en.desktop_shell.view_source }));
    expect(openUrl).toHaveBeenCalledWith("https://github.com/iray-tno/envarly");
  });

  it("exposes language, update notice, and licences on the default shell header", async () => {
    renderDefaultShell();

    await waitFor(() => expect(screen.getByRole("navigation", { name: en.desktop_shell.nav_label })).toBeInTheDocument());

    await waitFor(() => expect(screen.getByRole("button", { name: /9\.9\.9/ })).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: en.header.licenses }));
    expect(await screen.findByRole("dialog", { name: en.modal.licenses })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const language = screen.getByRole("combobox", { name: "Language" });
    await userEvent.selectOptions(language, "ja");
    await waitFor(() => expect(i18n.language).toBe("ja"));
  });
});
