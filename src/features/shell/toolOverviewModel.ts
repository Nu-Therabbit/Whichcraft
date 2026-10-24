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

export type InventorySummary =
  | { kind: "scanning" }
  | { kind: "account-error" }
  | { kind: "scanned"; installations: number; unavailable: number; failedTools: number };

/** What the status bar and the This PC indicator say about the last inventory scan. */
export function summarizeInventory(
  slices: { loading: boolean; error: string | null; installations: ToolInstallationView[] }[],
  scan: { rescanning: boolean; accountError: string | null },
): InventorySummary {
  if (scan.accountError) return { kind: "account-error" };
  if (scan.rescanning || slices.some((slice) => slice.loading)) return { kind: "scanning" };
  return {
    kind: "scanned",
    installations: slices.reduce((sum, slice) => sum + slice.installations.length, 0),
    unavailable: slices.reduce((sum, slice) => sum + unavailableCount(slice.installations), 0),
    failedTools: slices.filter((slice) => slice.error !== null).length,
  };
}
