import { useMemo } from "react";
import { AppLoading } from "../../components/AppLoading/AppLoading";
import { CheckCommandPanel } from "../../components/CheckCommandPanel/CheckCommandPanel";
import { DetailPanel } from "../../components/DetailPanel/DetailPanel";
import { DiagnosticsPanel } from "../../components/DiagnosticsPanel/DiagnosticsPanel";
import { ImportExportPanel } from "../../components/ImportExportPanel/ImportExportPanel";
import { PathBanner } from "../../components/PathBanner/PathBanner";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SnapshotPanel } from "../../components/SnapshotPanel/SnapshotPanel";
import { useI18n } from "../../hooks/useI18n";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import type { DiagnosticAction, EnvironmentDiagnostic } from "../../lib/environmentDiagnostics";
import type { ShellEnvironmentTab } from "../../lib/shellNavigation";
import type { EnvVar, VarScope } from "../../types";
import { useEnvironment } from "../environment/EnvironmentContext";
import { ShellEnvironmentToolbar } from "./ShellEnvironmentToolbar";
import { useShellEnvironmentUi } from "./ShellEnvironmentUiContext";

const TAB_IDS: { id: ShellEnvironmentTab; labelKey: string }[] = [
  { id: "variables", labelKey: "desktop_shell.env_tab_variables" },
  { id: "snapshots", labelKey: "desktop_shell.env_tab_snapshots" },
  { id: "import-export", labelKey: "desktop_shell.env_tab_import_export" },
  { id: "check-command", labelKey: "desktop_shell.env_tab_check_command" },
];

interface Props {
  envTab: ShellEnvironmentTab;
  onEnvTab: (tab: ShellEnvironmentTab) => void;
}

export function ShellEnvironmentWorkspace({ envTab, onEnvTab }: Props) {
  const env = useEnvironment();
  const { setDialog, selected, setSelected } = useShellEnvironmentUi();
  const { t } = useI18n();

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
    initializing,
    accounts,
    selectedAccount,
    handleSelectAccount,
    accountSwitchError,
    handleRefresh,
    handleStage,
    handleStageDelete,
    handleUnstage,
    handleStageImport,
    handleStageSnapshot,
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

  useKeyboardShortcuts(undo, redo, localUndoRef);

  const effectiveSelected = useMemo<EnvVar | null>(() => {
    if (!selected) return null;
    return (
      effectiveVars.find((v) => v.name === selected.name && v.scope === selected.scope) ?? null
    );
  }, [selected, effectiveVars]);

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
    return <AppLoading />;
  }

  const tabPanelId = (tab: ShellEnvironmentTab) => `shell-env-panel-${tab}`;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ShellEnvironmentToolbar
        loading={loading}
        stagedCount={staged.size}
        diffCount={diffEntries.length}
        elevated={elevated}
        accounts={accounts}
        selectedAccount={selectedAccount}
        accountSwitchDisabled={staged.size > 0}
        onRefresh={handleRefresh}
        onApplyStaged={() => setDialog("staged")}
        onShowChanges={() => setDialog("changes")}
        onSelectAccount={handleSelectAccount}
      />

      <div
        className="flex gap-1 px-4 pt-3 border-b border-rim-subtle shrink-0"
        role="tablist"
        aria-label={t("desktop_shell.env_tabs_label")}
      >
        {TAB_IDS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`shell-env-tab-${id}`}
            aria-selected={envTab === id}
            aria-controls={tabPanelId(id)}
            className={`px-3 py-2 text-sm rounded-t border border-b-0 ${
              envTab === id
                ? "border-rim-subtle bg-panel font-medium"
                : "border-transparent text-muted hover:text-fg"
            }`}
            onClick={() => onEnvTab(id)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {pathBannerScope && !pathBannerDismissed && envTab === "variables" && (
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

      {envTab === "variables" && (
        <DiagnosticsPanel
          diagnostics={diagnostics}
          elevated={elevated}
          onStageAction={handleDiagnosticAction}
        />
      )}

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

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {envTab === "variables" && (
          <div
            id={tabPanelId("variables")}
            role="tabpanel"
            aria-labelledby="shell-env-tab-variables"
            className="flex flex-1 min-h-0"
          >
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
          </div>
        )}

        {envTab === "snapshots" && (
          <div
            id={tabPanelId("snapshots")}
            role="tabpanel"
            aria-labelledby="shell-env-tab-snapshots"
            className="flex-1 overflow-y-auto p-4"
          >
            <SnapshotPanel
              pendingStagedCount={staged.size}
              onStageSnapshot={(snap, options) => {
                handleStageSnapshot(snap, options);
              }}
            />
          </div>
        )}

        {envTab === "import-export" && (
          <div
            id={tabPanelId("import-export")}
            role="tabpanel"
            aria-labelledby="shell-env-tab-import-export"
            className="flex-1 overflow-y-auto p-4"
          >
            <ImportExportPanel
              pendingStagedCount={staged.size}
              onStage={(sets, deletes, options) => {
                handleStageImport(sets, deletes, options);
              }}
            />
          </div>
        )}

        {envTab === "check-command" && (
          <div
            id={tabPanelId("check-command")}
            role="tabpanel"
            aria-labelledby="shell-env-tab-check-command"
            className="flex-1 overflow-y-auto p-4"
          >
            <CheckCommandPanel />
          </div>
        )}
      </div>
    </div>
  );
}
