import { useState, type ReactNode } from "react";
import { PythonLauncherInfo, SdkInventory } from "../../components/ToolsPanel/SupplementalInfo";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { toolLogoVars, ToolLogo } from "../../components/ui/ToolLogo";
import { useI18n } from "../../hooks/useI18n";
import type { ToolInstallationView, ToolKind } from "../tools/types";
import { OVERVIEW_TOOL_KINDS, TOOL_DISPLAY, toolDescriptionKey } from "./overviewTools";
import {
  byVersion,
  cardLines,
  formatInstallationLabel,
  pickEffective,
  pickSelected,
  scanHealth,
  toolHealth,
  toolMatchesQuery,
  unavailableCount,
} from "./toolOverviewModel";
import type { ToolsOverviewState, ToolOverviewSlice } from "./useToolsOverview";
import { useArrival } from "./useArrival";

type Translate = ReturnType<typeof useI18n>["t"];

function pageSummary(t: Translate, overview: ToolsOverviewState): string {
  const healths = OVERVIEW_TOOL_KINDS.map((tool) => scanHealth(overview.byTool[tool]));
  if (healths.includes("loading")) return t("desktop_shell.tools_sub_scanning");
  if (healths.includes("error")) return t("desktop_shell.tools_sub_failed");
  const differs = OVERVIEW_TOOL_KINDS.find((tool) => scanHealth(overview.byTool[tool]) === "mismatch");
  if (differs) return t("desktop_shell.tools_sub_differs", { tool: TOOL_DISPLAY[differs].title });
  const slices = OVERVIEW_TOOL_KINDS.map((tool) => overview.byTool[tool].installations);
  if (slices.every((installations) => installations.length === 0)) return t("desktop_shell.tools_sub_empty");
  // A tool with nothing installed has no Selection to match, so it does not count against this.
  const allMatch = slices.every((installations) => {
    if (installations.length === 0) return true;
    const selected = pickSelected(installations);
    return selected !== null && selected.root === pickEffective(installations)?.root;
  });
  return t(allMatch ? "desktop_shell.tools_sub_match" : "desktop_shell.tools_sub_review");
}

function cardSummary(t: Translate, slice: ToolOverviewSlice): string {
  switch (scanHealth(slice)) {
    case "loading":
      return t("desktop_shell.scanning_installations");
    case "error":
      return t("desktop_shell.load_error");
    case "mismatch":
      return t("desktop_shell.card_differs");
    case "missing":
      return t(slice.installations.length ? "desktop_shell.card_not_on_path" : "desktop_shell.no_installations");
    case "ok":
      return t(pickSelected(slice.installations) ? "desktop_shell.card_matches" : "desktop_shell.card_on_path");
  }
}

function CardUse({ tool, item, onUse }: { tool: ToolKind; item: ToolInstallationView; onUse: (trigger: HTMLButtonElement) => void }) {
  const { t } = useI18n();
  return (
    <Button
      variant="secondary"
      size="xs"
      aria-label={t("desktop_shell.card_use", { tool: TOOL_DISPLAY[tool].title, version: item.version, vendor: item.vendor })}
      onClick={(e) => onUse(e.currentTarget)}
    >
      {t("desktop_shell.use")}
    </Button>
  );
}

function CardMain({ tool, item, sameElsewhere, arrived, onUse }: { tool: ToolKind; item: ToolInstallationView; sameElsewhere: boolean; arrived: boolean; onUse: (trigger: HTMLButtonElement) => void }) {
  const { t } = useI18n();
  return (
    <li title={item.root} className="shell-install-row" data-effective={item.effective} data-arrived={arrived}>
      <span className="shell-install-version">{item.version}</span>
      {item.selected && !item.effective && <span className="shell-pill shell-pill-warn">{t("desktop_shell.selection")}</span>}
      {!item.available && <span className="shell-pill shell-pill-warn">{t("tools.unavailable")}</span>}
      {sameElsewhere ? (
        <code className="shell-card-detail font-mono">{item.root}</code>
      ) : (
        <span className="shell-card-detail">
          {item.vendor} · {t(`tools.installer.${item.installerKind}`)}
        </span>
      )}
      {item.effective ? (
        <span className="shell-in-use">
          <span aria-hidden className="shell-in-use-dot" />
          {t("desktop_shell.in_use")}
        </span>
      ) : (
        item.available && <CardUse tool={tool} item={item} onUse={onUse} />
      )}
    </li>
  );
}

