import { useI18n } from "../../hooks/useI18n";
import type { ShellCheck } from "../../types";

/** Effective installation vs what the shell runs after its profile (E-3, E-4). */
export function ShellCheckResult({ check }: { check: ShellCheck }) {
  const { t } = useI18n();
  const shell = t(`tools.settings.terminal_kind.${check.shell}`);
  return (
    <div
      className={`border rounded-md p-3 text-sm flex flex-col gap-1 ${check.matches ? "border-rim" : "border-warn/40"}`}
      role="status"
    >
      <p className={check.matches ? "" : "text-warn"}>
        {check.matches ? t("tools.shell_check.matches", { shell }) : t("tools.shell_check.differs", { shell })}
      </p>
      <p className="text-xs">
        <span className="text-muted">{t("tools.shell_check.effective")} </span>
        <span className="font-mono wrap-anywhere">{check.effectivePath ?? t("tools.shell_check.none")}</span>
      </p>
      <p className="text-xs">
        <span className="text-muted">{t("tools.shell_check.in_shell", { shell })} </span>
        <span className="font-mono wrap-anywhere">{check.shellPath ?? t("tools.shell_check.none")}</span>
      </p>
    </div>
  );
}
