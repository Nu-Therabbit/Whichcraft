import { useCallback, useState } from "react";
import { api } from "../api";
import type {
  ApplyToolResult,
  ToolApplyPlan,
  ToolInstallationView,
  ToolKind,
  UndoResult,
} from "../types";

export function useDeveloperTools(initialTool: ToolKind = "java") {
  const [tool, setTool] = useState<ToolKind>(initialTool);
  const [installations, setInstallations] = useState<ToolInstallationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ToolApplyPlan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [undoResult, setUndoResult] = useState<UndoResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInstallations(await api.listToolInstallations(tool));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [tool]);

  const buildPlan = useCallback(
    async (root: string) => {
      setPlanBusy(true);
      setError(null);
      setPlan(null);
      try {
        if (tool === "java") {
          const javaPlan = await api.planJavaApply(root);
          setPlan({
            ...javaPlan,
            tool: "java",
            selected: { ...javaPlan.selected, tool: "java" },
          });
        } else {
          setPlan(await api.planToolApply(tool, root));
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setPlanBusy(false);
      }
    },
    [tool],
  );

  const applyPlan = useCallback(async () => {
    if (!plan) return null;
    setApplyBusy(true);
    setError(null);
    try {
      let result: ApplyToolResult;
      if (plan.requiresUac) {
        result = await api.applyToolPlanWithUac(plan);
      } else if (tool === "java") {
        const javaResult = await api.applyJavaPlan(plan);
        result = { ...javaResult, needsElevation: false };
      } else {
        result = await api.applyToolPlan(plan);
      }
      if (result.stale) {
        setError("Environment changed since the plan was created. Refresh and try again.");
        await buildPlan(plan.selected.root);
        return result;
      }
      if (result.needsElevation) {
        setError("This plan requires UAC approval for System PATH changes.");
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
  }, [plan, tool, refresh, buildPlan]);

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
    tool,
    setTool,
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