/** The Selection that differs. What it shares with the line above is left out, so only what tells them apart is said. */
function CardSelection({ tool, item, main, sameElsewhere, arrived, more, onUse }: { tool: ToolKind; item: ToolInstallationView; main: ToolInstallationView; sameElsewhere: boolean; arrived: boolean; more: ReactNode; onUse: (trigger: HTMLButtonElement) => void }) {
  const { t } = useI18n();
  return (
    <li title={item.root} className="shell-card-foot" data-arrived={arrived}>
      <span className="shell-pill shell-pill-warn">{t("desktop_shell.selection")}</span>
      <span className="shell-install-version">{item.version}</span>
      {!item.available && <span className="shell-pill shell-pill-warn">{t("tools.unavailable")}</span>}
      {sameElsewhere ? <code className="shell-card-detail font-mono">{item.root}</code> : item.vendor !== main.vendor && <span className="shell-card-detail">{item.vendor}</span>}
      {more}
      {item.available && (
        <span className="ml-auto flex-none">
          <CardUse tool={tool} item={item} onUse={onUse} />
        </span>
      )}
    </li>
  );
}

function ToolCard({ tool, slice, onOpen, onUse, onInstall, onRetry }: { tool: ToolKind; slice: ToolOverviewSlice; onOpen: (trigger: HTMLButtonElement) => void; onUse: (root: string, trigger: HTMLButtonElement) => void; onInstall: () => void; onRetry: () => void }) {
  const { t } = useI18n();
  const meta = TOOL_DISPLAY[tool];
  const health = scanHealth(slice);
  const items = byVersion(slice.installations);
  const arrived = useArrival(items);
  const { main, selection, hidden } = cardLines(slice.installations);
  const sameElsewhere = (item: ToolInstallationView) => items.some((other) => other.root !== item.root && other.version === item.version && other.vendor === item.vendor);
  const moreLabel = t("desktop_shell.card_more_versions", { count: hidden });
  const moreButton = (text: string) =>
    hidden > 0 && (
      <button type="button" className="shell-card-more" title={moreLabel} aria-label={`${meta.title}: ${moreLabel}`} onClick={(e) => onOpen(e.currentTarget)}>
        {text}
      </button>
    );
  const effective = pickEffective(slice.installations);
  const liveHealth = toolHealth(slice);
  const healthLabel = t(
    {
      loading: "desktop_shell.loading",
      error: "desktop_shell.load_error",
      missing: "desktop_shell.not_detected",
      mismatch: "desktop_shell.selection_mismatch",
      ok: "tools.effective",
    }[liveHealth],
  );
  return (
    <li className="shell-panel shell-card" data-tool={tool} style={toolLogoVars(tool)}>
      <span aria-hidden className="shell-card-mark" />
      <button
        type="button"
        className="shell-card-head"
        aria-label={`${
          slice.loading
            ? t("desktop_shell.tool_card_scanning_label", { name: meta.title })
            : t("desktop_shell.tool_card_label", {
                name: meta.title,
                effective: formatInstallationLabel(effective),
                count: slice.installations.length,
              })
        }. ${healthLabel}`}
        onClick={(e) => onOpen(e.currentTarget)}
      >
        <ToolLogo tool={tool} tile={36} size={24} />
        <span className="min-w-0 flex-1">
          <strong className="shell-card-name truncate" translate="no">
            {meta.title}
          </strong>
          <span className={`block truncate text-xs ${health === "mismatch" ? "font-medium text-warn" : "text-muted"}`}>
            {cardSummary(t, slice)}
            {meta.switchOnly && health === "missing" ? ` · ${t("desktop_shell.switch_only")}` : ""}
            {unavailableCount(slice.installations) > 0 ? ` · ${t("desktop_shell.unavailable_count", { count: unavailableCount(slice.installations) })}` : ""}
          </span>
        </span>
        <span className="shell-card-chevron">
          <Icon name="chevron-down" size={14} aria-hidden />
        </span>
      </button>
      {health === "loading" || health === "error" || !main ? (
        <div className="shell-card-empty">
          {health === "loading" && <p className="min-w-0 flex-1 text-xs text-muted">{t("desktop_shell.loading")}</p>}
          {health === "error" && (
            <Button variant="secondary" size="xs" title={slice.error ?? undefined} onClick={onRetry}>
              {t("desktop_shell.retry_scan")}
            </Button>
          )}
          {health === "missing" &&
            (meta.switchOnly ? (
              <span className="flex-1 text-xs text-muted">{t("desktop_shell.card_add_folder")}</span>
            ) : (
              <Button variant="secondary" size="xs" aria-label={t("desktop_shell.install_heading", { tool: meta.title })} onClick={onInstall}>
                {t("desktop_shell.install_short")}
              </Button>
            ))}
        </div>
      ) : (
        <ul className="shell-card-rows">
          <CardMain tool={tool} item={main} arrived={arrived === main.root} sameElsewhere={sameElsewhere(main)} onUse={(trigger) => onUse(main.root, trigger)} />
          {selection ? (
            <CardSelection
              tool={tool}
              item={selection}
              main={main}
              arrived={arrived === selection.root}
              sameElsewhere={sameElsewhere(selection)}
              more={moreButton(`+${hidden}`)}
              onUse={(trigger) => onUse(selection.root, trigger)}
            />
          ) : (
            <li className="shell-card-foot">{hidden > 0 ? moreButton(moreLabel) : <span className="text-xs text-muted">{t("desktop_shell.card_one_version")}</span>}</li>
          )}
        </ul>
      )}
    </li>
  );
}

