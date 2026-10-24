/** Which UI presentation is active for this process (frozen at startup). */
export type AppPresentation = "legacy" | "desktop-shell";

export { readShellNavigation, shellNavigationHref } from "./shellNavigation";
export type { ShellEnvironmentTab, ShellNavigation, ShellPage } from "./shellNavigation";

declare global {
  interface Window {
    /** Set by the Tauri window's initialization script from the `--legacy-ui` launch flag. */
    __WHICHCRAFT_PRESENTATION__?: string;
  }
}

let frozenPresentation: AppPresentation | undefined;

/**
 * Documented startup flag: launching `Whichcraft.exe --legacy-ui` selects the legacy UI
 * (passed here as `injected`); `?presentation=legacy` does the same under `npm run dev:web`.
 * Absent or any other value (including `desktop-shell`) uses the desktop shell.
 */
export function parseAppPresentation(search: string, injected?: string): AppPresentation {
  if (injected === "legacy") return "legacy";
  const value = new URLSearchParams(search).get("presentation");
  return value === "legacy" ? "legacy" : "desktop-shell";
}

/** Read once before `ReactDOM.createRoot`; frozen for the process. */
export function freezeAppPresentation(search: string, injected?: string): AppPresentation {
  frozenPresentation = parseAppPresentation(search, injected);
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
