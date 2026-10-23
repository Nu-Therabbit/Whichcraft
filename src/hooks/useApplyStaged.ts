import type { RefObject } from "react";
import { useCallback, useState } from "react";
import type { EnvironmentApi } from "../features/environment/api";
import { validateEnvInput } from "../lib/envValidation";
import type { ApplyProgressEvent, EnvChange, EnvSnapshot } from "../types";
import { useI18n } from "./useI18n";
import type { StagedChange } from "./useStaged";

interface Params {
  environment: EnvironmentApi;
  staged: Map<string, StagedChange>;
  clearStaged: () => void;
  refresh: () => Promise<void>;
  refreshPathStatus: () => Promise<void>;
  baselineRef: RefObject<EnvSnapshot | null>;
}

export function useApplyStaged({
  environment,
  staged,
  clearStaged,
  refresh,
  refreshPathStatus,
  baselineRef,
}: Params) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number } | null>(null);
  const [log, setLog] = useState<ApplyProgressEvent[]>([]);

  const handleApplyStaged = useCallback(
    async (_takeSnapshot: boolean): Promise<boolean> => {
      setBusy(true);
      setError(null);
      setProgress(null);
      setLog([]);
      let unsubscribe: (() => void) | null = null;
      try {
        unsubscribe = await environment.onApplyProgress((event) => {
          setProgress({ index: event.index, total: event.total });
          setLog((prev) => [...prev, event]);
        });
      } catch (err) {
        console.error("Failed to subscribe to apply progress", err);
        setError(String(err));
        setBusy(false);
        return false;
      }
      try {
        const changes: EnvChange[] = Array.from(staged.values(), (change) =>
          change.kind === "delete"
            ? {
                changeType: "delete",
                name: change.name,
                scope: change.scope,
              }
            : {
                changeType: "set",
                name: change.name,
                value: change.newValue,
                valueKind: change.newValueKind,
                scope: change.scope,
              },
        );
        for (const change of changes) {
          const inputError = validateEnvInput(
            change.name,
            change.changeType === "set" ? change.value : undefined,
          );
          if (inputError)
            throw new Error(
              t("validation.variable_error", {
                name: change.name,
                error: t(`validation.${inputError}`),
              }),
            );
        }
        await environment.applyEnvChanges(changes);
        clearStaged();
        await refresh();
        try {
          baselineRef.current = await environment.getRegistrySnapshot();
        } catch {}
        await refreshPathStatus();
        return true;
      } catch (err) {
        console.error("Failed to apply staged changes", err);
        setError(String(err));
        return false;
      } finally {
        unsubscribe?.();
        setBusy(false);
      }
    },
    [environment, staged, clearStaged, refresh, refreshPathStatus, baselineRef, t],
  );

  return { handleApplyStaged, busy, error, progress, log };
}