interface Props {
  overview: ToolsOverviewState;
  installOpen: boolean;
  terminalDisabled: boolean;
  onOpenTool: (tool: ToolKind, trigger: HTMLButtonElement) => void;
  onUse: (tool: ToolKind, root: string, trigger: HTMLButtonElement) => void;
  onInstall: (tool?: ToolKind) => void;
  onRescan: () => void;
  onOpenTerminal: () => void;
}

export function ShellToolsPage({ overview, installOpen, terminalDisabled, onOpenTool, onUse, onInstall, onRescan, onOpenTerminal }: Props) {
  const { t } = useI18n();
  const [sdksOpen, setSdksOpen] = useState(false);
  const visibleTools = OVERVIEW_TOOL_KINDS.filter((tool) =>
    toolMatchesQuery(tool, overview.query, {
      title: TOOL_DISPLAY[tool].title,
      description: t(toolDescriptionKey(tool)),
    }),
  );
  return (
    <main className="shell-scroll @container">
      <p className="mt-3 text-muted">{pageSummary(t, overview)}</p>
      <div className="shell-tools-toolbar" role="toolbar" aria-label={t("desktop_shell.command_bar")}>
        <label className="shell-search">
          <span className="sr-only">{t("desktop_shell.search_label")}</span>
          <input
            type="search"
            name="tool-search"
            autoComplete="off"
            spellCheck={false}
            value={overview.query}
            onChange={(e) => overview.setQuery(e.target.value)}
            placeholder={t("desktop_shell.search_placeholder")}
            className="h-8 w-full rounded-control border border-rim-subtle bg-field px-2.5 hover:border-rim"
          />
        </label>
        <Button variant="secondary" size="sm" onClick={onOpenTerminal} disabled={terminalDisabled}>
          {t("tools.open_terminal")}
        </Button>
        {/* Not `disabled`, which would throw keyboard focus away for the length of the scan. */}
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          aria-disabled={overview.rescanning}
          className={overview.rescanning ? "text-dim cursor-not-allowed" : ""}
          onClick={() => {
            if (!overview.rescanning) onRescan();
          }}
        >
          {overview.rescanning ? t("desktop_shell.rescanning") : t("desktop_shell.rescan")}
        </Button>
        <Button variant="primary" size="sm" icon="plus" aria-pressed={installOpen} onClick={() => onInstall()}>
          {t("desktop_shell.install_tool")}
        </Button>
      </div>

      {overview.accountError && (
        <div role="alert" className="shell-banner mb-3 text-danger" data-tone="warn">
          {overview.accountError}
        </div>
      )}

      <ul className="shell-tool-grid">
        {visibleTools.map((tool) => (
          <ToolCard
            key={tool}
            tool={tool}
            slice={overview.byTool[tool]}
            onOpen={(trigger) => onOpenTool(tool, trigger)}
            onUse={(root, trigger) => onUse(tool, root, trigger)}
            onInstall={() => onInstall(tool)}
            onRetry={onRescan}
          />
        ))}
      </ul>
      {visibleTools.length === 0 && <p className="py-8 text-center text-dim">{t("desktop_shell.search_empty")}</p>}

      <section aria-labelledby="sdk-heading" className="shell-panel mt-3">
        <h2 id="sdk-heading">
          <button type="button" aria-expanded={sdksOpen} onClick={() => setSdksOpen(!sdksOpen)} className="flex min-h-11 w-full items-center gap-2 rounded-panel bg-transparent px-3 text-left font-medium hover:bg-hover">
            <span className="flex-1">
              {t("desktop_shell.other_sdks")} <span className="font-normal text-muted">· {t("desktop_shell.inventory_only")}</span>
            </span>
            <span className="inline-flex text-dim">
              <Icon name={sdksOpen ? "chevron-up" : "chevron-down"} size={14} aria-hidden />
            </span>
          </button>
        </h2>
        <div className="shell-collapse" data-open={sdksOpen} inert={!sdksOpen}>
          <div>
            <div className="space-y-4 border-t border-rim-subtle p-3">
              {overview.sdkLoading && <p className="text-xs text-dim">{t("desktop_shell.loading")}</p>}
              {overview.sdkIncomplete && <p className="text-xs text-warn">{t("desktop_shell.sdk_incomplete")}</p>}
              {!overview.sdkLoading && <SdkInventory android={overview.sdks.android} msvc={overview.sdks.msvc} />}
              {!overview.sdkLoading && overview.pythonInfo && <PythonLauncherInfo info={overview.pythonInfo} />}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
