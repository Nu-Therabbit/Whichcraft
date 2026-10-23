/** Non-default preview entry for ticket 07; default remains legacy until ticket 18. */
export type AppPresentation = "legacy" | "desktop-shell";

export function readAppPresentation(): AppPresentation {
  if (typeof window === "undefined") return "legacy";
  const value = new URLSearchParams(window.location.search).get("presentation");
  return value === "desktop-shell" ? "desktop-shell" : "legacy";
}

export function legacyPresentationHref(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("presentation");
  return `${url.pathname}${url.search}${url.hash}`;
}
