import { useEffect } from "react";
import type { ToolKind } from "../tools/types";
import { useShellTools } from "./ShellToolsContext";

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
