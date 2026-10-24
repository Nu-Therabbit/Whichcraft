import { useCallback, useReducer, useRef } from "react";
import type { ToolKind } from "./types";
import { runEffects } from "./effects";
import { isIntent, type ToolsIntent, type ToolsMsg } from "./messages";
import { initialToolsState, type ToolsState } from "./model";
import { reduce } from "./reduce";
import type { ToolsRuntime } from "./runtime";

export type ToolsDispatch = (intent: ToolsIntent) => void;

/** The tools panel's state and the one way to change it (MVI): views dispatch intents, the
 * reducer makes the next state, and effects call the backend and dispatch what came back. */
export function useToolsStore(initialTool: ToolKind, runtime: ToolsRuntime) {
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
          getState: () => current.current,
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
