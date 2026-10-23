import { useCallback, useEffect, useMemo, useState } from "react";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import type { InvalidationScope } from "../../coordination/types";
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

function scopesNeedEnvironmentRefresh(scopes: InvalidationScope[]): boolean {
  return scopes.some(
    (scope) =>
      scope === "environment-variables" ||
      scope === "environment-diagnostics" ||
      scope === "environment-external-diff" ||
      scope === "account-context" ||
      scope.startsWith("tools-") ||
      scope === "shell-overview",
  );
}

export function useEnvironmentController(runtime: EnvironmentRuntime, platform: PlatformInitSlice) {
  const coordination = useWriteCoordinator();
  const { environment } = runtime;
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
    handleDiffApply: handleDiffApplyRaw,
    handleDiffDismiss,
    applyBusy,
    applyError,
  } = useDiff(environment, refresh);

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
    coordination.setEnvironmentPending(staged.size > 0);
  }, [coordination, staged.size]);

  useEffect(() => {
    return coordination.subscribeInvalidation((scopes) => {
      if (!scopesNeedEnvironmentRefresh(scopes)) return;
      void refresh();
      void checkForExternalChanges();
      void refreshPathStatus();
    });
  }, [coordination, refresh, checkForExternalChanges, refreshPathStatus]);

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
    async (takeSnapshot: boolean) => {
      const gate = coordination.tryBeginEnvironmentWrite("apply-staged");
      if (!gate.ok) {
        setStagedError(gate.reason);
        return false;
      }
      try {
        const ok = await applyStagedCore(takeSnapshot);
        coordination.endEnvironmentWrite(gate.admission, ok ? "success" : "failure");
        return ok;
      } catch (err) {
        coordination.endEnvironmentWrite(gate.admission, "failure");
        throw err;
      }
    },
    [applyStagedCore, coordination, setStagedError],
  );

  const handleDiffApply = useCallback(
    async (...args: Parameters<typeof handleDiffApplyRaw>) => {
      const gate = coordination.tryBeginEnvironmentWrite("apply-external-diff");
      if (!gate.ok) return false;
      try {
        const ok = await handleDiffApplyRaw(...args);
        coordination.endEnvironmentWrite(gate.admission, ok ? "success" : "failure");
        return ok;
      } catch (err) {
        coordination.endEnvironmentWrite(gate.admission, "failure");
        throw err;
      }
    },
    [coordination, handleDiffApplyRaw],
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
