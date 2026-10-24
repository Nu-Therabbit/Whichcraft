import { PythonLauncherInfo, SdkInventory } from "../../components/ToolsPanel/SupplementalInfo";
import { useEffect, useMemo } from "react";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import { scopesNeedShellRescan } from "../../coordination/scopeGroups";
import { ThemeContext } from "../../context/ThemeContext";
import { useAppServices } from "../../composition/AppServicesContext";
import { useI18n } from "../../hooks/useI18n";
import { useTheme } from "../../hooks/useTheme";
import { shellNavigationHref } from "../../lib/shellNavigation";
import { Icon } from "../../components/ui/Icon";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import type { ToolKind } from "../tools/types";
import { OVERVIEW_TOOL_KINDS, TOOL_DISPLAY, toolDescriptionKey } from "./overviewTools";
import {
  formatInstallationLabel,
  type InventorySummary,
  pickEffective,
  pickSelected,
  summarizeInventory,
  toolHealth,
  toolMatchesQuery,
  unavailableCount,
} from "./toolOverviewModel";
import { ShellInstallationDetail } from "./ShellInstallationDetail";
import { ShellEnvironmentWorkspace } from "./ShellEnvironmentWorkspace";
import { ShellAppHeaderActions } from "./ShellAppHeaderActions";
import { ShellAppRecoveryBanner } from "./ShellAppRecoveryBanner";
import { ShellRegistryErrorBanner } from "./ShellRegistryErrorBanner";
import { ShellInstallView } from "./ShellInstallView";
import { ShellProfilesWorkspace } from "./ShellProfilesWorkspace";
import { ShellSettingsView } from "./ShellSettingsView";
import { EnvironmentProvider } from "../environment/EnvironmentContext";
import { ShellEnvironmentUiProvider } from "./ShellEnvironmentUiContext";
import { ToolsProvider, useTools } from "../tools/ToolsContext";
import { useShellNavigation } from "./useShellNavigation";
import { useShellToolsWrite } from "./useShellToolsWrite";
import { useToolsOverview } from "./useToolsOverview";

type ShellPage = "tools" | "profiles" | "environment" | "settings";

type Translate = ReturnType<typeof useI18n>["t"];

function shellStatusLine(t: Translate, toolsState: ReturnType<typeof useTools>["state"]): string {
  if (toolsState.install.busy) return t("desktop_shell.status_installing");
  if (toolsState.plan.applying) return t("desktop_shell.status_applying");
  if (toolsState.plan.building) return t("desktop_shell.status_building_plan");
  if (toolsState.error) return toolsState.error;
  return t("desktop_shell.status_ready");
}

function inventoryStatusLine(t: Translate, summary: InventorySummary): string {
  switch (summary.kind) {
    case "scanning":
      return t("desktop_shell.scanning_installations");
    case "account-error":
      return t("desktop_shell.status_inventory_account_error");
    case "scanned":
    case "incomplete": {
      const parts = [
        t("desktop_shell.status_inventory", {
          count: summary.installations,
          tools: OVERVIEW_TOOL_KINDS.length,
        }),
      ];
      if (summary.unavailable > 0) {
        parts.push(t("desktop_shell.unavailable_count", { count: summary.unavailable }));
      }
      if (summary.failedTools > 0) {
        parts.push(t("desktop_shell.status_inventory_failed", { count: summary.failedTools }));
      }
      return parts.join(" · ");
    }
  }
}

const THIS_PC_STATE: Record<InventorySummary["kind"], { dot: string; titleKey: string }> = {
  scanning: { dot: "bg-warn", titleKey: "desktop_shell.this_pc_scanning" },
  "account-error": { dot: "bg-danger", titleKey: "desktop_shell.this_pc_account_error" },
  incomplete: { dot: "bg-warn", titleKey: "desktop_shell.this_pc_incomplete" },
  scanned: { dot: "bg-success", titleKey: "desktop_shell.this_pc_scanned" },
};

const TOOL_HEALTH_DOT: Record<ReturnType<typeof toolHealth>, string> = {
  loading: "bg-rim",
  error: "bg-danger",
  missing: "bg-rim",
  mismatch: "bg-warn",
  ok: "bg-success",
};

