import { useCallback, useState } from "react";
import { api } from "../api";
import type { ApplyJavaResult, JavaApplyPlan, JavaInstallationView, UndoResult } from "../types";

export function useJavaTools() {
  const [installations, setInstallations] = useState<JavaInstallationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<JavaApplyPlan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [undoResult, setUndoResult] = useState<UndoResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInstallations(await api.listJavaInstallations());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const buildPlan = useCallback(async (root: string) => {
    setPlanBusy(true);
    setError(null);
    setPlan(null);
    try {
      setPlan(await api.planJavaApply(root));
    } catch (e) {
      setError(String(e));
    } finally {
      setPlanBusy(false);
    }
  }, []);

  const applyPlan = useCallback(async () => {
    if (!plan) return null;
    setApplyBusy(true);
    setError(null);
    try {
      const result: ApplyJavaResult = await api.applyJavaPlan(plan);
      if (result.stale) {
        setError("Environment changed since the plan was created. Refresh and try again.");
        await buildPlan(plan.selected.root);
        return result;
      }
      setPlan(null);
      await refresh();
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setApplyBusy(false);
    }
  }, [plan, refresh, buildPlan]);

  const undoLast = useCallback(async () => {
    setApplyBusy(true);
    setError(null);
    try {
      const result = await api.undoLastWhichcraftApply();
      setUndoResult(result);
      await refresh();
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setApplyBusy(false);
    }
  }, [refresh]);

  return {
    installations,
    loading,
    error,
    plan,
    planBusy,
    applyBusy,
    undoResult,
    refresh,
    buildPlan,
    applyPlan,
    undoLast,
    clearPlan: () => setPlan(null),
    clearUndoResult: () => setUndoResult(null),
  };
}
