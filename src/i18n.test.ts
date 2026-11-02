import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";

describe("i18n", () => {
  afterEach(async () => {
    localStorage.removeItem("whichcraft-language");
    await i18n.changeLanguage("en");
  });

  it("sets the document language at startup from the stored language", async () => {
    document.documentElement.lang = "en";
    localStorage.setItem("whichcraft-language", "ko");
    vi.resetModules();

    await import("./i18n");

    await vi.waitFor(() => expect(document.documentElement.lang).toBe("ko"));
  });

  it("keeps the document language in step with the UI language", async () => {
    await i18n.changeLanguage("ja");
    expect(document.documentElement.lang).toBe("ja");

    await i18n.changeLanguage("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
