import { useLayoutEffect, useRef, useState } from "react";
// no-inline: the app's CSP blocks data: images, and Vite inlines small SVGs by default.
import brandIcon from "../../../src-tauri/icons/source/logo.svg?no-inline";
import { Icon } from "../../components/ui/Icon";
import { ToolLogo } from "../../components/ui/ToolLogo";
import { useI18n } from "../../hooks/useI18n";
import { shellNavigationHref, type ShellPage } from "../../lib/shellNavigation";
import type { ToolKind } from "../tools/types";
import { OVERVIEW_TOOL_KINDS, TOOL_DISPLAY } from "./overviewTools";
import { scanHealth, type ToolScanSlice } from "./toolOverviewModel";

interface Props {
  activePage: ShellPage;
  /** The tool whose sheet is on screen, which is then the selected row rather than its page. */
  openTool: ToolKind | null;
  byTool: Record<ToolKind, ToolScanSlice>;
  onPage: (page: ShellPage) => void;
  onTool: (tool: ToolKind, trigger: HTMLButtonElement) => void;
}

const NAV_PATHS: Record<ShellPage, string> = {
  tools: "M2 3h12v10H2zM5 6l2 2-2 2m4 0h2",
  profiles: "M3 2h7v3h3v9H6v-3H3zM6 5h4M6 8h4M8 11h3",
  environment: "M5 2L2 5l3 3m6 0l3 3-3 3M9 2L7 14",
  settings: "M2 4h12M2 12h12M5 2v4m6 4v4",
};

function NavMark({ page }: { page: ShellPage }) {
  return (
    <span className="shell-nav-icon">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={NAV_PATHS[page]} />
      </svg>
    </span>
  );
}

export function ShellSidebar({ activePage, openTool, byTool, onPage, onTool }: Props) {
  const { t } = useI18n();
  const [toolsOpen, setToolsOpen] = useState(true);
  const nav = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState(0);
  // The open tool's row is hidden while Tools is folded, so the section itself says what is open.
  const toolFolded = openTool !== null && !toolsOpen;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the pill follows the selected row and the list's own height
  useLayoutEffect(() => {
    const measure = () => {
      const active = nav.current?.querySelector<HTMLElement>("[aria-current]");
      if (active) setPill(active.offsetTop);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activePage, openTool, toolsOpen]);

  const pageLink = (id: ShellPage, label: string) => (
    <a
      key={id}
      href={shellNavigationHref({ page: id })}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onPage(id);
      }}
      className="shell-nav-link"
      aria-current={activePage === id && !openTool ? "page" : undefined}
    >
      <NavMark page={id} />
      {label}
    </a>
  );

  return (
    <nav className="shell-nav" aria-label={t("desktop_shell.nav_label")}>
      <div className="shell-brand" translate="no">
        <img src={brandIcon} width="22" height="22" alt="" aria-hidden="true" />
        <span>Whichcraft</span>
      </div>
      <div ref={nav} className="shell-nav-list">
        <span aria-hidden className="shell-nav-pill" data-hidden={toolFolded} style={{ transform: `translateY(${pill}px)` }} />
        {pageLink("tools", t("desktop_shell.nav_tools"))}
        {pageLink("profiles", t("desktop_shell.nav_profiles"))}
        {pageLink("environment", t("desktop_shell.nav_environment"))}
        <div className="shell-nav-rule" />
        <button type="button" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)} className="shell-nav-section relative">
          <span className="shell-nav-chevron">
            <Icon name="chevron-down" size={12} aria-hidden />
          </span>
          {t("desktop_shell.nav_tools_section")}
          {toolFolded && (
            <span className="min-w-0 truncate font-medium text-fg" translate="no">
              · {TOOL_DISPLAY[openTool].title}
            </span>
          )}
        </button>
        <div className="shell-collapse" data-open={toolsOpen} inert={!toolsOpen}>
          <div>
            {OVERVIEW_TOOL_KINDS.map((tool) => {
              const slice = byTool[tool];
              const health = scanHealth(slice);
              const attention = health === "mismatch" || health === "error";
              return (
                <button
                  key={tool}
                  type="button"
                  aria-current={openTool === tool ? "true" : undefined}
                  onClick={(e) => onTool(tool, e.currentTarget)}
                  className="shell-nav-link"
                >
                  <ToolLogo tool={tool} tile={22} size={16} />
                  <span className="min-w-0 flex-1 truncate" translate="no">
                    {TOOL_DISPLAY[tool].title}
                  </span>
                  {attention && (
                    <span
                      className="shell-dot bg-warn"
                      title={t(health === "error" ? "desktop_shell.load_error" : "desktop_shell.card_differs")}
                    >
                      <span className="sr-only">
                        {t(health === "error" ? "desktop_shell.load_error" : "desktop_shell.card_differs")}
                      </span>
                    </span>
                  )}
                  <span className="text-xs text-dim tabular-nums" aria-hidden>
                    {health === "loading" ? "…" : health === "error" ? "—" : slice.installations.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <span className="min-h-2 flex-1" />
        {pageLink("settings", t("desktop_shell.nav_settings"))}
      </div>
    </nav>
  );
}
