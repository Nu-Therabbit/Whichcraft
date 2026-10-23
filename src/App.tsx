import { useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { AppLoading } from "./components/AppLoading/AppLoading";
import { AppModals } from "./components/AppModals/AppModals";
import { DetailPanel } from "./components/DetailPanel/DetailPanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel/DiagnosticsPanel";
import { PathBanner } from "./components/PathBanner/PathBanner";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { SnapshotPanelDock } from "./components/SnapshotPanel/SnapshotPanelDock";
import { ThemeContext } from "./context/ThemeContext";
import { useUndo } from "./contexts/UndoContext";
import { useAccountSwitch } from "./hooks/useAccountSwitch";
import { useAppInit } from "./hooks/useAppInit";
import { useApplyStaged } from "./hooks/useApplyStaged";
import { useDiagnostics } from "./hooks/useDiagnostics";
import { useDiff } from "./hooks/useDiff";
import { useEnvVars } from "./hooks/useEnvVars";
import { useI18n } from "./hooks/useI18n";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useLocalUndo } from "./hooks/useLocalUndo";
import { usePathStatus } from "./hooks/usePathStatus";
import { useStaged } from "./hooks/useStaged";
import { useStagingHandlers } from "./hooks/useStagingHandlers";
import { useTheme } from "./hooks/useTheme";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import { useDeveloperTools } from "./hooks/useDeveloperTools";
import { ToolsPanel } from "./components/ToolsPanel/ToolsPanel";
import type { DiagnosticAction, EnvironmentDiagnostic } from "./lib/environmentDiagnostics";
import { stagedToDiff } from "./lib/stagedToDiff";
import type { EnvVar, VarScope } from "./types";

type Dialog =
  | "importexport"
  | "changes"
  | "staged"
  | "licenses"
  | "newvar"
  | "checkcommand"
  | "tools"
  | null;

