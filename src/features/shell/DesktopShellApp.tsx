import { useCallback, useEffect, useRef, useState } from "react";
import { UninstallSection } from "../../components/ToolsPanel/UninstallSection";
import { IconButton } from "../../components/ui/IconButton";
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
import { ShellAppliedNotice, useAppliedVersion } from "./ShellAppliedNotice";
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
import { ShellUndoResult } from "./ShellUndoResult";
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

function focusCard(tool: ToolKind) {
  document.querySelector<HTMLElement>(`[data-tool="${tool}"] .shell-card-head`)?.focus({ preventScroll: true });
}

function DesktopShellAppInner() {
  const services = useAppServices();
  const coordination = useWriteCoordinator();
  const { page, envTab, installOpen, goPage, goEnvTab, navigate } = useShellNavigation();
  const shellTools = useTools();
  const overview = useToolsOverview(services.tools, services.environment, coordination);
  // A switch started from a tool's card waits here until that tool's store has caught up. The page stays where it is.
  const [pendingUse, setPendingUse] = useState<{ tool: ToolKind; root: string; reads: number } | null>(null);
  // A card has no sheet to report into, so a failed switch from one is said on the page, until it is dismissed.
  const [showUseError, setShowUseError] = useState(false);
  const toolsWrite = useShellToolsWrite(overview.detailOpen ? overview.selectedTool : (pendingUse?.tool ?? null));
  const [applied, setApplied] = useAppliedVersion(toolsWrite.state);
  const noticeRef = useRef<HTMLDivElement>(null);
  const hadApplied = useRef(false);
  const { theme } = useTheme();
  const { t } = useI18n();
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPageRef = useRef(page);

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
  const useError = showUseError && !pendingUse && !plan.building && !reviewOpen ? toolsWrite.state.error : null;

  // Once the review is up or the user has moved on, a later error is not this switch's to report.
  useEffect(() => {
    if (reviewOpen || openTool || installOpen) setShowUseError(false);
  }, [reviewOpen, openTool, installOpen]);

  const appliedNotice = applied && <ShellAppliedNotice ref={noticeRef} applied={applied} state={toolsWrite.state} dispatch={toolsWrite.dispatch} onClose={() => setApplied(null)} />;

  useEffect(() => {
    if (!pendingUse) return;
    const { tool, installations, reads, lastReadSucceeded } = toolsWrite.state;
    // Waits for a fresh read, because the installation may have gone since the card was drawn.
    if (tool !== pendingUse.tool || reads === pendingUse.reads) return;
    setPendingUse(null);
    // A failed read leaves cached installations; keep its error visible instead of planning from them.
    if (!lastReadSucceeded) return;
    if (installations.some((item) => item.root === pendingUse.root && item.available)) {
      toolsWrite.dispatch({ type: "buildPlan", root: pendingUse.root });
      return;
    }
    // The card was out of date, and its Use is about to go away with it.
    focusCard(pendingUse.tool);
    void overview.rescan();
  }, [pendingUse, toolsWrite, overview.rescan]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: moves focus only as the result appears and goes
  useEffect(() => {
    const hadResult = hadApplied.current;
    hadApplied.current = applied !== null;
    if (openTool) return;
    if (applied) noticeRef.current?.focus({ preventScroll: true });
    // The notice had focus when it went, and a keyboard stays next to what just changed.
    else if (hadResult && document.activeElement === document.body) focusCard(toolsWrite.state.tool);
  }, [applied]);

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (scopesNeedShellRescan(scopes)) void overview.rescan();
    });
  }, [coordination, overview.rescan]);

  const closeDetail = overview.closeDetail;
  const openToolFrom = useCallback(
    (tool: ToolKind, trigger: HTMLElement) => {
      detailTriggerRef.current = trigger;
      setShowUseError(false);
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
          <main id="shell-workspace" tabIndex={-1} className="shell-sheet" aria-label={pageTitle}>
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
                      onUse={(tool, root) => {
                        setShowUseError(true);
                        setPendingUse({ tool, root, reads: toolsWrite.state.reads });
                      }}
                      onInstall={(tool) => {
                        if (tool) overview.selectTool(tool);
                        navigate({ page: "tools", installOpen: tool ? true : !installOpen });
                      }}
                      onRescan={() => void overview.rescan(true).then(() => shellTools.dispatch({ type: "refresh" }))}
                      onOpenTerminal={() => shellTools.dispatch({ type: "openTerminal" })}
                      notice={
                        !openTool && (
                          <div className="mb-3 flex flex-col gap-3 empty:hidden">
                            {useError && (
                              <div role="alert" className="shell-banner text-danger" data-tone="warn">
                                <span className="line-clamp-3 min-w-0 flex-1 wrap-anywhere" title={useError}>
                                  {useError}
                                </span>
                                <IconButton aria-label={t("desktop_shell.dismiss_undo_result")} icon="x" onClick={() => setShowUseError(false)} />
                              </div>
                            )}
                            {appliedNotice}
                            <ShellUndoResult state={toolsWrite.state} dispatch={toolsWrite.dispatch} />
                          </div>
                        )
                      }
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
                notice={appliedNotice}
              />
            </div>
          </main>

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
