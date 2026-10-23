import { useCallback, useMemo, useState } from "react";
import type { EnvSnapshot, EnvValueKind, EnvValueKindSelection, EnvVar, VarScope } from "../types";
import type { StagedChange, StagedKey } from "./stagingLogic";
import {
  computeEffectiveVars,
  computeStageDelete,
  computeStageImport,
  computeStageSet,
  computeStageSnapshot,
  stagedKey,
} from "./stagingLogic";

export type { StagedChange, StagedKind } from "./stagingLogic";
export { stagedKey } from "./stagingLogic";

export function useStaged(registryVars: EnvVar[], onPendingChange?: (pending: boolean) => void) {
  const [staged, setStaged] = useState<Map<StagedKey, StagedChange>>(new Map());

  const publishPending = useCallback(
    (next: Map<StagedKey, StagedChange>) => {
      onPendingChange?.(next.size > 0);
      return next;
    },
    [onPendingChange],
  );

  const registryByKey = useMemo(
    () => new Map(registryVars.map((v) => [stagedKey(v.name, v.scope), v])),
    [registryVars],
  );

  /** Stage a value change for a single variable. */
  const stageSet = useCallback(
    (
      name: string,
      scope: VarScope,
      newValue: string,
      valueKindSelection: EnvValueKindSelection = "Auto",
    ) => {
      setStaged((prev) =>
        publishPending(computeStageSet(registryByKey, prev, name, scope, newValue, valueKindSelection)),
      );
    },
    [registryByKey, publishPending],
  );

  /** Stage a deletion for a single variable. */
  const stageDelete = useCallback(
    (name: string, scope: VarScope) => {
      setStaged((prev) => publishPending(computeStageDelete(registryByKey, prev, name, scope)));
    },
    [registryByKey, publishPending],
  );

  /** Stage a batch of changes from Import (with optional deletions for Replace strategy). */
  const stageImport = useCallback(
    (
      sets: Array<{
        name: string;
        scope: VarScope;
        value: string;
        valueKind: EnvValueKind | null;
      }>,
      deletes: Array<{ name: string; scope: VarScope }> = [],
      options?: { replacePendingStaged?: boolean },
    ) => {
      setStaged((prev) =>
        publishPending(
          computeStageImport(
            registryByKey,
            prev,
            sets,
            deletes,
            options?.replacePendingStaged ?? false,
          ),
        ),
      );
    },
    [registryByKey, publishPending],
  );

  /** Stage all changes needed to make the registry match a snapshot. */
  const stageSnapshot = useCallback(
    (snap: EnvSnapshot, options?: { replacePendingStaged?: boolean }) => {
      setStaged((prev) =>
        publishPending(
          computeStageSnapshot(
            registryByKey,
            registryVars,
            prev,
            snap,
            options?.replacePendingStaged ?? false,
          ),
        ),
      );
    },
    [registryByKey, registryVars, publishPending],
  );

  /** Remove a single staged change (revert to registry state). */
  const unstage = useCallback((name: string, scope: VarScope) => {
    const k = stagedKey(name, scope);
    setStaged((prev) => {
      const next = new Map(prev);
      next.delete(k);
      return publishPending(next);
    });
  }, [publishPending]);

  /** Clear all staged changes. */
  const clearStaged = useCallback(() => setStaged(() => publishPending(new Map())), [publishPending]);

  /** Restore staged map to a previously captured snapshot (used for undo). */
  const restoreStaged = useCallback(
    (map: Map<string, StagedChange>) => {
      setStaged(() => publishPending(new Map(map)));
    },
    [publishPending],
  );

  const effectiveVars = useMemo(
    () => computeEffectiveVars(registryVars, staged),
    [registryVars, staged],
  );

  return {
    staged,
    effectiveVars,
    stageSet,
    stageDelete,
    stageImport,
    stageSnapshot,
    unstage,
    clearStaged,
    restoreStaged,
  };
}
