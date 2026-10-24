import { beforeEach, describe, expect, it } from "vitest";
import {
  freezeAppPresentation,
  getFrozenAppPresentation,
  parseAppPresentation,
  resetAppPresentationForTests,
} from "./appPresentation";
import { shellNavigationHref } from "./shellNavigation";

describe("appPresentation", () => {
  beforeEach(() => {
    resetAppPresentationForTests();
  });

  it("defaults to desktop shell when the presentation flag is absent", () => {
    expect(parseAppPresentation("")).toBe("desktop-shell");
    expect(parseAppPresentation("?page=tools")).toBe("desktop-shell");
    expect(parseAppPresentation("?presentation=desktop-shell")).toBe("desktop-shell");
  });

  it("selects legacy only when presentation=legacy is in the startup search", () => {
    expect(parseAppPresentation("?presentation=legacy")).toBe("legacy");
  });

  it("freezes presentation for the process", () => {
    freezeAppPresentation("?presentation=legacy");
    expect(getFrozenAppPresentation()).toBe("legacy");
    expect(parseAppPresentation("")).toBe("desktop-shell");
  });

  it("shell navigation href does not require a presentation query param", () => {
    const href = shellNavigationHref(
      { page: "environment", envTab: "variables" },
      "http://localhost/?presentation=legacy",
    );
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.get("presentation")).toBeNull();
    expect(url.searchParams.get("page")).toBe("environment");
  });
});
