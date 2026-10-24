import { useCallback, useEffect, useMemo, useState } from "react";
import { runEnvironmentWrite } from "../../coordination/createWriteCoordinator";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import { scopesNeedEnvironmentRefresh } from "../../coordination/scopeGroups";
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
import { EXTERNAL_DIFF_CROSS_INVALIDATION_SCOPES } from "./externalDiffInvalidation";
import type { EnvironmentApi } from "./api";

type PlatformInitSlice = Pick<PlatformApi, "isElevated">;

export function useEnvironmentController(environment: EnvironmentApi, platform: PlatformInitSlice) {
  const coordination = useWriteCoordinator();
  const { vars, loading, error, refresh } = useEnvVars(environment, coordination);
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
  } = useStaged(vars, coordination.setEnvironmentPending);

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
    handleDiffApply: handleDiffApplyRaw,
    handleDiffDismiss,
    applyBusy,
    applyError,
    setApplyError: setDiffApplyError,
  } = useDiff(environment, refresh, () => {
    // Cross-feature readback only once per external-diff episode; omit environment-external-diff
    // so invalidation subscribers do not re-enter detection and loop revisions.
    coordination.invalidate([...EXTERNAL_DIFF_CROSS_INVALIDATION_SCOPES]);
  });

  const [elevated, setElevated] = useState(false);

  const accountRefresh = useMemo(
    () => async () => {
      try {
        const selected = await environment.getSelectedAccount();
        coordination.notifyAccountContextChanged(selected?.sid ?? null);
      } catch {
        coordination.notifyAccountContextChanged(null);
      }
      await refresh();
      await checkForExternalChanges();
      await refreshPathStatus();
    },
    [coordination, environment, refresh, checkForExternalChanges, refreshPathStatus],
  );

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (!scopesNeedEnvironmentRefresh(scopes)) return;
      void refresh();
      void refreshPathStatus();
    });
  }, [coordination, refresh, refreshPathStatus]);

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
    handleApplyStaged: applyStagedCore,
    busy: stagedBusy,
    error: stagedError,
    progress: stagedProgress,
    log: stagedLog,
    setError: setStagedError,
  } = useApplyStaged({
    environment,
    staged,
    clearStaged,
    refresh,
    refreshPathStatus,
    baselineRef,
  });

  const handleApplyStaged = useCallback(
    (takeSnapshot: boolean) =>
      runEnvironmentWrite(coordination, "apply-staged", setStagedError, () =>
        applyStagedCore(takeSnapshot),
      ),
    [applyStagedCore, coordination, setStagedError],
  );

  const handleDiffApply = useCallback(
    (...args: Parameters<typeof handleDiffApplyRaw>) =>
      runEnvironmentWrite(coordination, "apply-external-diff", setDiffApplyError, () =>
        handleDiffApplyRaw(...args),
      ),
    [coordination, handleDiffApplyRaw, setDiffApplyError],
  );

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
