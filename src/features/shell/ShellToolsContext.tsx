import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { ShellCheck } from "../../types";
import { createToolsRuntime } from "../../composition/appServices";
import { useAppServices } from "../../composition/AppServicesContext";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import type { ToolsDispatch } from "../tools/useToolsStore";
import { useToolsStore } from "../tools/useToolsStore";
import type { ToolsState } from "../tools/model";
import { scopesNeedProfileReload, scopesNeedToolsRefresh } from "./useShellToolsWrite";

type ShellToolsContextValue = {
  state: ToolsState;
  dispatch: ToolsDispatch;
};

const ShellToolsContext = createContext<ShellToolsContextValue | null>(null);

/** App-lifetime Tools MVI store for the desktop shell (install, settings, detail writes). */
export function ShellToolsProvider({ children }: { children: ReactNode }) {
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
      const environmentChanged = scopes.some((scope) => scope.startsWith("environment-"));
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

  return <ShellToolsContext.Provider value={value}>{children}</ShellToolsContext.Provider>;
}

export function useShellTools(): ShellToolsContextValue {
  const ctx = useContext(ShellToolsContext);
  if (!ctx) {
    throw new Error("useShellTools requires ShellToolsProvider");
  }
  return ctx;
}
