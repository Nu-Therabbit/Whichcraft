import { useEffect, useMemo, useRef } from "react";
import { createToolsRuntime } from "../../composition/appServices";
import { useAppServices } from "../../composition/AppServicesContext";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import type { InvalidationScope } from "../../coordination/types";
import type { ToolKind } from "../tools/types";
import { useToolsStore } from "../tools/useToolsStore";

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

/** Tools MVI store for the desktop detail pane: real plans, apply, and undo via ticket 04 coordinator. */
export function useShellToolsWrite(activeTool: ToolKind | null) {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const toolsRuntime = useMemo(
    () => createToolsRuntime(services, coordination),
    [services, coordination],
  );
  const { state, dispatch } = useToolsStore("java", toolsRuntime);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dispatch({ type: "started" });
  }, [dispatch]);

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (!scopesNeedToolsRefresh(scopes)) return;
      dispatch({ type: "refresh" });
    });
  }, [coordination, dispatch]);

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
