import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isTauri } from "@tauri-apps/api/core";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppServicesProvider } from "../../composition/AppServicesContext";
import { configureProductionServices } from "../../composition/createProductionServices";
import { splitEnvarlyApi } from "../../composition/appServices";
import { WriteCoordinatorProvider } from "../../coordination/WriteCoordinatorContext";
import { fakeToolsRuntime } from "../tools/testHarness";
import en from "../../locales/en.json";
import { DesktopShellApp } from "./DesktopShellApp";

function renderDefaultShell() {
  return render(
    <AppServicesProvider>
      <WriteCoordinatorProvider>
        <DesktopShellApp />
      </WriteCoordinatorProvider>
    </AppServicesProvider>,
  );
}

describe("desktop shell header parity", () => {
  beforeEach(() => {
    configureProductionServices(null);
    vi.mocked(isTauri).mockReturnValue(true);
    localStorage.removeItem("envarly.lastUpdateCheck");
    void i18n.changeLanguage("en");
    const checkForUpdate = vi.fn(async () => ({
      version: "9.9.9",
      url: "https://example.com/release",
    }));
    const { api: fake } = fakeToolsRuntime({
      getEnvVars: vi.fn(async () => []),
      prepareMise: vi.fn(async () => false),
      checkForUpdate,
    });
    configureProductionServices(splitEnvarlyApi(fake));
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
