import { useEffect } from "react";
import type { InvalidationScope } from "../../coordination/types";
import type { ToolKind } from "../tools/types";
import { useShellTools } from "./ShellToolsContext";

export function scopesNeedToolsRefresh(scopes: InvalidationScope[]): boolean {
  return scopes.some(
    (scope) =>
      scope === "tools-installations" ||
      scope === "tools-profiles" ||
      scope === "tools-shell-check" ||
      scope === "account-context" ||
      scope.startsWith("environment-") ||
      scope === "shell-overview",
  );
}

/** Sync the app-lifetime shell tools store with the overview's selected tool. */
export function useShellToolsWrite(activeTool: ToolKind | null) {
  const { state, dispatch } = useShellTools();

  useEffect(() => {
    if (!activeTool) return;
    if (state.tool !== activeTool) {
      dispatch({ type: "selectTool", tool: activeTool });
      return;
    }
    dispatch({ type: "refresh" });
  }, [activeTool, dispatch, state.tool]);

  return { state, dispatch };
}
