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
