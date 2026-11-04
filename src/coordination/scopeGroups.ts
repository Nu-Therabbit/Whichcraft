import type { InvalidationScope } from "./types";

type ScopeGroup = "environment" | "tools" | "shell" | "account" | "configuration";

/** Every invalidation scope belongs to one group; a new scope must be classified here. */
const SCOPE_GROUP: Record<InvalidationScope, ScopeGroup> = {
  configuration: "configuration",
  "environment-variables": "environment",
  "environment-diagnostics": "environment",
  "environment-external-diff": "environment",
  "tools-installations": "tools",
  "tools-profiles": "tools",
  "tools-shell-check": "tools",
  "shell-overview": "shell",
  "account-context": "account",
};

function touches(scopes: readonly InvalidationScope[], ...groups: ScopeGroup[]): boolean {
  return scopes.some((scope) => groups.includes(SCOPE_GROUP[scope]));
}

/** Registry environment changed: old shell resolution and check-command results are stale. */
export function changesEnvironment(scopes: readonly InvalidationScope[]): boolean {
  return touches(scopes, "environment");
}

/** Tool inventory, profiles or the overview changed. */
export function changesTools(scopes: readonly InvalidationScope[]): boolean {
  return touches(scopes, "tools", "shell");
}

export function changesAccount(scopes: readonly InvalidationScope[]): boolean {
  return touches(scopes, "account");
}

/** The selected-tool store re-reads on any change: every group can move the effective installation. */
export function scopesNeedToolsRefresh(scopes: readonly InvalidationScope[]): boolean {
  return touches(scopes, "environment", "tools", "shell", "account");
}

/** Environment variables re-read on any change, including tool writes to PATH/JAVA_HOME. */
export function scopesNeedEnvironmentRefresh(scopes: readonly InvalidationScope[]): boolean {
  return touches(scopes, "environment", "tools", "shell", "account");
}

/** Profile match status depends on the saved profiles and on what the environment makes effective. */
export function scopesNeedProfileReload(scopes: readonly InvalidationScope[]): boolean {
  return scopes.includes("tools-profiles") || changesEnvironment(scopes);
}

/** The overview rescans for everything except a new shell-check result. */
export function scopesNeedShellRescan(scopes: readonly InvalidationScope[]): boolean {
  return scopes.some((scope) => scope !== "tools-shell-check" && scope !== "configuration");
}
