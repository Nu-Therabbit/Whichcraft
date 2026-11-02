import type { ToolInstallationView, ToolKind } from "../tools/types";

export function pickEffective(installations: ToolInstallationView[]): ToolInstallationView | null {
  return installations.find((item) => item.effective) ?? null;
}

export function pickSelected(installations: ToolInstallationView[]): ToolInstallationView | null {
  return installations.find((item) => item.selected) ?? null;
}

export function formatInstallationLabel(inst: ToolInstallationView | null): string {
  if (!inst) return "—";
  return `${inst.version} · ${inst.vendor}`;
}

export function selectionDiffers(installations: ToolInstallationView[]): boolean {
  const effective = pickEffective(installations);
  const selected = pickSelected(installations);
  if (!effective || !selected) return false;
  return effective.root !== selected.root;
}

export function unavailableCount(installations: ToolInstallationView[]): number {
  return installations.filter((item) => !item.available).length;
}

export function toolMatchesQuery(tool: ToolKind, query: string, meta: { title: string; description: string }): boolean {
  if (!query.trim()) return true;
  const haystack = `${meta.title} ${meta.description} ${tool}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

type InventoryCounts = { installations: number; unavailable: number; failedTools: number };

/** `incomplete`: some tools could not be scanned, so the machine must not look healthy. */
export type InventorySummary =
  | { kind: "scanning" }
  | { kind: "account-error" }
  | ({ kind: "scanned" | "incomplete" } & InventoryCounts);

/** What the status bar and the This PC indicator say about the last inventory scan. */
export function summarizeInventory(
  slices: { loading: boolean; error: string | null; installations: ToolInstallationView[] }[],
  scan: { rescanning: boolean; accountError: string | null },
): InventorySummary {
  if (scan.accountError) return { kind: "account-error" };
  if (scan.rescanning || slices.some((slice) => slice.loading)) return { kind: "scanning" };
  const failedTools = slices.filter((slice) => slice.error !== null).length;
  return {
    kind: failedTools > 0 ? "incomplete" : "scanned",
    installations: slices.reduce((sum, slice) => sum + slice.installations.length, 0),
    unavailable: slices.reduce((sum, slice) => sum + unavailableCount(slice.installations), 0),
    failedTools,
  };
}

export type ToolScanSlice = {
  loading: boolean;
  error: string | null;
  installations: ToolInstallationView[];
  boundRequestId: number;
};

/** What a tool's card shows. Only a first scan has nothing to show: a rescan keeps the last result on screen until the new one arrives. */
export function scanHealth(slice: ToolScanSlice): ReturnType<typeof toolHealth> {
  if (slice.error !== null) return "error";
  if (slice.boundRequestId === 0 && (slice.loading || slice.installations.length === 0)) return "loading";
  return toolHealth({ ...slice, loading: false });
}

/** Sorted so a tool's versions read in the same order on its card and on its sheet. */
export function byVersion(installations: ToolInstallationView[]): ToolInstallationView[] {
  return [...installations].sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
}

/**
 * What a tool's card holds: what Windows uses, or with nothing on PATH the Selection or else the newest
 * usable version; then the Selection when it differs, because that difference is never hidden. The rest is a count.
 */
export function cardLines(installations: ToolInstallationView[]): { main: ToolInstallationView | null; selection: ToolInstallationView | null; hidden: number } {
  const newestFirst = byVersion(installations).reverse();
  const main = pickEffective(installations) ?? pickSelected(installations) ?? newestFirst.find((item) => item.available) ?? newestFirst[0] ?? null;
  const selection = selectionDiffers(installations) ? pickSelected(installations) : null;
  return { main, selection, hidden: installations.length - (main ? 1 : 0) - (selection ? 1 : 0) };
}

/** Status dot of one tool tile: a failed or empty scan is never shown as healthy. */
export function toolHealth(slice: {
  loading: boolean;
  error: string | null;
  installations: ToolInstallationView[];
}): "loading" | "error" | "missing" | "mismatch" | "ok" {
  if (slice.loading) return "loading";
  if (slice.error !== null) return "error";
  if (!pickEffective(slice.installations)) return "missing";
  return selectionDiffers(slice.installations) ? "mismatch" : "ok";
}