function DesktopShellAppInner() {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const { page, envTab, installOpen, goPage, goEnvTab, navigate } = useShellNavigation();
  const shellTools = useTools();
  const overview = useToolsOverview(services.tools, services.environment, coordination);
  const toolsWrite = useShellToolsWrite(overview.detailOpen ? overview.selectedTool : null);
  const { theme } = useTheme();
  const { t } = useI18n();

  const activePage: ShellPage = page === "profiles" ? "profiles" : page;
  const inventory = summarizeInventory(Object.values(overview.byTool), overview);
  const thisPc = THIS_PC_STATE[inventory.kind];
  const statusLine = shellStatusLine(t, shellTools.state);
  const inventoryLine = inventoryStatusLine(t, inventory);
  const installTool = overview.selectedTool;
  const inspectedTool = overview.detailOpen ? overview.selectedTool : null;
  const toolsBusy = shellTools.state.plan.applying;
  const canCheckShell =
    inspectedTool !== null &&
    shellTools.state.tool === inspectedTool &&
    !shellTools.state.loading &&
    !toolsBusy;

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (scopesNeedShellRescan(scopes)) void overview.rescan();
    });
  }, [coordination, overview.rescan]);

  const visibleTools = useMemo(
    () =>
      OVERVIEW_TOOL_KINDS.filter((tool) =>
        toolMatchesQuery(tool, overview.query, {
          title: TOOL_DISPLAY[tool].title,
          description: t(toolDescriptionKey(tool)),
        }),
      ),
    [overview.query, t],
  );

  const selectedSlice = overview.selectedTool ? overview.byTool[overview.selectedTool] : null;
  const pageTitle =
    activePage === "environment"
      ? t("desktop_shell.page_environment")
      : activePage === "profiles"
        ? t("desktop_shell.page_profiles")
        : activePage === "settings"
          ? t("desktop_shell.page_settings")
          : t("desktop_shell.page_tools");

  const navHref = (id: ShellPage) => shellNavigationHref({ page: id });

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
              href={navHref(id)}
              onClick={(e) => {
                e.preventDefault();
                goPage(id);
              }}
              className={`mx-2 px-3 py-2 rounded text-sm text-left ${
                activePage === id ? "bg-surface text-fg font-medium" : "text-muted hover:bg-hover"
              }`}
              aria-current={activePage === id ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex items-center justify-between px-5 py-3 border-b border-rim-subtle shrink-0">
            <h1 className="text-lg font-semibold">{pageTitle}</h1>
            <div className="flex items-center gap-3 text-xs text-dim">
              <span role="status" className="inline-flex items-center gap-1 max-w-56" title={t(thisPc.titleKey)}>
                <span className={`size-2 rounded-full ${thisPc.dot}`} aria-hidden />
                <span>{t("desktop_shell.this_pc")}<span className="block text-[10px]">{t(thisPc.titleKey)}</span></span>
              </span>
              <ShellAppHeaderActions />
            </div>
          </header>

          <ShellRegistryErrorBanner />
          <ShellAppRecoveryBanner />

          {activePage === "tools" && (
            <>
              <div
                className="flex items-center gap-2 px-4 py-2 border-b border-rim-subtle shrink-0 flex-wrap"
                role="toolbar"
                aria-label={t("desktop_shell.command_bar")}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigate({
                      page: "tools",
                      installOpen: !installOpen,
                    })
                  }
                  aria-pressed={installOpen}
                >
                  <Icon name="plus" size={14} />
                  {t("desktop_shell.install_tool")}
                </Button>
                <span className="w-px h-5 bg-rim-subtle" aria-hidden />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void overview.rescan(true).then(() => shellTools.dispatch({ type: "refresh" }))}
                  disabled={overview.rescanning}
                >
                  <Icon name="refresh" size={14} />
                  {overview.rescanning ? t("desktop_shell.rescanning") : t("desktop_shell.rescan")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => shellTools.dispatch({ type: "checkShell" })}
                  disabled={!canCheckShell}
                  title={canCheckShell ? undefined : t("desktop_shell.check_shell_needs_tool")}
                >
                  {t("tools.check_in_shell")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => shellTools.dispatch({ type: "openTerminal" })}
                  disabled={toolsBusy}
                >
                  {t("tools.open_terminal")}
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

              {installOpen && (
                <ShellInstallView
                  tool={installTool}
                  onPickTool={overview.selectTool}
                  onClose={() => navigate({ installOpen: false })}
                />
              )}

              {overview.accountError && (
                <div role="alert" className="px-5 py-2 bg-danger/15 border-b border-danger text-danger text-sm shrink-0">
                  {overview.accountError}
                </div>
              )}

              <div className="flex flex-1 min-h-0">
                <main className="@container flex-1 min-w-0 overflow-y-auto px-5 py-4 space-y-6">
                  <div>
                    <h2 className="text-sm font-semibold">{t("desktop_shell.installed_tools")}</h2>
                    <p className="text-xs text-dim">{t("desktop_shell.effective_subtitle")}</p>
                  </div>

                  <div className="grid gap-2 @xl:grid-cols-2">
                    {visibleTools.map((tool) => {
                      const slice = overview.byTool[tool];
                      const meta = TOOL_DISPLAY[tool];
                      const effective = pickEffective(slice.installations);
                      const health = toolHealth(slice);
                      const healthLabel = t({ loading: "desktop_shell.loading", error: "desktop_shell.load_error", missing: "desktop_shell.not_detected", mismatch: "desktop_shell.selection_mismatch", ok: "tools.effective" }[health]);
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
                          aria-label={`${
                            slice.loading
                              ? t("desktop_shell.tool_card_scanning_label", { name: meta.title })
                              : t("desktop_shell.tool_card_label", {
                                  name: meta.title,
                                  effective: formatInstallationLabel(effective),
                                  count: slice.installations.length,
                                })
                          }. ${healthLabel}`}
                          onClick={() => overview.selectTool(tool)}
                        >
                          <ToolMark tool={tool} small />
                          <span className="flex-1 min-w-0">
                            <strong className="block text-sm">{meta.title}</strong>
                            <span className="flex items-center gap-1 text-xs font-mono text-muted">
                              <span
                                className={`size-1.5 rounded-full ${TOOL_HEALTH_DOT[health]}`}
                                aria-hidden
                              />
                              {slice.loading
                                ? t("desktop_shell.loading")
                                : formatInstallationLabel(effective)}
                            </span>
                            <small className="text-[11px] text-dim">
                              {slice.loading
                                ? t("desktop_shell.scanning_installations")
                                : slice.error
                                  ? t("desktop_shell.load_error")
                                  : t("desktop_shell.installation_count", {
                                      count: slice.installations.length,
                                    })}
                              {health === "mismatch" ? ` · ${healthLabel}` : ""}
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
                    {overview.sdkIncomplete && (
                      <p className="text-xs text-warn">{t("desktop_shell.sdk_incomplete")}</p>
                    )}
                    {!overview.sdkLoading && (
                      <div className="space-y-4 mt-2">
                        <SdkInventory android={overview.sdks.android} msvc={overview.sdks.msvc} />
                        {overview.pythonInfo && <PythonLauncherInfo info={overview.pythonInfo} />}
                      </div>
                    )}
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
                        <p className="text-xs text-dim">{t(toolDescriptionKey(overview.selectedTool))}</p>
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
                      <ShellInstallationDetail
                        tool={overview.selectedTool}
                        state={toolsWrite.state}
                        dispatch={toolsWrite.dispatch}
                      />
                    </div>
                  </aside>
                )}
              </div>
            </>
          )}

          {activePage === "environment" && (
            <ShellEnvironmentWorkspace envTab={envTab} onEnvTab={goEnvTab} />
          )}

          {activePage === "profiles" && <ShellProfilesWorkspace />}

          {activePage === "settings" && <ShellSettingsView />}

          <footer aria-live="polite" aria-atomic="true" className="shrink-0 flex items-center gap-4 border-t border-rim-subtle px-4 py-1.5 text-[11px] text-dim">
            <span className="truncate">{statusLine}</span>
            <span className="ml-auto truncate">{inventoryLine}</span>
          </footer>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

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

export function DesktopShellApp() {
  return (
    <EnvironmentProvider>
      <ShellEnvironmentUiProvider>
        <ToolsProvider>
          <DesktopShellAppInner />
        </ToolsProvider>
      </ShellEnvironmentUiProvider>
    </EnvironmentProvider>
  );
}
