/** Desktop shell page and Environment tab routing via URL search params. */

export type ShellPage = "tools" | "environment" | "settings" | "profiles";

export type ShellEnvironmentTab = "variables" | "snapshots" | "import-export" | "check-command";

const PAGE_VALUES: ShellPage[] = ["tools", "environment", "settings", "profiles"];
const ENV_TAB_VALUES: ShellEnvironmentTab[] = [
  "variables",
  "snapshots",
  "import-export",
  "check-command",
];

function parsePage(value: string | null): ShellPage {
  if (value && PAGE_VALUES.includes(value as ShellPage)) return value as ShellPage;
  return "tools";
}

function parseEnvTab(value: string | null): ShellEnvironmentTab {
  if (value && ENV_TAB_VALUES.includes(value as ShellEnvironmentTab)) {
    return value as ShellEnvironmentTab;
  }
  return "variables";
}

export type ShellNavigation = {
  page: ShellPage;
  envTab: ShellEnvironmentTab;
  installOpen: boolean;
};

export function readShellNavigation(search = window.location.search): ShellNavigation {
  const params = new URLSearchParams(search);
  return {
    page: parsePage(params.get("page")),
    envTab: parseEnvTab(params.get("env")),
    installOpen: params.get("install") === "1",
  };
}

export function shellNavigationHref(
  patch: Partial<ShellNavigation>,
  baseHref = window.location.href,
): string {
  const url = new URL(baseHref);
  const current = readShellNavigation(url.search);
  const next = { ...current, ...patch };
  url.searchParams.set("presentation", "desktop-shell");
  if (next.page === "tools") url.searchParams.delete("page");
  else url.searchParams.set("page", next.page);
  if (next.page === "environment") url.searchParams.set("env", next.envTab);
  else url.searchParams.delete("env");
  if (next.installOpen && next.page === "tools") url.searchParams.set("install", "1");
  else url.searchParams.delete("install");
  return `${url.pathname}${url.search}${url.hash}`;
}
