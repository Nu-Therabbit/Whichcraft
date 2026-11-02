import { useRef } from "react";
import { PlanDiffList } from "../../components/ToolsPanel/PlanDiffList";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useI18n } from "../../hooks/useI18n";
import type { ToolsState } from "../tools/model";
import type { ToolsDispatch } from "../tools/useToolsStore";

/** Tool and profile plans are reviewed above whatever opened them. A PATH cleanup plan stays in the Environment workspace. */
export function ShellPlanReview({ state, dispatch }: { state: ToolsState; dispatch: ToolsDispatch }) {
  const { t } = useI18n();
  const { plan, error } = state;
  const reviewable = plan.current && plan.source !== "cleanup" && plan.current.recordsSelection !== false ? plan.current : null;
  // Held for the dialog's exit, because the plan is cleared the moment it closes.
  const last = useRef(reviewable);
  if (reviewable) last.current = reviewable;
  const shown = reviewable ?? last.current;
  // A stale plan is rebuilt right away, which clears it for a moment, and the dialog stays up through that.
  const open = useRef(false);
  open.current = reviewable !== null || (plan.building && open.current);
  const applyBusy = plan.applying || plan.building;
  const close = () => {
    if (!applyBusy) dispatch({ type: "clearPlan" });
  };
  return (
    <Modal open={open.current} onClose={close} ariaLabel={t("tools.plan_title")} size="md" flex>
      {shown && (
        <section aria-label={t("tools.plan_title")} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <h2 className="shell-dialog-title mb-1">{t("tools.plan_title")}</h2>
            <p className="mb-3 text-muted">{t("desktop_shell.plan_nothing_yet")}</p>
            {error && (
              <div role="alert" className="shell-banner mb-3 text-danger" data-tone="warn">
                {error}
              </div>
            )}
            <PlanDiffList plan={shown} />
          </div>
          <div className="shell-dialog-footer">
            <Button variant="primary" onClick={() => dispatch({ type: "applyPlan" })} disabled={applyBusy}>
              {plan.applying ? t("tools.applying") : t("tools.apply_plan")}
            </Button>
            <Button variant="secondary" onClick={close} disabled={applyBusy}>
              {t("tools.dismiss_plan")}
            </Button>
          </div>
        </section>
      )}
    </Modal>
  );
}
