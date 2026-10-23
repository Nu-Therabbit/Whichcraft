import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { createToolsRuntime } from "../../composition/appServices";
import { useAppServices } from "../../composition/AppServicesContext";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import type { ToolsDispatch } from "../tools/useToolsStore";
import { useToolsStore } from "../tools/useToolsStore";
import type { ToolsState } from "../tools/model";
import { scopesNeedToolsRefresh } from "./useShellToolsWrite";

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

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dispatch({ type: "started" });
    dispatch({ type: "refresh" });
  }, [dispatch]);

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (!scopesNeedToolsRefresh(scopes)) return;
      dispatch({ type: "refresh" });
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
