import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../components/AppHeader/AppHeader";
import { AppLoading } from "../../components/AppLoading/AppLoading";
import { AppModals } from "../../components/AppModals/AppModals";
import { DetailPanel } from "../../components/DetailPanel/DetailPanel";
import { DiagnosticsPanel } from "../../components/DiagnosticsPanel/DiagnosticsPanel";
import { PathBanner } from "../../components/PathBanner/PathBanner";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SnapshotPanelDock } from "../../components/SnapshotPanel/SnapshotPanelDock";
import { ToolsPanel } from "../../components/ToolsPanel/ToolsPanel";
import { ThemeContext } from "../../context/ThemeContext";
import { useEnvironment } from "./EnvironmentContext";
import { useI18n } from "../../hooks/useI18n";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useTheme } from "../../hooks/useTheme";
import { useUpdateCheck } from "../../hooks/useUpdateCheck";
import { useAppServices } from "../../composition/AppServicesContext";
import type { DiagnosticAction, EnvironmentDiagnostic } from "../../lib/environmentDiagnostics";
import { stagedToDiff } from "../../lib/stagedToDiff";
import type { EnvVar, VarScope } from "./types";
import type { ToolsDispatch } from "../tools/useToolsStore";
import type { ToolsState } from "../tools/model";

type Dialog =
  | "importexport"
  | "changes"
  | "staged"
  | "licenses"
  | "newvar"
  | "checkcommand"
  | "tools"
  | null;

interface LegacyEnvironmentViewProps {
  tools: ToolsState;
  sendTools: ToolsDispatch;
}

export function LegacyEnvironmentView({ tools, sendTools }: LegacyEnvironmentViewProps) {
  const env = useEnvironment();
  const { t } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const [selected, setSelected] = useState<EnvVar | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);

  const {
    vars,
    effectiveVars,
    loading,
    error,
    staged,
    elevated,
    diagnostics,
    userPathInEnv,
    systemPathInEnv,
    otherUserPathInEnv,
    pathBannerDismissed,
    handleStageAddToPath,
    handleDismissPathBanner,
    diffEntries,
    handleDiffApply,
    handleDiffDismiss,
    applyBusy,
    applyError,
    handleRefresh,
    initializing,
    accounts,
    selectedAccount,
    handleSelectAccount,
    accountSwitchError,
    handleStage,
    handleStageDelete,
    handleUnstage,
    handleClearStaged,
    handleStageImport,
    handleStageSnapshot,
    handleNewVarStage,
    handleApplyStaged,
    stagedBusy,
    stagedError,
    stagedProgress,
    stagedLog,
    undo,
    redo,
    localUndoRef,
    handleRegisterLocalUndo,
  } = env;

  const personalScope = selectedAccount ? "OtherUser" : "User";

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

  useEffect(() => {
    if (diffEntries.length > 0) setDialog("changes");
  }, [diffEntries.length]);

  useKeyboardShortcuts(undo, redo, localUndoRef);

  const { platform } = useAppServices();
  const updateInfo = useUpdateCheck(platform);

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
            pendingStagedCount={staged.size}
            onStageSnapshot={(snap, options) => {
              handleStageSnapshot(snap, options);
              setSnapshotsOpen(false);
            }}
          />
        </main>

        <ToolsPanel
          open={dialog === "tools"}
          onClose={() => {
            setDialog(null);
            sendTools({ type: "clearPlan" });
          }}
          state={tools}
          dispatch={sendTools}
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
          onApplyStaged={async (takeSnapshot) => {
            const ok = await handleApplyStaged(takeSnapshot);
            if (ok) setDialog(null);
          }}
          onDiscardAll={handleClearStaged}
          diffEntries={diffEntries}
          applyBusy={applyBusy}
          applyError={applyError}
          onDiffApply={async (accepted, reverted) => {
            const ok = await handleDiffApply(accepted, reverted);
            if (ok) setDialog(null);
          }}
          onDiffDismiss={() => {
            handleDiffDismiss();
            setDialog(null);
          }}
          onStageImport={(sets, deletes, options) => {
            handleStageImport(sets, deletes, options);
            setDialog(null);
          }}
          effectiveVars={effectiveVars}
          elevated={elevated}
          personalScope={personalScope}
          personalScopeLabel={selectedAccount?.username}
          onNewVarStage={(name, scope, value, valueKind) => {
            const created = handleNewVarStage(name, scope, value, valueKind);
            setSelected(created);
            setDialog(null);
          }}
        />
      </div>
    </ThemeContext.Provider>
  );
}
