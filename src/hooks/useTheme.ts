import { useEffect, useState } from "react";
import {
  applyThemeToDocument,
  getInitialTheme,
  type Theme,
} from "../lib/themeDocument";

export type { Theme };

const THEME_CHANGED = "whichcraft-theme-changed";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    localStorage.setItem("whichcraft-theme", theme);
  }, [theme]);

  // The header and Settings each hold this hook, and a change from one has to reach the other.
  useEffect(() => {
    const onChanged = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener(THEME_CHANGED, onChanged);
    return () => window.removeEventListener(THEME_CHANGED, onChanged);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.dispatchEvent(new CustomEvent(THEME_CHANGED, { detail: next }));
  };

  return { theme, toggle };
}
