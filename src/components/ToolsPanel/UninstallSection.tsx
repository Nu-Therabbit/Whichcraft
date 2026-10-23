import { useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import type { UninstallMethod, UninstallOutcome, UninstallPlan } from "../../types";
import { Button } from "../ui/Button";

interface Props {
  plan: UninstallPlan | null;
  outcome: UninstallOutcome | null;
  busy: boolean;
  onConfirm: (replacementRoot: string | null) => void;
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
          <span className="font-mono break-all">{[method.program, ...method.args].join(" ")}</span>
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
      return <p className="text-warning">{t("tools.uninstall.cancelled")}</p>;
    case "incomplete":
      return (
        <div className="flex flex-col gap-1">
          <p className="text-warning">{t("tools.uninstall.incomplete", { path: outcome.remaining })}</p>
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
export function UninstallSection({ plan, outcome, busy, onConfirm, onOpenFolder, onClose }: Props) {
  const { t } = useI18n();
  const [replacement, setReplacement] = useState("");
  if (!plan && !outcome) return busy ? <p className="text-sm text-muted">{t("app.loading")}</p> : null;

  const inUse = plan ? plan.usage.processes.length > 0 || plan.usage.folderLocked : false;
  const refused = plan?.method.kind === "refused";
  const missingReplacement = !!plan?.needsReplacement && !replacement;

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
          <span className="text-xs text-muted font-mono break-all">{plan.installation.root}</span>
          <MethodLine method={plan.method} />
          {plan.noConfirmation && <p className="text-warning">{t("tools.uninstall.no_confirmation")}</p>}
          {refused && (
            <Button variant="secondary" size="sm" onClick={() => onOpenFolder(plan.installation.root)}>
              {t("tools.uninstall.open_folder")}
            </Button>
          )}

          {inUse && (
            <div className="text-warning flex flex-col gap-1">
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
            <p className="text-warning">
              {t("tools.uninstall.affected_profiles", { names: plan.affectedProfiles.join(", ") })}
            </p>
          )}

          {plan.needsReplacement && (
            <label className="flex flex-col gap-1">
              <span>{t("tools.uninstall.choose_replacement")}</span>
              <select
                className="bg-surface border border-rim rounded-md px-2 py-1"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              >
                <option value="">—</option>
                {plan.replacements.map((r) => (
                  <option key={r.root} value={r.root}>
                    {r.vendor} {r.version} ({r.root})
                  </option>
                ))}
              </select>
              {plan.replacements.length === 0 && (
                <span className="text-xs text-warning">{t("tools.uninstall.no_replacement")}</span>
              )}
            </label>
          )}

          <Button
            variant="danger"
            disabled={busy || refused || inUse || missingReplacement}
            onClick={() => onConfirm(plan.needsReplacement ? replacement : null)}
          >
            {busy ? t("tools.uninstall.removing") : t("tools.uninstall.confirm")}
          </Button>
        </>
      )}

      {outcome && <OutcomeLine outcome={outcome} onOpenFolder={onOpenFolder} />}
    </section>
  );
}
