import { RecoveryBanner } from "../../components/ToolsPanel/RecoveryBanner";
import { useShellTools } from "./ShellToolsContext";

/** Incomplete apply journal surfaced at app level (not only in the tool inspector). */
export function ShellAppRecoveryBanner() {
  const { state, dispatch } = useShellTools();
  if (!state.recovery) return null;
  return (
    <div className="shrink-0 px-4 py-2 border-b border-rim-subtle bg-panel">
      <RecoveryBanner
        recovery={state.recovery}
        busy={state.plan.applying}
        onResume={() => dispatch({ type: "resolveRecovery", action: "resume" })}
        onRollBack={() => dispatch({ type: "resolveRecovery", action: "rollBack" })}
      />
    </div>
  );
}
