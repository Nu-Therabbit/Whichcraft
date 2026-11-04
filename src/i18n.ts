import i18n, { type BackendModule } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import configurationEn from "./locales/configuration.en.json";

const STORAGE_KEY = "whichcraft-language";
const SUPPORTED_LANGUAGES = ["en", "ja", "zh-CN", "ru", "ko", "vi"] as const;

// English is the fallback, so it ships in the main bundle. The rest load when chosen.
const LOCALE_LOADERS: Record<string, () => Promise<{ default: object }>> = {
  ja: () => import("./locales/ja.json"),
  "zh-CN": () => import("./locales/zh-CN.json"),
  ru: () => import("./locales/ru.json"),
  ko: () => import("./locales/ko.json"),
  vi: () => import("./locales/vi.json"),
};

const localeBackend: BackendModule = {
  type: "backend",
  init() {},
  read(language, _namespace, callback) {
    const load = LOCALE_LOADERS[language];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then(
      (locale) => callback(null, locale.default as never),
      (error) => callback(error, false),
    );
  },
};

function getStoredLanguage() {
  try {
    return typeof localStorage !== "undefined" && typeof localStorage.getItem === "function"
      ? localStorage.getItem(STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}

function detectLanguage(): (typeof SUPPORTED_LANGUAGES)[number] {
  const detected = navigator.language;
  if (detected.startsWith("zh")) return "zh-CN";
  if (detected.startsWith("ja")) return "ja";
  if (detected.startsWith("ru")) return "ru";
  if (detected.startsWith("ko")) return "ko";
  if (detected.startsWith("vi")) return "vi";
  return "en";
}

const stored = getStoredLanguage();
const lng =
  stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored) ? stored : detectLanguage();

// Screen readers and CJK font fallback follow the document's language, not the visible text.
i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

/** Settled once the starting language is in place, so the first render is not in English first. */
export const i18nReady = i18n
  .use(initReactI18next)
  .use(localeBackend)
  .init({
    resources: { en: { translation: { ...en, configuration: configurationEn } } },
    partialBundledLanguages: true,
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
