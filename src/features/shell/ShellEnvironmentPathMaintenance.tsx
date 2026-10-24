import { PathCleanupSummary } from "../../components/ToolsPanel/PathCleanupSummary";
import { PlanDiffList } from "../../components/ToolsPanel/PlanDiffList";
import { Button } from "../../components/ui/Button";
import { useI18n } from "../../hooks/useI18n";
import { useShellTools } from "./ShellToolsContext";

/** PATH cleanup plan/diff/apply from the Environment workspace (uses tools write admission). */
export function ShellEnvironmentPathMaintenance() {
  const { t } = useI18n();
  const { state, dispatch } = useShellTools();
  const { plan } = state;
  const busy = plan.applying || plan.building;
  const cleanupPlan = plan.current?.recordsSelection === false ? plan.current : null;

  return (
    <div className="px-4 py-2 border-b border-rim-subtle shrink-0 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "planCleanup" })} disabled={busy}>
          {t("tools.cleanup.button")}
        </Button>
      </div>
      {plan.cleanup && (
        <>
          <PathCleanupSummary
            duplicates={plan.cleanup.duplicates}
            missing={plan.cleanup.missing}
            pending={cleanupPlan !== null}
          />
          {cleanupPlan && (
            <div className="rounded-md border border-rim-subtle p-3 flex flex-col gap-2 bg-surface/40">
              <PlanDiffList plan={cleanupPlan} />
              <Button variant="primary" size="sm" onClick={() => dispatch({ type: "applyPlan" })} disabled={busy}>
                {plan.applying ? t("tools.applying") : t("tools.apply_plan")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
