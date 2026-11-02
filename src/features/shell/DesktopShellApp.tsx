import { useCallback, useEffect, useRef, useState } from "react";
import { UninstallSection } from "../../components/ToolsPanel/UninstallSection";
import { Modal } from "../../components/ui/Modal";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import { scopesNeedShellRescan } from "../../coordination/scopeGroups";
import { ThemeContext } from "../../context/ThemeContext";
import { useAppServices } from "../../composition/AppServicesContext";
import { useI18n } from "../../hooks/useI18n";
import { useTheme } from "../../hooks/useTheme";
import type { ToolKind } from "../tools/types";
import { OVERVIEW_TOOL_KINDS } from "./overviewTools";
import { type InventorySummary, summarizeInventory } from "./toolOverviewModel";
import { ShellEnvironmentWorkspace } from "./ShellEnvironmentWorkspace";
import { ShellAppHeaderActions } from "./ShellAppHeaderActions";
import { ShellAppRecoveryBanner } from "./ShellAppRecoveryBanner";
import { ShellPlanReview } from "./ShellPlanReview";
import { ShellRegistryErrorBanner } from "./ShellRegistryErrorBanner";
import { ShellInstallView } from "./ShellInstallView";
import { ShellProfilesWorkspace } from "./ShellProfilesWorkspace";
import { ShellSettingsView } from "./ShellSettingsView";
import { ShellSidebar } from "./ShellSidebar";
import { ShellToolSheet } from "./ShellToolSheet";
import { ShellToolsPage } from "./ShellToolsPage";
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
  if (toolsState.update.busy || toolsState.profiles.busy) return t("desktop_shell.status_working");
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

