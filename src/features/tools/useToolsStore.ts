import { useCallback, useReducer, useRef } from "react";
import { api as defaultApi } from "../../api";
import { createToolsRuntime, splitEnvarlyApi, type ToolsRuntime } from "../../contracts";
import type { ToolKind } from "../../types";
import { runEffects } from "./effects";
import { isIntent, type ToolsIntent, type ToolsMsg } from "./messages";
import { initialToolsState, type ToolsState } from "./model";
import { reduce } from "./reduce";

export type ToolsDispatch = (intent: ToolsIntent) => void;

const defaultRuntime = createToolsRuntime(splitEnvarlyApi(defaultApi));

/** The tools panel's state and the one way to change it (MVI): views dispatch intents, the
 * reducer makes the next state, and effects call the backend and dispatch what came back. */
export function useToolsStore(
  initialTool: ToolKind = "java",
  runtime: ToolsRuntime = defaultRuntime,
) {
  const [state, apply] = useReducer(reduce, initialTool, initialToolsState);
  // Effects read the state as of their intent. The ref is advanced on every dispatch, not only
  // on render, so messages dispatched back to back inside one effect see each other.
  const current = useRef<ToolsState>(state);
  current.current = state;

  const send = useCallback(
    (msg: ToolsMsg) => {
      const before = current.current;
      current.current = reduce(before, msg);
      apply(msg);
      if (isIntent(msg)) {
        void runEffects(msg, {
          state: before,
          dispatch: send,
          runtime,
          newId: () => crypto.randomUUID(),
        });
      }
    },
    [runtime],
  );

  return { state, dispatch: send as ToolsDispatch };
}
