import { PlanDiffList } from "../../components/ToolsPanel/PlanDiffList";
import { RecoveryBanner } from "../../components/ToolsPanel/RecoveryBanner";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import type { ToolsDispatch } from "../tools/useToolsStore";
import type { ToolsState } from "../tools/model";
import { useI18n } from "../../hooks/useI18n";
import type { ToolInstallationView, ToolKind } from "../tools/types";

interface Props {
  tool: ToolKind;
  state: ToolsState;
  dispatch: ToolsDispatch;
}

export function ShellInstallationDetail({ tool, state, dispatch }: Props) {
  const { t } = useI18n();
  const { installations, loading, error, plan, recovery } = state;
  const applyBusy = plan.applying;
  const current = plan.current;

  if (state.tool !== tool) {
    return <p className="text-xs text-dim py-2">{t("desktop_shell.loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="text-xs text-danger border border-danger/30 rounded-md px-3 py-2" role="alert">
          {error}
        </div>
      )}

      {recovery && (
        <RecoveryBanner
          recovery={recovery}
          busy={applyBusy}
          onResume={() => dispatch({ type: "resolveRecovery", action: "resume" })}
          onRollBack={() => dispatch({ type: "resolveRecovery", action: "rollBack" })}
        />
      )}

      {plan.undoResult && (
        <div className="text-xs border border-rim-subtle rounded-md px-3 py-2 space-y-1">
          {plan.undoResult.conflicts.length > 0 ? (
            <>
              <p className="text-warn font-medium">{t("desktop_shell.undo_conflicts")}</p>
              <ul className="list-disc pl-4 text-dim">
                {plan.undoResult.conflicts.map((c) => (
                  <li key={`${c.scope}-${c.name}`}>
                    {c.scope} {c.name}: {c.message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-success">{t("desktop_shell.undo_restored", { count: plan.undoResult.restored })}</p>
          )}
          <Button variant="ghost" size="xs" onClick={() => dispatch({ type: "clearUndoResult" })}>
            {t("desktop_shell.dismiss_undo_result")}
          </Button>
        </div>
      )}

      <div>
        <h3 className="text-[11px] uppercase tracking-wide text-dim flex justify-between">
          <span>{t("desktop_shell.installations")}</span>
          <span>{installations.length}</span>
        </h3>
        {loading && installations.length === 0 && (
          <p className="text-xs text-dim py-2">{t("desktop_shell.loading")}</p>
        )}
        {!loading && installations.length === 0 && (
          <p className="text-xs text-dim py-2">{t("desktop_shell.no_installations")}</p>
        )}
        <ul className="space-y-2 mt-2">
          {installations.map((item) => (
            <InstallationSwitchRow
              key={item.root}
              item={item}
              planRoot={current?.selected.root ?? null}
              building={plan.building}
              applyBusy={applyBusy}
              onChoose={() => dispatch({ type: "buildPlan", root: item.root })}
            />
          ))}
        </ul>
      </div>

      {plan.building && !current && (
        <p className="text-xs text-dim">{t("tools.building_plan")}</p>
      )}

      {current && current.tool === tool && (
        <section className="border border-rim-subtle rounded-md p-3 flex flex-col gap-3 bg-surface/40">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">{t("tools.plan_title")}</h3>
            <Button variant="ghost" size="xs" onClick={() => dispatch({ type: "clearPlan" })}>
              {t("tools.dismiss_plan")}
            </Button>
          </div>
          <PlanDiffList plan={current} />
          <Button
            variant="primary"
            size="sm"
            onClick={() => dispatch({ type: "applyPlan" })}
            disabled={applyBusy || plan.building}
          >
            {applyBusy ? t("tools.applying") : t("tools.apply_plan")}
          </Button>
        </section>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-rim-subtle">
        <Button variant="secondary" size="xs" onClick={() => dispatch({ type: "undoLast" })} disabled={applyBusy}>
          {t("tools.undo_last")}
        </Button>
      </div>
    </div>
  );
}

function InstallationSwitchRow({
  item,
  planRoot,
  building,
  applyBusy,
  onChoose,
}: {
  item: ToolInstallationView;
  planRoot: string | null;
  building: boolean;
  applyBusy: boolean;
  onChoose: () => void;
}) {
  const { t } = useI18n();
  const reviewing = planRoot === item.root;
  return (
    <li
      className={`rounded border px-3 py-2 text-sm ${
        reviewing ? "border-accent bg-surface" : item.available ? "border-rim-subtle bg-panel" : "border-warn/40 bg-warn/5 opacity-90"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="font-mono text-xs">{item.version}</strong>
        <span className="text-dim text-xs">{item.vendor}</span>
        {item.effective && <Badge variant="user">{t("tools.effective")}</Badge>}
        {item.selected && !item.effective && <Badge variant="muted">{t("tools.selected")}</Badge>}
        {!item.available && <Badge variant="warn">{t("tools.unavailable")}</Badge>}
      </div>
      <code className="block mt-1 text-xs text-muted break-all">{item.root}</code>
      {!item.available && item.mismatchReason && (
        <p className="text-[11px] text-dim mt-1">{item.mismatchReason}</p>
      )}
      <Button
        variant={reviewing ? "primary" : "secondary"}
        size="xs"
        className="mt-2"
        disabled={!item.available || building || applyBusy}
        aria-label={t("desktop_shell.switch_to_installation", {
          vendor: item.vendor,
          version: item.version,
        })}
        onClick={onChoose}
      >
        {reviewing ? t("desktop_shell.reviewing_plan") : t("desktop_shell.use_installation")}
      </Button>
    </li>
  );
}
