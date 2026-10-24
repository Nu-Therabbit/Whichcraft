import { Button } from "../../components/ui/Button";
import { useI18n } from "../../hooks/useI18n";
import { RecoveryBanner } from "../../components/ToolsPanel/RecoveryBanner";
import { useTools } from "../tools/ToolsContext";

/** Incomplete apply and uninstall work remains reachable on every workspace. */
export function ShellAppRecoveryBanner() {
  const { state, dispatch } = useTools();
  const { t } = useI18n();
  if (!state.recovery && state.unfinished.length === 0) return null;
  return (
    <div className="shrink-0 max-h-40 overflow-y-auto px-4 py-2 border-b border-rim-subtle bg-panel">
      {state.recovery && <RecoveryBanner
        recovery={state.recovery}
        busy={state.plan.applying}
        onResume={() => dispatch({ type: "resolveRecovery", action: "resume" })}
        onRollBack={() => dispatch({ type: "resolveRecovery", action: "rollBack" })}
      />}
      {state.unfinished.map((u) => (
        <div
          role="status"
          key={u.id}
          className="text-xs border border-warning/40 rounded-md px-3 py-2 flex flex-col gap-2"
        >
          <p className="text-warning">
            {t("tools.uninstall.unfinished", {
              name: `${u.installation.vendor} ${u.installation.version}`,
              path: u.installation.root,
            })}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => dispatch({ type: "openFolder", path: u.installation.root })}
            >
              {t("tools.uninstall.open_folder")}
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => dispatch({ type: "dismissUnfinished", id: u.id })}
            >
              {t("tools.uninstall.rescan")}
            </Button>
          </div>
        </div>
      ))}

    </div>
  );
}
