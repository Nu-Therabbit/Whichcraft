import { useEffect } from "react";
import { ToolsSettings } from "../../components/ToolsPanel/ToolsSettings";
import { useI18n } from "../../hooks/useI18n";
import { useShellTools } from "./ShellToolsContext";

export function ShellSettingsView() {
  const { t } = useI18n();
  const { state, dispatch } = useShellTools();
  const settings = state.settings;

  useEffect(() => {
    if (!settings && !state.loading) dispatch({ type: "refresh" });
  }, [dispatch, settings, state.loading]);
  const busy = state.install.busy || state.plan.applying || state.loading;

  if (!settings) {
    return (
      <main className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-sm text-dim">{t("desktop_shell.settings_loading")}</p>
      </main>
    );
  }

  return (
    <main
      className="flex-1 overflow-y-auto px-5 py-4 max-w-2xl"
      data-testid="shell-settings-ready"
    >
      <p className="text-xs text-dim mb-4">{t("desktop_shell.settings_intro")}</p>
      <ToolsSettings
        settings={settings}
        busy={busy}
        onSave={(next) => dispatch({ type: "saveSettings", settings: next })}
      />
    </main>
  );
}
