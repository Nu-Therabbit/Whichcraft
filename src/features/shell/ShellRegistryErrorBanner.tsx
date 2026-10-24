import { useI18n } from "../../hooks/useI18n";
import { useEnvironment } from "../environment/EnvironmentContext";

/** Environment bootstrap failures (e.g. registry unavailable) on every shell page. */
export function ShellRegistryErrorBanner() {
  const { t } = useI18n();
  const { error } = useEnvironment();
  if (!error) return null;
  return (
    <div role="alert" className="px-4 py-2 bg-danger/15 border-b border-danger text-danger text-sm shrink-0">
      {t("app.registry_error", { error })}
    </div>
  );
}
