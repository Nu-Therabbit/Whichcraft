import { PlanDiffList } from "../../components/ToolsPanel/PlanDiffList";
import { Button } from "../../components/ui/Button";
import { useI18n } from "../../hooks/useI18n";
import type { ToolApplyPlan } from "../tools/types";
import type { ToolsDispatch } from "../tools/useToolsStore";

export function ShellPlanReview({ current, applying, building, dispatch }: { current: ToolApplyPlan; applying: boolean; building: boolean; dispatch: ToolsDispatch }) {
  const { t } = useI18n();
  const applyBusy = applying || building;
  return (
    <section
      aria-label={t("tools.plan_title")}
      className="border border-rim-subtle rounded-md p-3 flex flex-col gap-3 bg-surface/40"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">{t("tools.plan_title")}</h3>
        <Button variant="ghost" size="xs" onClick={() => dispatch({ type: "clearPlan" })} disabled={applyBusy}>
          {t("tools.dismiss_plan")}
        </Button>
      </div>
      <PlanDiffList plan={current} />
      <Button variant="primary" size="sm" onClick={() => dispatch({ type: "applyPlan" })} disabled={applyBusy}>
        {applying ? t("tools.applying") : t("tools.apply_plan")}
      </Button>
    </section>
  );
}
