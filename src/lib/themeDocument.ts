export type Theme = "dark" | "light";

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem("whichcraft-theme") as Theme | null;
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeToDocument(theme: Theme): void {
  const html = document.documentElement;
  html.classList.toggle("light", theme === "light");
  html.classList.toggle("dark", theme === "dark");
  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = theme === "light" ? "#fafafa" : "#0c0c0f";
}

export const ACCENTS = ["emerald", "blue", "plum", "pink", "graphite"] as const;
export type Accent = (typeof ACCENTS)[number];

export function getInitialAccent(): Accent {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("whichcraft-accent");
  } catch {
    // Blocked storage only means the choice is not remembered.
  }
  return ACCENTS.find((accent) => accent === stored) ?? "emerald";
}

export function applyAccentToDocument(accent: Accent): void {
  document.documentElement.dataset.accent = accent;
}
