/** Which UI presentation is active for this process (frozen at startup). */
export type AppPresentation = "legacy" | "desktop-shell";

export { readShellNavigation, shellNavigationHref } from "./shellNavigation";
export type { ShellEnvironmentTab, ShellNavigation, ShellPage } from "./shellNavigation";

let frozenPresentation: AppPresentation | undefined;

/**
 * Documented startup flag: `?presentation=legacy` selects the legacy UI.
 * Absent or any other value (including `desktop-shell`) uses the desktop shell.
 */
export function parseAppPresentation(search: string): AppPresentation {
  const value = new URLSearchParams(search).get("presentation");
  return value === "legacy" ? "legacy" : "desktop-shell";
}

/** Read once from `location.search` before `ReactDOM.createRoot`; frozen for the process. */
export function freezeAppPresentation(search: string): AppPresentation {
  frozenPresentation = parseAppPresentation(search);
  return frozenPresentation;
}

export function getFrozenAppPresentation(): AppPresentation {
  if (frozenPresentation === undefined) {
    throw new Error("App presentation was not frozen at startup");
  }
  return frozenPresentation;
}

/** @internal tests only */
export function resetAppPresentationForTests(): void {
  frozenPresentation = undefined;
}
