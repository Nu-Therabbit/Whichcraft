import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import type { ToolApplyPlan, UninstallMethod, UninstallOutcome, UninstallPlan } from "../../types";
import { Button } from "../ui/Button";
import { PlanDiffList } from "./PlanDiffList";

interface Props {
  plan: UninstallPlan | null;
  outcome: UninstallOutcome | null;
  busy: boolean;
  /** Preselected replacement, e.g. the version an update just installed. */
  defaultReplacement?: string | null;
  /** The switch to the chosen replacement, applied before removing; shown so it is reviewed first. */
  switchPlan?: ToolApplyPlan | null;
  /** Builds `switchPlan` for a newly chosen replacement. */
  onChooseReplacement?: (root: string | null) => void;
  onConfirm: (replacementRoot: string | null, repointProfiles: boolean) => void;
  onOpenFolder: (path: string) => void;
  onClose: () => void;
}

function MethodLine({ method }: { method: UninstallMethod }) {
  const { t } = useI18n();
  switch (method.kind) {
    case "managed":
      return <p>{t("tools.uninstall.method_managed", { store: method.store })}</p>;
    case "uninstaller":
      return (
        <p>
          {t("tools.uninstall.method_uninstaller")}{" "}
          <span className="font-mono wrap-anywhere">{[method.program, ...method.args].join(" ")}</span>
        </p>
      );
    case "recycleFolder":
      return <p>{t("tools.uninstall.method_recycle")}</p>;
    case "refused":
      return <p className="text-danger">{t("tools.uninstall.refused", { reason: method.reason })}</p>;
  }
}

function OutcomeLine({ outcome, onOpenFolder }: { outcome: UninstallOutcome; onOpenFolder: (path: string) => void }) {
  const { t } = useI18n();
  switch (outcome.status) {
    case "removed":
      return <p className="text-success">{t("tools.uninstall.removed")}</p>;
    case "cancelled":
      return <p className="text-warn">{t("tools.uninstall.cancelled")}</p>;
    case "incomplete":
      return (
        <div className="flex flex-col gap-1">
          <p className="text-warn">{t("tools.uninstall.incomplete", { path: outcome.remaining })}</p>
          <Button variant="secondary" size="sm" onClick={() => onOpenFolder(outcome.remaining)}>
            {t("tools.uninstall.open_folder")}
          </Button>
        </div>
      );
    case "blocked":
      return <p className="text-danger">{t("tools.uninstall.blocked", { reason: outcome.reason })}</p>;
    case "failed":
      return <p className="text-danger">{t("tools.uninstall.failed", { code: String(outcome.code) })}</p>;
  }
}

/** Shows how an installation would be removed and what blocks it, then removes it on confirm. */
export function UninstallSection({
  plan,
  outcome,
  busy,
  defaultReplacement,
  switchPlan,
  onChooseReplacement,
  onConfirm,
  onOpenFolder,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [replacement, setReplacement] = useState(
    plan?.replacements.some((r) => r.root === defaultReplacement) ? (defaultReplacement ?? "") : "",
  );
  const [repoint, setRepoint] = useState(true);
  const choose = useRef(onChooseReplacement);
  choose.current = onChooseReplacement;
  const needsSwitch = !!plan?.needsReplacement;

  // A preselected replacement needs its switch plan too, built once when the dialog opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the replacement shown on open
  useEffect(() => {
    if (needsSwitch && replacement) choose.current?.(replacement);
  }, [needsSwitch]);
  if (!plan && !outcome) return busy ? <p className="text-sm text-muted">{t("app.loading")}</p> : null;

  const inUse = plan ? plan.usage.processes.length > 0 || plan.usage.folderLocked : false;
  const refused = plan?.method.kind === "refused";
  // The switch must be on screen, for exactly the chosen replacement, before removing.
  const switchShown = !!switchPlan && switchPlan.selected.root === replacement;
  const missingReplacement = needsSwitch && (!replacement || !switchShown);

  return (
    <section className="border border-danger/40 rounded-md p-4 flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">
          {plan
            ? t("tools.uninstall.title", { name: `${plan.installation.vendor} ${plan.installation.version}` })
            : t("tools.uninstall.title_done")}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("tools.dismiss_plan")}
        </Button>
      </div>

      {plan && (
        <>
          <span className="text-xs text-muted font-mono wrap-anywhere">{plan.installation.root}</span>
          <MethodLine method={plan.method} />
          {plan.noConfirmation && <p className="text-warn">{t("tools.uninstall.no_confirmation")}</p>}
          {refused && (
            <Button variant="secondary" size="sm" onClick={() => onOpenFolder(plan.installation.root)}>
              {t("tools.uninstall.open_folder")}
            </Button>
          )}

          {inUse && (
            <div className="text-warn flex flex-col gap-1">
              <p>{plan.usage.processes.length > 0 ? t("tools.uninstall.in_use") : t("tools.uninstall.folder_open")}</p>
              {plan.usage.processes.length > 0 && (
                <ul className="list-disc pl-5 font-mono text-xs">
                  {plan.usage.processes.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {plan.gradleHint && <p className="text-xs">{t("tools.uninstall.gradle_hint")}</p>}
            </div>
          )}

          {plan.affectedProfiles.length > 0 && (
            <p className="text-warn">
              {t("tools.uninstall.affected_profiles", { names: plan.affectedProfiles.join(", ") })}
            </p>
          )}

          {(plan.needsReplacement || plan.affectedProfiles.length > 0) && (
            <label className="flex flex-col gap-1">
              <span>
                {plan.needsReplacement
                  ? t("tools.uninstall.choose_replacement")
                  : t("tools.uninstall.choose_profile_replacement")}
              </span>
              <select
                className="bg-surface border border-rim rounded-md px-2 py-1"
                value={replacement}
                onChange={(e) => {
                  setReplacement(e.target.value);
                  if (needsSwitch) onChooseReplacement?.(e.target.value || null);
                }}
              >
                <option value="">—</option>
                {plan.replacements.map((r) => (
                  <option key={r.root} value={r.root}>
                    {r.vendor} {r.version} ({r.root})
                  </option>
                ))}
              </select>
              {plan.replacements.length === 0 && (
                <span className="text-xs text-warn">{t("tools.uninstall.no_replacement")}</span>
              )}
            </label>
          )}

          {needsSwitch && switchShown && switchPlan && (
            <div className="border border-rim rounded-md p-3 flex flex-col gap-2 bg-surface/40">
              <p className="font-medium">{t("tools.uninstall.switch_first")}</p>
              <PlanDiffList plan={switchPlan} />
            </div>
          )}

          {plan.affectedProfiles.length > 0 && replacement && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={repoint} onChange={(e) => setRepoint(e.target.checked)} />
              <span>{t("tools.uninstall.repoint")}</span>
            </label>
          )}

          <Button
            variant="danger"
            disabled={busy || refused || inUse || missingReplacement}
            onClick={() => onConfirm(replacement || null, repoint && plan.affectedProfiles.length > 0)}
          >
            {busy ? t("tools.uninstall.removing") : t("tools.uninstall.confirm")}
          </Button>
        </>
      )}

      {outcome && <OutcomeLine outcome={outcome} onOpenFolder={onOpenFolder} />}
    </section>
  );
}
