import { useMemo, useState } from "react";
import { useUndo } from "../../contexts/UndoContext";
import { useAccountSwitch } from "../../hooks/useAccountSwitch";
import { useAppInit } from "../../hooks/useAppInit";
import { useApplyStaged } from "../../hooks/useApplyStaged";
import { useDiagnostics } from "../../hooks/useDiagnostics";
import { useDiff } from "../../hooks/useDiff";
import { useEnvVars } from "../../hooks/useEnvVars";
import { useLocalUndo } from "../../hooks/useLocalUndo";
import { usePathStatus } from "../../hooks/usePathStatus";
import { useStaged } from "../../hooks/useStaged";
import { useStagingHandlers } from "../../hooks/useStagingHandlers";
import type { PlatformApi } from "../../platform/api";
import type { EnvironmentRuntime } from "./runtime";

type PlatformInitSlice = Pick<PlatformApi, "isElevated">;

export function useEnvironmentController(runtime: EnvironmentRuntime, platform: PlatformInitSlice) {
  const { environment } = runtime;
  const { vars, loading, error, refresh } = useEnvVars(environment);
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
  } = usePathStatus(environment, staged, stageSet);

  const {
    diffEntries,
    baselineRef,
    checkForExternalChanges,
    handleDiffApply,
    handleDiffDismiss,
    applyBusy,
    applyError,
  } = useDiff(environment, refresh);

  const [elevated, setElevated] = useState(false);

  const accountRefresh = useMemo(
    () => async () => {
      await refresh();
      await checkForExternalChanges();
      await refreshPathStatus();
    },
    [refresh, checkForExternalChanges, refreshPathStatus],
  );

  const { accounts, selectedAccount, handleSelectAccount, accountSwitchError } = useAccountSwitch(
    environment,
    {
      elevated,
      hasStagedChanges: staged.size > 0,
      refresh: accountRefresh,
    },
  );

  const { handleRefresh, initializing } = useAppInit({
    environment,
    platform,
    baselineRef,
    setElevated,
    refreshPathStatus,
    refresh,
    checkForExternalChanges,
  });

  const diagnostics = useDiagnostics(vars, environment);

  const stagingHandlers = useStagingHandlers({
    staged,
    stageSet,
    stageDelete,
    stageImport,
    stageSnapshot,
    unstage,
    clearStaged,
    restoreStaged,
    push,
  });

  const {
    handleApplyStaged,
    busy: stagedBusy,
    error: stagedError,
    progress: stagedProgress,
    log: stagedLog,
  } = useApplyStaged({
    environment,
    staged,
    clearStaged,
    refresh,
    refreshPathStatus,
    baselineRef,
  });

  return {
    environment,
    vars,
    effectiveVars,
    loading,
    error,
    refresh,
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
    ...stagingHandlers,
    handleApplyStaged,
    stagedBusy,
    stagedError,
    stagedProgress,
    stagedLog,
    undo,
    redo,
    localUndoRef,
    handleRegisterLocalUndo,
  };
}
