import { useCallback, useRef, useState } from "react";
import type { WriteCoordinatorFacade } from "../coordination/createWriteCoordinator";
import type { EnvironmentApi } from "../features/environment/api";
import type { DiffEntry } from "../lib/diff";
import { applyAccepted, computeDiff, snapshotsEqual } from "../lib/diff";
import type { EnvSnapshot, VarScope } from "../types";

interface UseDiffResult {
  diffEntries: DiffEntry[];
  baselineRef: React.RefObject<EnvSnapshot | null>;
  checkForExternalChanges: () => Promise<void>;
  handleDiffApply: (accepted: DiffEntry[], reverted: DiffEntry[]) => Promise<boolean>;
  handleDiffDismiss: () => void;
  applyBusy: boolean;
  applyError: string | null;
  setApplyError: (message: string | null) => void;
}

export function useDiff(
  environment: EnvironmentApi,
  refresh: () => Promise<void>,
  onExternalDiffDetected?: () => void,
  coordination?: Pick<WriteCoordinatorFacade, "isWriteInProgress" | "beginRead" | "isReadCurrent">,
): UseDiffResult {
  const baselineRef = useRef<EnvSnapshot | null>(null);
  const lastInvalidatedSnapshot = useRef<EnvSnapshot | null>(null);
  const [diffEntries, setDiffEntries] = useState<DiffEntry[]>([]);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyErrorState] = useState<string | null>(null);

  const checkForExternalChanges = useCallback(async () => {
    if (!baselineRef.current || coordination?.isWriteInProgress()) return;
    const binding = coordination?.beginRead({ kind: "external-diff" });
    try {
      const current = await environment.getRegistrySnapshot();
      // UAC can return focus while Apply is still writing. Never invalidate its result
      // from partial state, or commit a read overtaken by a write/account/newer read.
      if (
        coordination && binding &&
        (coordination.isWriteInProgress() || !coordination.isReadCurrent(binding))
      ) return;
      const entries = snapshotsEqual(baselineRef.current, current)
        ? []
        : computeDiff(baselineRef.current, current);
      setDiffEntries(entries);
      // Read back each distinct external state, including restoration to baseline.
      // Re-reading the same state during invalidation must not start a refresh loop.
      const previous = lastInvalidatedSnapshot.current ?? baselineRef.current;
      if (!snapshotsEqual(previous, current)) {
        lastInvalidatedSnapshot.current = current;
        onExternalDiffDetected?.();
      }
    } catch {}
  }, [environment, onExternalDiffDetected, coordination]);

  const handleDiffApply = useCallback(
    async (accepted: DiffEntry[], reverted: DiffEntry[]) => {
      setApplyBusy(true);
      setApplyErrorState(null);
      try {
        for (const entry of reverted) {
          const scope = entry.scope as VarScope;
          if (entry.kind === "added") await environment.deleteEnvVar(entry.name, scope);
          else if (entry.kind === "removed" && entry.valueKind)
            await environment.setEnvVar(entry.name, entry.value, entry.valueKind, scope);
          else if (entry.kind === "changed" && entry.oldValueKind)
            await environment.setEnvVar(entry.name, entry.oldValue, entry.oldValueKind, scope);
        }
        if (baselineRef.current) baselineRef.current = applyAccepted(baselineRef.current, accepted);
        setDiffEntries([]);
        await refresh();
        return true;
      } catch (err) {
        console.error("Failed to apply diff", err);
        setApplyErrorState(String(err));
        return false;
      } finally {
        setApplyBusy(false);
      }
    },
    [environment, refresh],
  );

  const setApplyError = useCallback((message: string | null) => setApplyErrorState(message), []);

  const handleDiffDismiss = useCallback(() => {
    if (baselineRef.current) baselineRef.current = applyAccepted(baselineRef.current, diffEntries);
    setDiffEntries([]);
    setApplyErrorState(null);
  }, [diffEntries]);

  return {
    diffEntries,
    baselineRef,
    checkForExternalChanges,
    handleDiffApply,
    handleDiffDismiss,
    applyBusy,
    applyError,
    setApplyError,
  };
}
