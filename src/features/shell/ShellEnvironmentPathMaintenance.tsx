import { PathCleanupSummary } from "../../components/ToolsPanel/PathCleanupSummary";
import { PlanDiffList } from "../../components/ToolsPanel/PlanDiffList";
import { Button } from "../../components/ui/Button";
import { useI18n } from "../../hooks/useI18n";
import { useTools } from "../tools/ToolsContext";

/**
 * PATH cleanup summary, plan and apply in the Environment workspace (uses tools write admission).
 * The Clean up PATH button lives in the Environment toolbar; this panel shows once a plan exists.
 */
export function ShellEnvironmentPathMaintenance() {
  const { t } = useI18n();
  const { state, dispatch } = useTools();
  const { plan } = state;
  const busy = plan.applying || plan.building;
  const cleanupPlan = plan.current?.recordsSelection === false ? plan.current : null;
  if (!plan.cleanup) return null;

  return (
    <div className="px-4 py-2 border-b border-rim-subtle shrink-0 flex flex-col gap-2">
      <PathCleanupSummary
        duplicates={plan.cleanup.duplicates}
        missing={plan.cleanup.missing}
        pending={cleanupPlan !== null}
      />
      {cleanupPlan && (
        <div className="rounded-md border border-rim-subtle p-3 flex flex-col gap-2 bg-surface/40">
          <PlanDiffList plan={cleanupPlan} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => dispatch({ type: "applyPlan" })} disabled={busy}>
              {plan.applying ? t("tools.applying") : t("tools.apply_plan")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "undoLast" })} disabled={busy}>
              {t("tools.undo_last")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
