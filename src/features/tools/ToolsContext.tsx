import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { ShellCheck } from "./types";
import { createToolsRuntime } from "../../composition/appServices";
import { useAppServices } from "../../composition/AppServicesContext";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import type { ToolsDispatch } from "./useToolsStore";
import { useToolsStore } from "./useToolsStore";
import type { ToolsState } from "./model";
import {
  changesEnvironment,
  scopesNeedProfileReload,
  scopesNeedToolsRefresh,
} from "../../coordination/scopeGroups";

type ToolsContextValue = {
  state: ToolsState;
  dispatch: ToolsDispatch;
};

const ToolsContext = createContext<ToolsContextValue | null>(null);

/**
 * App-lifetime Tools MVI store and its read invalidation, shared by both presentations
 * (only one is mounted per process).
 */
export function ToolsProvider({ children }: { children: ReactNode }) {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const toolsRuntime = useMemo(
    () => createToolsRuntime(services, coordination),
    [services, coordination],
  );
  const { state, dispatch } = useToolsStore("java", toolsRuntime);
  const started = useRef(false);
  const shellCheckRef = useRef<ShellCheck | null>(null);
  shellCheckRef.current = state.shellCheck;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dispatch({ type: "started" });
    dispatch({ type: "refresh" });
  }, [dispatch]);

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      const environmentChanged = changesEnvironment(scopes);
      if (environmentChanged) {
        shellCheckRef.current = null;
        dispatch({ type: "clearShellCheck" });
      }
      if (scopesNeedProfileReload(scopes)) {
        dispatch({ type: "loadProfiles" });
      }
      if (!scopesNeedToolsRefresh(scopes)) return;
      dispatch({ type: "refresh" });
      if (scopes.includes("tools-shell-check") && shellCheckRef.current && !environmentChanged) {
        dispatch({ type: "checkShell" });
      }
    });
  }, [coordination, dispatch]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useTools(): ToolsContextValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) {
    throw new Error("useTools requires ToolsProvider");
  }
  return ctx;
}