export default function App() {
  const { t } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const { vars, loading, error, refresh } = useEnvVars();
  const [selected, setSelected] = useState<EnvVar | null>(null);
  const [elevated, setElevated] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const diagnostics = useDiagnostics(vars);

  const {
    staged,
    effectiveVars,
    stageSet,
    stageDelete,
    stageImport,
    stageSnapshot,
    unstage,
    clearStaged,
    restoreStaged,
  } = useStaged(vars);

  const { push, undo, redo } = useUndo();
  const { localUndoRef, handleRegisterLocalUndo } = useLocalUndo();

  const {
    userPathInEnv,
    systemPathInEnv,
    otherUserPathInEnv,
    pathBannerDismissed,
    refreshPathStatus,
    handleStageAddToPath,
    handleDismissPathBanner,
  } = usePathStatus(staged, stageSet);

  const {
    diffEntries,
    baselineRef,
    checkForExternalChanges,
    handleDiffApply,
    handleDiffDismiss,
    applyBusy,
    applyError,
  } = useDiff(refresh, setDialog);

  const { handleRefresh, initializing } = useAppInit({
    baselineRef,
    setElevated,
    refreshPathStatus,
    refresh,
    checkForExternalChanges,
  });

  const { accounts, selectedAccount, handleSelectAccount, accountSwitchError } = useAccountSwitch({
    elevated,
    hasStagedChanges: staged.size > 0,
    refresh: async () => {
      await refresh();
      await checkForExternalChanges();
      await refreshPathStatus();
    },
  });
  const personalScope = selectedAccount ? "OtherUser" : "User";

  // When another account is selected, its PATH status takes priority for banner hints,
  // following the same active scope resolution as the sidebar personal scope.
  const pathBannerScope: VarScope | null = selectedAccount
    ? otherUserPathInEnv === false
      ? "OtherUser"
      : null
    : elevated
      ? !systemPathInEnv
        ? "System"
        : null
      : !userPathInEnv
        ? "User"
        : null;

  useKeyboardShortcuts(undo, redo, localUndoRef);

  const updateInfo = useUpdateCheck();
  const developerTools = useDeveloperTools();

  const {
    handleStage,
    handleStageDelete,
    handleUnstage,
    handleClearStaged,
    handleStageImport,
    handleStageSnapshot,
    handleNewVarStage,
  } = useStagingHandlers({
    staged,
    stageSet,
    stageDelete,
    stageImport,
    stageSnapshot,
    unstage,
    clearStaged,
    restoreStaged,
    push,
    setDialog,
    setSelected,
    setSnapshotsOpen,
  });

  const {
    handleApplyStaged,
    busy: stagedBusy,
    error: stagedError,
    progress: stagedProgress,
    log: stagedLog,
  } = useApplyStaged({
    staged,
    clearStaged,
    refresh,
    refreshPathStatus,
    baselineRef,
    setDialog,
  });

  const effectiveSelected = useMemo<EnvVar | null>(() => {
    if (!selected) return null;
    return (
      effectiveVars.find((v) => v.name === selected.name && v.scope === selected.scope) ?? null
    );
  }, [selected, effectiveVars]);

  const stagedDiff = useMemo(() => stagedToDiff(staged), [staged]);

  const handleDiagnosticAction = (diagnostic: EnvironmentDiagnostic, action: DiagnosticAction) => {
    const variable = vars.find(
      (item) => item.name === diagnostic.name && item.scope === diagnostic.scope,
    );
    if (action.kind === "delete") {
      handleStageDelete(diagnostic.name, diagnostic.scope);
    } else if (action.kind === "set-value") {
      handleStage(diagnostic.name, diagnostic.scope, action.value);
    } else if (variable) {
      handleStage(variable.name, variable.scope, variable.value, action.valueKind);
    }
  };

  if (initializing) {
    return (
      <ThemeContext.Provider value={theme}>
        <AppLoading />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div className="flex flex-col h-screen overflow-hidden">
        <AppHeader
          loading={loading}
          stagedCount={staged.size}
          diffCount={diffEntries.length}
          elevated={elevated}
          snapshotsOpen={snapshotsOpen}
          theme={theme}
          onRefresh={handleRefresh}
          onApplyStaged={() => setDialog("staged")}
          onShowChanges={() => setDialog("changes")}
          onImportExport={() => setDialog("importexport")}
          onCheckCommand={() => setDialog("checkcommand")}
          onTools={() => setDialog("tools")}
          onToggleSnapshots={() => setSnapshotsOpen((o) => !o)}
          onToggleTheme={toggleTheme}
          onLicenses={() => setDialog("licenses")}
          updateInfo={updateInfo}
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={handleSelectAccount}
          accountSwitchDisabled={staged.size > 0}
        />

        {pathBannerScope && !pathBannerDismissed && (
          <PathBanner
            scopeLabel={
              pathBannerScope === "OtherUser"
                ? (selectedAccount?.username ?? pathBannerScope)
                : pathBannerScope
            }
            onStageAddToPath={() => handleStageAddToPath(pathBannerScope)}
            onDismiss={handleDismissPathBanner}
          />
        )}

        <DiagnosticsPanel
          diagnostics={diagnostics}
          elevated={elevated}
          onStageAction={handleDiagnosticAction}
        />

        {error && (
          <div className="px-4 py-2 bg-danger/15 border-b border-danger text-danger text-sm shrink-0">
            {t("app.registry_error", { error })}
          </div>
        )}

        {accountSwitchError && (
          <div className="px-4 py-2 bg-danger/15 border-b border-danger text-danger text-sm shrink-0">
            {t("app.account_switch_error", { error: accountSwitchError })}
          </div>
        )}

        <main className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar
            vars={effectiveVars}
            selected={selected}
            onSelect={setSelected}
            onCreateNew={() => setDialog("newvar")}
            loading={loading}
            staged={staged}
            personalScope={personalScope}
            personalScopeLabel={selectedAccount?.username}
          />

          <div className="flex flex-1 overflow-hidden">
            <DetailPanel
              variable={effectiveSelected}
              allVars={effectiveVars}
              elevated={elevated}
              userPathInEnv={userPathInEnv}
              systemPathInEnv={systemPathInEnv}
              staged={staged}
              onStage={handleStage}
              onStageDelete={handleStageDelete}
              onUnstage={handleUnstage}
              onStageAddToPath={handleStageAddToPath}
              onRegisterLocalUndo={handleRegisterLocalUndo}
            />
          </div>

          <SnapshotPanelDock
            open={snapshotsOpen}
            onClose={() => setSnapshotsOpen(false)}
            onStageSnapshot={handleStageSnapshot}
          />
        </main>

        <ToolsPanel
          open={dialog === "tools"}
          onClose={() => {
            setDialog(null);
            developerTools.clearPlan();
          }}
          tool={developerTools.tool}
          onToolChange={developerTools.setTool}
          installations={developerTools.installations}
          loading={developerTools.loading}
          error={developerTools.error}
          plan={developerTools.plan}
          planBusy={developerTools.planBusy}
          applyBusy={developerTools.applyBusy}
          onRefresh={developerTools.refresh}
          onSelect={developerTools.buildPlan}
          onApplyPlan={() => void developerTools.applyPlan()}
          onUndo={() => void developerTools.undoLast()}
          onClearPlan={developerTools.clearPlan}
          recovery={developerTools.recovery}
          onResumeRecovery={() => void developerTools.resumeRecovery()}
          onRollBackRecovery={() => void developerTools.rollBackRecovery()}
          settings={developerTools.settings}
          onSaveSettings={(next) => void developerTools.saveSettings(next)}
          pythonInfo={developerTools.pythonInfo}
          android={developerTools.android}
          msvc={developerTools.msvc}
          onLoadSdks={() => void developerTools.loadSdks()}
          shellCheck={developerTools.shellCheck}
          onShellCheck={() => void developerTools.runShellCheck()}
          onOpenTerminal={() => void developerTools.openTerminal()}
          install={{
            versions: developerTools.remoteVersions,
            loading: developerTools.remoteLoading,
            busy: developerTools.installBusy,
            miseStatus: developerTools.miseStatus,
            chosen: developerTools.chosenVersion,
            onOpen: () => void developerTools.loadRemoteVersions(),
            onChoose: (version) => void developerTools.chooseVersion(version),
            onInstall: () => void developerTools.installChosen(),
          }}
          updates={{
            list: developerTools.updates,
            busy: developerTools.updateBusy,
            awaitingSwitch: developerTools.replacedRoot !== null,
            onCheck: () => void developerTools.checkUpdates(),
            onUpdate: (candidate) => void developerTools.updateTo(candidate),
          }}
          pathCleanup={{
            result: developerTools.cleanup,
            onPlan: () => void developerTools.planCleanup(),
          }}
          profiles={{
            list: developerTools.profiles,
            current: developerTools.currentPins,
            missing: developerTools.missing,
            busy: developerTools.profileBusy,
            onLoad: developerTools.loadProfiles,
            onCreate: (name, tools) => void developerTools.createProfile(name, tools),
            onDelete: (id) => void developerTools.deleteProfile(id),
            onApply: (profile) => void developerTools.planProfile(profile),
            onCheckMissing: (profile) => void developerTools.checkMissing(profile),
            onInstallMissing: (profile) => void developerTools.installMissingThenPlan(profile),
          }}
          uninstall={{
            plan: developerTools.uninstallPlan,
            outcome: developerTools.uninstallOutcome,
            busy: developerTools.uninstallBusy,
            defaultReplacement: developerTools.updatedRoot,
            onPlan: (root) => void developerTools.planUninstall(root),
            onConfirm: (replacement, repoint) => void developerTools.confirmUninstall(replacement, repoint),
            onOpenFolder: (path) => void developerTools.openFolder(path),
            onClose: developerTools.closeUninstall,
          }}
        />

        <AppModals
          dialog={dialog === "tools" ? null : dialog}
          setDialog={setDialog}
          staged={staged}
          stagedDiff={stagedDiff}
          stagedBusy={stagedBusy}
          stagedError={stagedError}
          stagedProgress={stagedProgress}
          stagedLog={stagedLog}
          onApplyStaged={handleApplyStaged}
          onDiscardAll={handleClearStaged}
          diffEntries={diffEntries}
          applyBusy={applyBusy}
          applyError={applyError}
          onDiffApply={handleDiffApply}
          onDiffDismiss={handleDiffDismiss}
          onStageImport={handleStageImport}
          effectiveVars={effectiveVars}
          elevated={elevated}
          personalScope={personalScope}
          personalScopeLabel={selectedAccount?.username}
          onNewVarStage={handleNewVarStage}
        />
      </div>
    </ThemeContext.Provider>
  );
}
