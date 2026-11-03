import { useCallback, useEffect } from "react";
import { ToolsSettings } from "../../components/ToolsPanel/ToolsSettings";
import { useAppServices } from "../../composition/AppServicesContext";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useAccent } from "../../hooks/useAccent";
import { useI18n } from "../../hooks/useI18n";
import { useTheme, type Theme } from "../../hooks/useTheme";
import { ACCENTS, type Accent } from "../../lib/themeDocument";
import { useTools } from "../tools/ToolsContext";

const ACCENT_SWATCH: Record<Accent, string> = {
  emerald: "#059669",
  blue: "#2563eb",
  plum: "#6b4a9e",
  pink: "#be185d",
  graphite: "#52525b",
};

function Appearance() {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const { accent, setAccent } = useAccent();
  return (
    <section className="mb-6">
      <h2 className="shell-section-title mb-2">{t("desktop_shell.appearance")}</h2>
      <div className="shell-panel">
        <div className="shell-panel-row shell-setting-row">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t("desktop_shell.theme")}</span>
            <span className="block text-xs text-muted">{t("desktop_shell.theme_hint")}</span>
          </span>
          <SegmentedControl<Theme>
            aria-label={t("desktop_shell.theme")}
            value={theme}
            options={[
              { value: "light", label: t("desktop_shell.theme_light") },
              { value: "dark", label: t("desktop_shell.theme_dark") },
            ]}
            onChange={(next) => {
              if (next !== theme) toggle();
            }}
          />
        </div>
        <div className="shell-panel-row shell-setting-row flex-wrap">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t("desktop_shell.accent")}</span>
            <span className="block text-xs text-muted">{t("desktop_shell.accent_hint")}</span>
          </span>
          <SegmentedControl<Accent>
            aria-label={t("desktop_shell.accent")}
            value={accent}
            options={ACCENTS.map((id) => ({ value: id, label: t(`desktop_shell.accent_${id}`), swatch: ACCENT_SWATCH[id] }))}
            onChange={setAccent}
          />
        </div>
      </div>
    </section>
  );
}

export function ShellSettingsView() {
  const { t } = useI18n();
  const { state, dispatch } = useTools();
  const { platform, environment } = useAppServices();
  const settings = state.settings;
  const pickFolder = useCallback((defaultPath?: string) => platform.pickFolder(defaultPath), [platform]);
  const pathsExist = useCallback((paths: string[]) => environment.validatePaths(paths), [environment]);

  useEffect(() => {
    if (!settings && !state.loading) dispatch({ type: "refresh" });
  }, [dispatch, settings, state.loading]);
  const busy = state.install.busy || state.plan.applying || state.loading;

  if (!settings) {
    return (
      <div className="shell-scroll">
        <p className="mt-3 text-dim">{t("desktop_shell.settings_loading")}</p>
      </div>
    );
  }

  return (
    <div className="shell-scroll shell-settings" data-testid="shell-settings-ready">
      <p className="my-3 text-muted">{t("desktop_shell.settings_intro")}</p>
      <Appearance />
      <ToolsSettings
        settings={settings}
        busy={busy}
        onSave={(next) => dispatch({ type: "saveSettings", settings: next })}
        pickFolder={pickFolder}
        pathsExist={pathsExist}
      />
    </div>
  );
}
