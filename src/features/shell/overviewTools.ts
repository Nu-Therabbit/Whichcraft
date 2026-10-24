import type { ToolKind } from "../tools/types";

export const OVERVIEW_TOOL_KINDS: ToolKind[] = ["java", "node", "python", "go", "flutter", "git"];

/** Tools Whichcraft can install; Git stays switch-only. */
export const INSTALLABLE_TOOL_KINDS: ToolKind[] = OVERVIEW_TOOL_KINDS.filter((tool) => tool !== "git");

/** Product names stay untranslated; the description is an i18n key under `desktop_shell.tool_description`. */
export const TOOL_DISPLAY: Record<ToolKind, { title: string; glyph: string; switchOnly?: boolean }> = {
  java: { title: "Java", glyph: "J" },
  node: { title: "Node.js", glyph: "N" },
  python: { title: "Python", glyph: "Py" },
  go: { title: "Go", glyph: "Go" },
  flutter: { title: "Flutter", glyph: "F" },
  git: { title: "Git", glyph: "G", switchOnly: true },
};

export function toolDescriptionKey(tool: ToolKind): string {
  return `desktop_shell.tool_description.${tool}`;
}
