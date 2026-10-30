import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Select } from "../../components/ui/Select";
import { LANGUAGE_OPTIONS, useI18n, type Language } from "../../hooks/useI18n";
import { useAppServices } from "../../composition/AppServicesContext";
import { useUpdateCheck } from "../../hooks/useUpdateCheck";
import { useTheme } from "../../hooks/useTheme";
import { useShellEnvironmentUi } from "./ShellEnvironmentUiContext";

const SOURCE_URL = "https://github.com/Nu-Therabbit/Whichcraft";

/** Language, update notice, source, licences, and theme — same production hooks as legacy AppHeader. */
export function ShellAppHeaderActions() {
  const { t, language, setLanguage } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const { platform } = useAppServices();
  const updateInfo = useUpdateCheck(platform);
  const { setDialog } = useShellEnvironmentUi();

  return (
    <div className="flex items-center gap-2 text-xs text-dim">
      {updateInfo && (
        <Button
          variant="ghost"
          size="xs"
          icon="info"
          onClick={() => void platform.openUrl(updateInfo.url)}
          title={t("header.update_available_title")}
          className="text-accent"
        >
          {t("header.update_available", { version: updateInfo.version })}
        </Button>
      )}
      <div className="flex items-center gap-1">
        <Icon name="globe" size={14} className="text-dim shrink-0" aria-hidden />
        <Select
          aria-label="Language"
          value={language}
          onValueChange={(v) => setLanguage(v as Language)}
          options={LANGUAGE_OPTIONS}
          density="compact"
          className="text-xs"
        />
      </div>
      <IconButton
        aria-label={t("desktop_shell.toggle_theme")}
        icon={theme === "dark" ? "sun" : "moon"}
        onClick={toggleTheme}
        title={theme === "dark" ? t("header.light_mode") : t("header.dark_mode")}
      />
      <Button
        variant="ghost"
        size="xs"
        icon="external-link"
        iconPosition="right"
        onClick={() => void platform.openUrl(SOURCE_URL)}
        title={t("desktop_shell.view_source_title")}
        className="text-dim"
      >
        {t("desktop_shell.view_source")}
      </Button>
      <Button variant="ghost" size="xs" onClick={() => setDialog("licenses")} className="text-dim">
        {t("header.licenses")}
      </Button>
    </div>
  );
}
