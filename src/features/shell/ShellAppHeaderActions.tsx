import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Select } from "../../components/ui/Select";
import { useI18n, type Language } from "../../hooks/useI18n";
import { useUpdateCheck } from "../../hooks/useUpdateCheck";
import { useTheme } from "../../hooks/useTheme";
import { useShellEnvironmentUi } from "./ShellEnvironmentUiContext";

const languageOptions = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh-CN", label: "简体中文" },
  { value: "ru", label: "Русский" },
  { value: "ko", label: "한국어" },
  { value: "vi", label: "Tiếng Việt" },
] as const;

/** Language, update notice, licences, and theme — same production hooks as legacy AppHeader. */
export function ShellAppHeaderActions() {
  const { t, language, setLanguage } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const updateInfo = useUpdateCheck();
  const { setDialog } = useShellEnvironmentUi();

  return (
    <div className="flex items-center gap-2 text-xs text-dim">
      {updateInfo && (
        <Button
          variant="ghost"
          size="xs"
          icon="info"
          onClick={() => openUrl(updateInfo.url)}
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
          options={languageOptions}
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
      <Button variant="ghost" size="xs" onClick={() => setDialog("licenses")} className="text-dim">
        {t("header.licenses")}
      </Button>
    </div>
  );
}
