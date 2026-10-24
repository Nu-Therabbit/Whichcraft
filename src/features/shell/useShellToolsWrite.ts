import { useEffect } from "react";
import type { ToolKind } from "../tools/types";
import { useTools } from "../tools/ToolsContext";

/** Sync the app-lifetime shell tools store with the overview's selected tool. */
export function useShellToolsWrite(activeTool: ToolKind | null) {
  const { state, dispatch } = useTools();

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
