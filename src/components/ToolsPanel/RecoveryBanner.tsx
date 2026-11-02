import { useI18n } from "../../hooks/useI18n";
import type { RecoveryView } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface Props {
  recovery: RecoveryView;
  busy: boolean;
  onResume: () => void;
  onRollBack: () => void;
}

const STATE_VARIANT = {
  written: "user",
  notWritten: "muted",
  changedElsewhere: "warn",
} as const;

/** Shown when an apply never finished: lists each change's real state and offers resume or roll back. */
export function RecoveryBanner({ recovery, busy, onResume, onRollBack }: Props) {
  const { t } = useI18n();
  return (
    <div className="border border-warn/40 rounded-md p-4 flex flex-col gap-3" role="alert">
      <div>
        <h3 className="font-semibold text-sm">{t("tools.recovery.title")}</h3>
        <p className="text-xs text-muted">{t("tools.recovery.body", { createdAt: recovery.createdAt })}</p>
      </div>
      <ul className="text-sm space-y-2">
        {recovery.items.map((item) => (
          <li key={`${item.scope}-${item.name}`} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono">
                {item.scope} {item.name}
              </span>
              <Badge variant={STATE_VARIANT[item.state]}>{t(`tools.recovery.state.${item.state}`)}</Badge>
            </div>
            {item.state === "changedElsewhere" && (
              <span className="text-xs text-muted font-mono wrap-anywhere">{item.current ?? "(empty)"}</span>
            )}
          </li>
        ))}
      </ul>
      {!recovery.canResume && <p className="text-xs text-warn">{t("tools.recovery.cannot_resume")}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onResume} disabled={busy || !recovery.canResume}>
          {t("tools.recovery.resume")}
        </Button>
        <Button variant="secondary" size="sm" onClick={onRollBack} disabled={busy}>
          {t("tools.recovery.roll_back")}
        </Button>
      </div>
    </div>
  );
}
