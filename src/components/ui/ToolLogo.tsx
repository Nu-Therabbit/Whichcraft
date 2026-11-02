import type { CSSProperties } from "react";
// no-inline: the app's CSP blocks data: images, and Vite inlines small SVGs by default.
// Tool logos from Devicon v2.16.0 (MIT). The marks themselves belong to their projects.
import flutterLogo from "../../assets/tool-logos/flutter.svg?no-inline";
import gitLogo from "../../assets/tool-logos/git.svg?no-inline";
import goLogo from "../../assets/tool-logos/go.svg?no-inline";
import javaLogo from "../../assets/tool-logos/java.svg?no-inline";
import nodeLogo from "../../assets/tool-logos/node.svg?no-inline";
import pythonLogo from "../../assets/tool-logos/python.svg?no-inline";
import type { ToolKind } from "../../features/tools/types";

const TOOL_LOGO: Record<ToolKind, string> = {
  java: javaLogo,
  node: nodeLogo,
  python: pythonLogo,
  go: goLogo,
  flutter: flutterLogo,
  git: gitLogo,
};

/** A white tile keeps every real logo legible and its colours untouched, in both themes. */
export function ToolLogo({ tool, tile, size }: { tool: ToolKind; tile: number; size: number }) {
  return (
    <span
      className="shell-logo-tile"
      style={{ width: tile, height: tile, borderRadius: Math.round(tile / 4) }}
    >
      <img src={TOOL_LOGO[tool]} width={size} height={size} alt="" aria-hidden="true" />
    </span>
  );
}

/** The logo as a variable, for the silhouette a tool's card and sheet paint in its own colour. */
export function toolLogoVars(tool: ToolKind) {
  return { "--tool-logo": `url("${TOOL_LOGO[tool]}")` } as CSSProperties;
}
