import type { ToolKind } from "../tools/types";

export const OVERVIEW_TOOL_KINDS: ToolKind[] = ["java", "node", "python", "go", "flutter", "git"];

export const TOOL_DISPLAY: Record<
  ToolKind,
  { title: string; glyph: string; description: string; switchOnly?: boolean }
> = {
  java: { title: "Java", glyph: "J", description: "JDK · JVM languages" },
  node: { title: "Node.js", glyph: "N", description: "JavaScript runtime" },
  python: { title: "Python", glyph: "Py", description: "Python interpreter" },
  go: { title: "Go", glyph: "Go", description: "Go toolchain" },
  flutter: { title: "Flutter", glyph: "F", description: "Flutter SDK" },
  git: { title: "Git", glyph: "G", description: "Git for Windows", switchOnly: true },
};
