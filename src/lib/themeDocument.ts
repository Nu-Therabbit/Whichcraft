export type Theme = "dark" | "light";

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem("envarly-theme") as Theme | null;
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeToDocument(theme: Theme): void {
  const html = document.documentElement;
  html.classList.toggle("light", theme === "light");
  html.classList.toggle("dark", theme === "dark");
}
