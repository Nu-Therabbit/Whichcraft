/** Non-default preview entry for ticket 07; default remains legacy until ticket 18. */
export type AppPresentation = "legacy" | "desktop-shell";

export { readShellNavigation, shellNavigationHref } from "./shellNavigation";
export type { ShellEnvironmentTab, ShellNavigation, ShellPage } from "./shellNavigation";

export function readAppPresentation(): AppPresentation {
  if (typeof window === "undefined") return "legacy";
  const value = new URLSearchParams(window.location.search).get("presentation");
  return value === "desktop-shell" ? "desktop-shell" : "legacy";
}

export function legacyPresentationHref(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("presentation");
  url.searchParams.delete("page");
  url.searchParams.delete("env");
  url.searchParams.delete("install");
  return `${url.pathname}${url.search}${url.hash}`;
}