function DesktopShellAppInner() {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const { page, envTab, installOpen, goPage, goEnvTab, navigate } = useShellNavigation();
  const shellTools = useTools();
  const overview = useToolsOverview(services.tools, services.environment, coordination);
  const toolsWrite = useShellToolsWrite(overview.detailOpen ? overview.selectedTool : null);
  const { theme } = useTheme();
  const { t } = useI18n();
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPageRef = useRef(page);
  // A switch started from a tool's card waits here until that tool's store has caught up.
  const [pendingUse, setPendingUse] = useState<{ tool: ToolKind; root: string } | null>(null);

  useEffect(() => {
    if (previousPageRef.current !== page) {
      pageHeadingRef.current?.focus({ preventScroll: true });
      previousPageRef.current = page;
    }
  }, [page]);

  // A passive effect, because the page behind the sheet stays inert until this commit has finished.
  useEffect(() => {
    if (!overview.detailOpen) detailTriggerRef.current?.focus({ preventScroll: true });
  }, [overview.detailOpen]);

  const activePage: ShellPage = page;
  const inventory = summarizeInventory(Object.values(overview.byTool), overview);
  const thisPc = THIS_PC_STATE[inventory.kind];
  const statusLine = shellStatusLine(t, shellTools.state);
  const inventoryLine = inventoryStatusLine(t, inventory);
  const inspectedTool = overview.detailOpen ? overview.selectedTool : null;
  const openTool = activePage === "tools" ? inspectedTool : null;
  const { uninstall, plan } = toolsWrite.state;
  const uninstallOpen = uninstall.plan !== null || uninstall.outcome !== null;
  const reviewOpen = plan.current !== null && plan.source !== "cleanup" && plan.current.recordsSelection !== false;

  useEffect(() => {
    if (!pendingUse) return;
    const { tool, installations, loading } = toolsWrite.state;
    if (tool !== pendingUse.tool || loading) return;
    setPendingUse(null);
    if (installations.some((item) => item.root === pendingUse.root && item.available)) {
      toolsWrite.dispatch({ type: "buildPlan", root: pendingUse.root });
    }
  }, [pendingUse, toolsWrite]);

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (scopesNeedShellRescan(scopes)) void overview.rescan();
    });
  }, [coordination, overview.rescan]);

  const closeDetail = overview.closeDetail;
  const openToolFrom = useCallback(
    (tool: ToolKind, trigger: HTMLElement) => {
      detailTriggerRef.current = trigger;
      overview.selectTool(tool);
    },
    [overview.selectTool],
  );

  const pageTitle =
    activePage === "environment"
      ? t("desktop_shell.page_environment")
      : activePage === "profiles"
        ? t("desktop_shell.page_profiles")
        : activePage === "settings"
          ? t("desktop_shell.page_settings")
          : t("desktop_shell.page_tools");

  return (
    <ThemeContext.Provider value={theme}>
      <div className="desktop-workbench @container">
        <a className="shell-skip-link" href="#shell-workspace">
          {t("desktop_shell.skip_to_workspace")}
        </a>
        <ShellSidebar
          activePage={activePage}
          openTool={openTool}
          byTool={overview.byTool}
          onPage={(id) => {
            // Developer tools is one step back from a tool's sheet. From another page the sheet comes back as it was.
            if (id === "tools" && activePage === "tools") closeDetail();
            goPage(id);
          }}
          onTool={(tool, trigger) => {
            if (activePage !== "tools") goPage("tools");
            openToolFrom(tool, trigger);
          }}
        />

        <div className="shell-main">
          <section id="shell-workspace" tabIndex={-1} className="shell-sheet" aria-label={pageTitle}>
            <ShellRegistryErrorBanner />
            <ShellAppRecoveryBanner />

            <div className="shell-stage">
              <div className="shell-page-frame" inert={openTool !== null}>
                <header className="shell-header">
                  <h1 ref={pageHeadingRef} tabIndex={-1}>
                    {pageTitle}
                  </h1>
                  <ShellAppHeaderActions />
                </header>
                <div key={activePage} className="shell-page">
                  {activePage === "tools" && (
                    <ShellToolsPage
                      overview={overview}
                      installOpen={installOpen}
                      terminalDisabled={shellTools.state.plan.applying}
                      onOpenTool={openToolFrom}
                      onUse={(tool, root, trigger) => {
                        openToolFrom(tool, trigger);
                        setPendingUse({ tool, root });
                      }}
                      onInstall={(tool) => {
                        if (tool) overview.selectTool(tool);
                        navigate({ page: "tools", installOpen: tool ? true : !installOpen });
                      }}
                      onRescan={() => void overview.rescan(true).then(() => shellTools.dispatch({ type: "refresh" }))}
                      onOpenTerminal={() => shellTools.dispatch({ type: "openTerminal" })}
                    />
                  )}
                  {activePage === "environment" && <ShellEnvironmentWorkspace envTab={envTab} onEnvTab={goEnvTab} />}
                  {activePage === "profiles" && <ShellProfilesWorkspace />}
                  {activePage === "settings" && <ShellSettingsView />}
                </div>
              </div>

              <ShellToolSheet
                tool={openTool}
                slice={openTool ? overview.byTool[openTool] : null}
                state={toolsWrite.state}
                dispatch={toolsWrite.dispatch}
                blocked={reviewOpen || uninstallOpen || installOpen}
                onClose={closeDetail}
                onInstall={() => navigate({ page: "tools", installOpen: true })}
              />
            </div>
          </section>

          <footer aria-live="polite" aria-atomic="true" className="shell-footer">
            <span role="status" className="inline-flex shrink-0 items-center gap-1.5" title={t(thisPc.titleKey)}>
              <span className={`size-1.5 rounded-full ${thisPc.dot}`} aria-hidden />
              <span>{t("desktop_shell.this_pc")}</span>
              <span className="sr-only">{t(thisPc.titleKey)}</span>
            </span>
            <span className="truncate">{statusLine}</span>
            <span className="ml-auto truncate">{inventoryLine}</span>
          </footer>
        </div>

        {activePage === "tools" && (
          <Modal open={installOpen} onClose={() => navigate({ installOpen: false })} ariaLabel={t("desktop_shell.install_pick_heading")} size="lg">
            <ShellInstallView tool={overview.selectedTool} onPickTool={overview.selectTool} onClose={() => navigate({ installOpen: false })} />
          </Modal>
        )}

        <ShellPlanReview state={toolsWrite.state} dispatch={toolsWrite.dispatch} />

        <Modal
          open={uninstallOpen}
          onClose={() => {
            if (!uninstall.busy) toolsWrite.dispatch({ type: "closeUninstall" });
          }}
          ariaLabel={t("tools.uninstall_button")}
          size="lg"
        >
          <div className="p-5">
            <UninstallSection
              bare
              key={uninstall.plan?.installation.root ?? "none"}
              plan={uninstall.plan}
              outcome={uninstall.outcome}
              busy={uninstall.busy}
              defaultReplacement={uninstall.defaultReplacement}
              switchPlan={uninstall.switchPlan}
              onChooseReplacement={(root) => toolsWrite.dispatch({ type: "chooseReplacement", root })}
              onConfirm={(replacementRoot, repoint) => toolsWrite.dispatch({ type: "confirmUninstall", replacementRoot, repoint })}
              onOpenFolder={(path) => toolsWrite.dispatch({ type: "openFolder", path })}
              onClose={() => toolsWrite.dispatch({ type: "closeUninstall" })}
            />
          </div>
        </Modal>
      </div>
    </ThemeContext.Provider>
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
