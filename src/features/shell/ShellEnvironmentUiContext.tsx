import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppModals } from "../../components/AppModals/AppModals";
import { stagedToDiff } from "../../lib/stagedToDiff";
import type { EnvVar } from "../../types";
import { useEnvironment } from "../environment/EnvironmentContext";

export type ShellEnvironmentDialog =
  | "importexport"
  | "changes"
  | "staged"
  | "licenses"
  | "newvar"
  | "checkcommand"
  | null;

type ShellEnvironmentUiContextValue = {
  dialog: ShellEnvironmentDialog;
  setDialog: (dialog: ShellEnvironmentDialog) => void;
  selected: EnvVar | null;
  setSelected: (variable: EnvVar | null) => void;
};

const ShellEnvironmentUiContext = createContext<ShellEnvironmentUiContextValue | null>(null);

/** Shell-only UI state for environment modals; survives leaving the Environment page. */
export function ShellEnvironmentUiProvider({ children }: { children: ReactNode }) {
  const env = useEnvironment();
  const [dialog, setDialog] = useState<ShellEnvironmentDialog>(null);
  const [selected, setSelected] = useState<EnvVar | null>(null);

  const {
    staged,
    diffEntries,
    stagedBusy,
    stagedError,
    stagedProgress,
    stagedLog,
    handleApplyStaged,
    handleClearStaged,
    applyBusy,
    applyError,
    handleDiffApply,
    handleDiffDismiss,
    handleStageImport,
    handleNewVarStage,
    effectiveVars,
    elevated,
    selectedAccount,
  } = env;

  const personalScope = selectedAccount ? "OtherUser" : "User";
  const stagedDiff = useMemo(() => stagedToDiff(staged), [staged]);

  useEffect(() => {
    if (diffEntries.length > 0) setDialog("changes");
  }, [diffEntries.length]);

  useEffect(() => {
    if (stagedError || stagedBusy) setDialog("staged");
  }, [stagedBusy, stagedError]);

  const ui = useMemo(
    () => ({ dialog, setDialog, selected, setSelected }),
    [dialog, selected],
  );

  return (
    <ShellEnvironmentUiContext.Provider value={ui}>
      {children}
      <AppModals
        dialog={dialog}
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
        onStageImport={(sets, deletes) => {
          handleStageImport(sets, deletes);
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
    </ShellEnvironmentUiContext.Provider>
  );
}

export function useShellEnvironmentUi(): ShellEnvironmentUiContextValue {
  const ctx = useContext(ShellEnvironmentUiContext);
  if (!ctx) {
    throw new Error("useShellEnvironmentUi requires ShellEnvironmentUiProvider");
  }
  return ctx;
}
