import { useEffect, useState } from "react";
import {
  applyThemeToDocument,
  getInitialTheme,
  type Theme,
} from "../lib/themeDocument";

export type { Theme };

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    localStorage.setItem("envarly-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
