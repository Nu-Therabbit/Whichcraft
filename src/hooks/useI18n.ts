import { useTranslation } from "react-i18next";
import i18n from "../i18n";

export type Language = "en" | "ja" | "zh-CN" | "ru" | "ko" | "vi";

/** Language switcher entries, shared by the legacy header and the desktop shell. */
export const LANGUAGE_OPTIONS: readonly { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh-CN", label: "简体中文" },
  { value: "ru", label: "Русский" },
  { value: "ko", label: "한국어" },
  { value: "vi", label: "Tiếng Việt" },
];

const STORAGE_KEY = "envarly-language";

export function useI18n() {
  const { t, i18n: i18next } = useTranslation();
  const language = i18next.language as Language;

  const setLanguage = (lang: Language) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {
      // Language switching should still work in test/private-storage contexts.
    }
    i18n.changeLanguage(lang);
  };

  return { t, language, setLanguage };
}
