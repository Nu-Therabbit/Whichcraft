import React from "react";
import { addons, types } from "storybook/manager-api";
import { create } from "storybook/theming";

function getLpUrl(): string {
  if (typeof window !== "undefined") {
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin && ref.pathname.startsWith("/Whichcraft/")) {
          if (!ref.pathname.includes("/storybook") && !ref.pathname.includes("/reports")) {
            return ref.pathname;
          }
        }
      }
    } catch {
      // fallback
    }
    if (window.location.pathname.startsWith("/Whichcraft/")) {
      return "/Whichcraft/";
    }
  }
  return "https://nu-therabbit.github.io/Whichcraft/";
}

const lpUrl = getLpUrl();

addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "← Back to Whichcraft",
    brandUrl: lpUrl,
    brandTarget: "_self",
  }),
});

addons.register("whichcraft/toolbar", () => {
  addons.add("whichcraft/toolbar/back", {
    type: types.TOOL,
    title: "Back to Whichcraft LP",
    match: () => true,
    render: () =>
      React.createElement(
        "a",
        {
          href: lpUrl,
          title: "Back to Whichcraft LP",
          target: "_self",
          className: "whichcraft-back-tool",
          onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
            const url = getLpUrl();
            e.currentTarget.href = url;
          },
        },
        "← Back to Whichcraft",
      ),
  });
});
