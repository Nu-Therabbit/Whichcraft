import { useMemo } from "react";
import { ThemeContext } from "../../context/ThemeContext";
import { useAppServices } from "../../composition/AppServicesContext";
import { useI18n } from "../../hooks/useI18n";
import { useTheme } from "../../hooks/useTheme";
import { legacyPresentationHref } from "../../lib/appPresentation";
import { Icon } from "../../components/ui/Icon";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import type { ToolInstallationView, ToolKind } from "../tools/types";
import { OVERVIEW_TOOL_KINDS, TOOL_DISPLAY } from "./overviewTools";
import {
  formatInstallationLabel,
  pickEffective,
  pickSelected,
  selectionDiffers,
  toolMatchesQuery,
  unavailableCount,
} from "./toolOverviewModel";
import { useToolsOverview } from "./useToolsOverview";

type ShellPage = "tools" | "profiles" | "environment" | "settings";

function ToolMark({ tool, small }: { tool: ToolKind; small?: boolean }) {
  const meta = TOOL_DISPLAY[tool];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-semibold shrink-0 ${
        small ? "size-8 text-xs" : "size-10 text-sm"
      } bg-surface text-fg border border-rim-subtle`}
      aria-hidden
    >
      {meta.glyph}
    </span>
  );
}

function InstallationRow({ item }: { item: ToolInstallationView }) {
  return (
    <li
      className={`rounded border px-3 py-2 text-sm ${item.available ? "border-rim-subtle bg-panel" : "border-warn/40 bg-warn/5 opacity-90"}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="font-mono text-xs">{item.version}</strong>
        <span className="text-dim text-xs">{item.vendor}</span>
        <span className="text-dim text-xs">
          {item.managed ? "Managed by Whichcraft" : "External installation"}
        </span>
      </div>
      <code className="block mt-1 text-xs text-muted break-all">{item.root}</code>
      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-dim">
        {item.effective && <span className="text-success">Effective installation</span>}
        {item.selected && !item.effective && <span className="text-warn">Selected</span>}
        {!item.available && item.mismatchReason && <span>{item.mismatchReason}</span>}
      </div>
    </li>
  );
}

