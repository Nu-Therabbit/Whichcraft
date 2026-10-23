import { useEffect } from "react";
import { useI18n } from "../../hooks/useI18n";
import type { RecoveryView, ToolApplyPlan, ToolInstallationView, ToolKind } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { RecoveryBanner } from "./RecoveryBanner";

const TOOL_KINDS: ToolKind[] = ["java", "node", "python", "go", "flutter", "git"];

interface Props {
  open: boolean;
  onClose: () => void;
  tool: ToolKind;
  onToolChange: (tool: ToolKind) => void;
  installations: ToolInstallationView[];
  loading: boolean;
  error: string | null;
  plan: ToolApplyPlan | null;
  planBusy: boolean;
  applyBusy: boolean;
  onRefresh: () => void;
  onSelect: (root: string) => void;
  onApplyPlan: () => void;
  onUndo: () => void;
  onClearPlan: () => void;
  recovery?: RecoveryView | null;
  onResumeRecovery?: () => void;
  onRollBackRecovery?: () => void;
}

export function ToolsPanel({
  open,
  onClose,
  tool,
  onToolChange,
  installations,
  loading,
  error,
  plan,
  planBusy,
  applyBusy,
  onRefresh,
  onSelect,
  onApplyPlan,
  onUndo,
  onClearPlan,
  recovery,
  onResumeRecovery,
  onRollBackRecovery,
}: Props) {
  const { t } = useI18n();

  // onRefresh changes identity whenever the selected tool changes, so this also refreshes on tool switch.
  useEffect(() => {
    if (open) onRefresh();
  }, [open, onRefresh]);

  return (
    <Modal open={open} onClose={onClose} title={t("tools.title")} size="xl">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="text-sm text-danger border border-danger/30 rounded-md px-3 py-2">{error}</div>
        )}

        {recovery && onResumeRecovery && onRollBackRecovery && (
          <RecoveryBanner
            recovery={recovery}
            busy={applyBusy}
            onResume={onResumeRecovery}
            onRollBack={onRollBackRecovery}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {TOOL_KINDS.map((kind) => (
            <Button
              key={kind}
              variant={kind === tool ? "primary" : "secondary"}
              size="sm"
              onClick={() => onToolChange(kind)}
            >
              {t(`tools.kind.${kind}`)}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
            {t("tools.refresh")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onUndo} disabled={applyBusy}>
            {t("tools.undo_last")}
          </Button>
        </div>

        <p className="text-sm text-muted">{t("tools.discovery_hint")}</p>

        <div className="border border-rim rounded-md divide-y divide-rim max-h-64 overflow-auto">
          {loading && installations.length === 0 ? (
            <div className="p-4 text-sm text-muted">{t("app.loading")}</div>
          ) : installations.length === 0 ? (
            <div className="p-4 text-sm text-muted">{t("tools.no_installations")}</div>
          ) : (
            installations.map((item) => (
              <button
                type="button"
                key={item.root}
                className="w-full text-left px-4 py-3 hover:bg-surface/60 flex flex-col gap-1 disabled:opacity-50"
                onClick={() => onSelect(item.root)}
                disabled={!item.available}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {item.vendor} {item.version}
                  </span>
                  {item.effective && <Badge variant="user">{t("tools.effective")}</Badge>}
                  {item.selected && <Badge variant="muted">{t("tools.selected")}</Badge>}
                  {!item.available && <Badge variant="warn">{t("tools.unavailable")}</Badge>}
                  <Badge variant="muted">{item.installerKind}</Badge>
                </div>
                <span className="text-xs text-muted font-mono break-all">{item.root}</span>
                {item.mismatchReason && (
                  <span className="text-xs text-warning">{item.mismatchReason}</span>
                )}
              </button>
            ))
          )}
        </div>

        {plan && (
          <div className="border border-rim rounded-md p-4 flex flex-col gap-3 bg-surface/40">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">{t("tools.plan_title")}</h3>
              <Button variant="ghost" size="sm" onClick={onClearPlan}>
                {t("tools.dismiss_plan")}
              </Button>
            </div>
            {plan.requiresUac && (
              <p className="text-xs text-warning">{t("tools.uac_required")}</p>
            )}
            {plan.warnings.map((w) => (
              <p key={w} className="text-xs text-warning">
                {w}
              </p>
            ))}
            <p className="text-xs text-muted">{plan.limitationNotice}</p>
            <ul className="text-sm font-mono space-y-2">
              {[...plan.userDiffs, ...plan.systemDiffs].map((d) => (
                <li key={`${d.scope}-${d.name}`}>
                  <span className="text-muted">
                    {d.scope} {d.name}
                  </span>
                  <div className="text-xs text-danger line-through truncate">{d.before ?? "(empty)"}</div>
                  <div className="text-xs text-success truncate">{d.after}</div>
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={onApplyPlan} disabled={applyBusy || planBusy}>
              {applyBusy ? t("tools.applying") : t("tools.apply_plan")}
            </Button>
          </div>
        )}

        {planBusy && !plan && <p className="text-sm text-muted">{t("tools.building_plan")}</p>}
      </div>
    </Modal>
  );
}