export function DesktopShellApp() {
  const services = useAppServices();
  const overview = useToolsOverview(services.tools, services.environment);
  const { theme, toggle: toggleTheme } = useTheme();
  const { t } = useI18n();
  const page: ShellPage = "tools";

  const visibleTools = useMemo(
    () =>
      OVERVIEW_TOOL_KINDS.filter((tool) =>
        toolMatchesQuery(tool, overview.query, TOOL_DISPLAY[tool]),
      ),
    [overview.query],
  );

  const selectedSlice = overview.selectedTool ? overview.byTool[overview.selectedTool] : null;

  return (
    <ThemeContext.Provider value={theme}>
      <div className="flex h-screen overflow-hidden bg-canvas text-fg @container">
        <nav
          className="w-52 shrink-0 border-r border-rim-subtle bg-panel flex flex-col py-3 gap-1"
          aria-label={t("desktop_shell.nav_label")}
        >
          {(
            [
              ["tools", t("desktop_shell.nav_tools")],
              ["profiles", t("desktop_shell.nav_profiles")],
              ["environment", t("desktop_shell.nav_environment")],
              ["settings", t("desktop_shell.nav_settings")],
            ] as const
          ).map(([id, label]) => (
            <a
              key={id}
              href={id === "tools" ? undefined : legacyPresentationHref()}
              className={`mx-2 px-3 py-2 rounded text-sm text-left ${
                page === id ? "bg-surface text-fg font-medium" : "text-muted hover:bg-hover"
              }`}
              aria-current={page === id ? "page" : undefined}
            >
              {label}
              {id !== "tools" && (
                <span className="block text-[11px] text-dim font-normal">
                  {t("desktop_shell.legacy_entry")}
                </span>
              )}
            </a>
          ))}
          <div className="mt-auto px-3 pt-3 border-t border-rim-subtle">
            <a className="text-xs text-accent hover:underline" href={legacyPresentationHref()}>
              {t("desktop_shell.open_legacy")}
            </a>
          </div>
        </nav>

        <div
          className={`flex flex-1 flex-col min-w-0 ${overview.detailOpen ? "max-w-[calc(100%-22rem)]" : ""}`}
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-rim-subtle shrink-0">
            <h1 className="text-lg font-semibold">{t("desktop_shell.page_tools")}</h1>
            <div className="flex items-center gap-3 text-xs text-dim">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-success" aria-hidden />
                {t("desktop_shell.this_pc")}
              </span>
              <IconButton
                aria-label={t("desktop_shell.toggle_theme")}
                icon={theme === "dark" ? "sun" : "moon"}
                onClick={toggleTheme}
              />
            </div>
          </header>

          <div
            className="flex items-center gap-2 px-4 py-2 border-b border-rim-subtle shrink-0 flex-wrap"
            role="toolbar"
            aria-label={t("desktop_shell.command_bar")}
          >
            <Button variant="secondary" size="sm" disabled title={t("desktop_shell.install_legacy_hint")}>
              <Icon name="plus" size={14} />
              {t("desktop_shell.install_tool")}
            </Button>
            <span className="w-px h-5 bg-rim-subtle" aria-hidden />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void overview.rescan()}
              disabled={overview.rescanning}
            >
              <Icon name="refresh" size={14} />
              {overview.rescanning ? t("desktop_shell.rescanning") : t("desktop_shell.rescan")}
            </Button>
            <label className="ml-auto flex items-center gap-2 text-sm min-w-[12rem] flex-1 max-w-md">
              <span className="sr-only">{t("desktop_shell.search_label")}</span>
              <input
                type="search"
                value={overview.query}
                onChange={(e) => overview.setQuery(e.target.value)}
                placeholder={t("desktop_shell.search_placeholder")}
                className="w-full bg-surface border border-rim-subtle rounded px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          </div>

          {overview.accountError && (
            <div className="px-5 py-2 bg-danger/15 border-b border-danger text-danger text-sm shrink-0">
              {overview.accountError}
            </div>
          )}

          <div className="flex flex-1 min-h-0">
            <main className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <div>
                <h2 className="text-sm font-semibold">{t("desktop_shell.installed_tools")}</h2>
                <p className="text-xs text-dim">{t("desktop_shell.effective_subtitle")}</p>
              </div>

              <div className="grid gap-2 @xl:grid-cols-2">
                {visibleTools.map((tool) => {
                  const slice = overview.byTool[tool];
                  const meta = TOOL_DISPLAY[tool];
                  const effective = pickEffective(slice.installations);
                  const differs = selectionDiffers(slice.installations);
                  return (
                    <button
                      type="button"
                      key={tool}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        overview.selectedTool === tool
                          ? "border-accent bg-surface"
                          : "border-rim-subtle bg-panel hover:bg-hover"
                      }`}
                      aria-pressed={overview.selectedTool === tool}
                      aria-label={
                        slice.loading
                          ? t("desktop_shell.tool_card_scanning_label", { name: meta.title })
                          : t("desktop_shell.tool_card_label", {
                              name: meta.title,
                              effective: formatInstallationLabel(effective),
                              count: slice.installations.length,
                            })
                      }
                      onClick={() => overview.selectTool(tool)}
                    >
                      <ToolMark tool={tool} small />
                      <span className="flex-1 min-w-0">
                        <strong className="block text-sm">{meta.title}</strong>
                        <span className="flex items-center gap-1 text-xs font-mono text-muted">
                          <span
                            className={`size-1.5 rounded-full ${differs ? "bg-warn" : "bg-success"}`}
                            aria-hidden
                          />
                          {slice.loading ? t("desktop_shell.loading") : formatInstallationLabel(effective)}
                        </span>
                        <small className="text-[11px] text-dim">
                          {slice.loading
                            ? t("desktop_shell.scanning_installations")
                            : slice.error
                              ? t("desktop_shell.load_error")
                              : t("desktop_shell.installation_count", {
                                  count: slice.installations.length,
                                })}
                          {meta.switchOnly ? ` · ${t("desktop_shell.switch_only")}` : ""}
                          {unavailableCount(slice.installations) > 0
                            ? ` · ${t("desktop_shell.unavailable_count", {
                                count: unavailableCount(slice.installations),
                              })}`
                            : ""}
                        </small>
                      </span>
                      <span className="text-dim text-lg" aria-hidden>
                        ›
                      </span>
                    </button>
                  );
                })}
              </div>

              {visibleTools.length === 0 && (
                <p className="text-sm text-dim text-center py-8">{t("desktop_shell.search_empty")}</p>
              )}

              <section aria-labelledby="sdk-heading">
                <h2 id="sdk-heading" className="text-sm font-semibold">
                  {t("desktop_shell.other_sdks")}
                </h2>
                <p className="text-xs text-dim mb-2">{t("desktop_shell.inventory_only")}</p>
                {overview.sdkLoading && <p className="text-xs text-dim">{t("desktop_shell.loading")}</p>}
                {overview.sdkError && <p className="text-xs text-warn">{overview.sdkError}</p>}
                <ul className="space-y-2">
                  {overview.sdks.android && (
                    <li className="rounded border border-rim-subtle px-3 py-2 text-sm bg-panel">
                      <strong>{t("desktop_shell.android_sdk")}</strong>
                      <div className="text-xs text-dim mt-1 font-mono break-all">
                        {overview.sdks.android.sdkRoot ?? t("desktop_shell.not_detected")}
                      </div>
                    </li>
                  )}
                  {overview.sdks.msvc && (
                    <li className="rounded border border-rim-subtle px-3 py-2 text-sm bg-panel">
                      <strong>{t("desktop_shell.msvc")}</strong>
                      <div className="text-xs text-dim mt-1">
                        {overview.sdks.msvc.instances.length > 0
                          ? overview.sdks.msvc.instances
                              .map((item) => item.displayName)
                              .join(", ")
                          : t("desktop_shell.not_detected")}
                      </div>
                    </li>
                  )}
                  {overview.pythonInfo && (
                    <li className="rounded border border-rim-subtle px-3 py-2 text-sm bg-panel">
                      <strong>{t("desktop_shell.python_supplemental")}</strong>
                      <div className="text-xs text-dim mt-1 space-y-1">
                        {overview.pythonInfo.launcherLines.length > 0 && (
                          <div>
                            {t("desktop_shell.python_launcher")}:{" "}
                            <code className="font-mono">
                              {overview.pythonInfo.launcherLines.map((line) => line.path).join("; ")}
                            </code>
                          </div>
                        )}
                        {overview.pythonInfo.storeStub && (
                          <div>
                            {t("desktop_shell.python_store_stub")}: {overview.pythonInfo.storeStub}
                          </div>
                        )}
                      </div>
                    </li>
                  )}
                </ul>
              </section>
            </main>

            {overview.detailOpen && overview.selectedTool && selectedSlice && (
              <aside
                className="w-[22rem] shrink-0 border-l border-rim-subtle bg-panel flex flex-col overflow-hidden"
                aria-label={t("desktop_shell.installation_details")}
              >
                <div className="flex items-start gap-2 px-4 py-3 border-b border-rim-subtle">
                  <ToolMark tool={overview.selectedTool} />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold">{TOOL_DISPLAY[overview.selectedTool].title}</h2>
                    <p className="text-xs text-dim">{TOOL_DISPLAY[overview.selectedTool].description}</p>
                  </div>
                  <IconButton
                    aria-label={t("desktop_shell.close_details")}
                    icon="x"
                    onClick={overview.closeDetail}
                  />
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                  <div>
                    <h3 className="text-[11px] uppercase tracking-wide text-dim">
                      {t("desktop_shell.selection")}
                    </h3>
                    <p className="text-sm font-mono mt-1">
                      {formatInstallationLabel(pickSelected(selectedSlice.installations))}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[11px] uppercase tracking-wide text-dim">
                      {t("desktop_shell.effective_installation")}
                    </h3>
                    <p className="text-sm font-mono mt-1">
                      {formatInstallationLabel(pickEffective(selectedSlice.installations))}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[11px] uppercase tracking-wide text-dim flex justify-between">
                      <span>{t("desktop_shell.installations")}</span>
                      <span>{selectedSlice.installations.length}</span>
                    </h3>
                    {selectedSlice.loading && (
                      <p className="text-xs text-dim py-2">{t("desktop_shell.loading")}</p>
                    )}
                    {selectedSlice.error && (
                      <p className="text-xs text-danger py-2">{selectedSlice.error}</p>
                    )}
                    {!selectedSlice.loading && selectedSlice.installations.length === 0 && (
                      <p className="text-xs text-dim py-2">{t("desktop_shell.no_installations")}</p>
                    )}
                    <ul className="space-y-2 mt-2">
                      {selectedSlice.installations.map((item) => (
                        <InstallationRow key={item.root} item={item} />
                      ))}
                    </ul>
                  </div>
                </div>
              </aside>
            )}
          </div>

          <footer className="shrink-0 border-t border-rim-subtle px-4 py-1.5 text-[11px] text-dim flex justify-between">
            <span>{t("desktop_shell.read_only_status")}</span>
            <span>{t("desktop_shell.preview_presentation")}</span>
          </footer>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
