import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type {
  AndroidInventory,
  ApplyToolResult,
  MiseStatus,
  MsvcInventory,
  PythonSupplementalView,
  RecoveryView,
  RemoteVersion,
  ShellCheck,
  ToolApplyPlan,
  ToolInstallationView,
  ToolKind,
  UndoResult,
  UninstallOutcome,
  UninstallPlan,
  UpdateCandidate,
  WhichcraftSettings,
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
  const [recovery, setRecovery] = useState<RecoveryView | null>(null);
  const [settings, setSettings] = useState<WhichcraftSettings | null>(null);
  const [pythonInfo, setPythonInfo] = useState<PythonSupplementalView | null>(null);
  const [android, setAndroid] = useState<AndroidInventory | null>(null);
  const [msvc, setMsvc] = useState<MsvcInventory | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecovery(await api.getRecoveryStatus());
      setSettings(await api.getWhichcraftSettings());
      setInstallations(await api.listToolInstallations(tool));
      setPythonInfo(tool === "python" ? await api.getPythonLauncherInfo() : null);
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

  const finishRecovery = useCallback(
    async (action: "resume" | "rollBack") => {
      if (!recovery) return;
      setApplyBusy(true);
      setError(null);
      try {
        if (action === "resume") {
          await api.resumeApply(recovery.journalId);
        } else {
          setUndoResult(await api.rollBackApply(recovery.journalId));
        }
        await refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setApplyBusy(false);
      }
    },
    [recovery, refresh],
  );

  const saveSettings = useCallback(
    async (next: WhichcraftSettings) => {
      setError(null);
      try {
        await api.saveWhichcraftSettings(next);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const [shellCheck, setShellCheck] = useState<ShellCheck | null>(null);

  const runShellCheck = useCallback(async () => {
    setError(null);
    setShellCheck(null);
    try {
      setShellCheck(await api.shellCheck(tool));
    } catch (e) {
      setError(String(e));
    }
  }, [tool]);

  const openTerminal = useCallback(async () => {
    setError(null);
    try {
      await api.openTerminal();
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const [remoteVersions, setRemoteVersions] = useState<RemoteVersion[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [miseStatus, setMiseStatus] = useState<MiseStatus | null>(null);
  const [chosenVersion, setChosenVersion] = useState<{ version: string; downloadBytes: number | null } | null>(
    null,
  );
  const [installBusy, setInstallBusy] = useState(false);

  const loadRemoteVersions = useCallback(async () => {
    setError(null);
    setRemoteLoading(true);
    setChosenVersion(null);
    try {
      setMiseStatus(await api.getMiseStatus());
      setRemoteVersions(await api.listRemoteVersions(tool));
    } catch (e) {
      setError(String(e));
    } finally {
      setRemoteLoading(false);
    }
  }, [tool]);

  const chooseVersion = useCallback(
    async (version: string) => {
      setChosenVersion({ version, downloadBytes: null });
      try {
        setChosenVersion({ version, downloadBytes: await api.downloadSize(tool, version) });
      } catch {
        // The size is informative only; installing still works without it.
      }
    },
    [tool],
  );

  const installChosen = useCallback(async () => {
    if (!chosenVersion) return;
    setInstallBusy(true);
    setError(null);
    try {
      await api.installManaged(tool, chosenVersion.version);
      setChosenVersion(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstallBusy(false);
    }
  }, [tool, chosenVersion, refresh]);

  const [uninstallPlan, setUninstallPlan] = useState<UninstallPlan | null>(null);
  const [uninstallOutcome, setUninstallOutcome] = useState<UninstallOutcome | null>(null);
  const [uninstallBusy, setUninstallBusy] = useState(false);

  const planUninstall = useCallback(
    async (root: string) => {
      setError(null);
      setUninstallOutcome(null);
      setUninstallPlan(null);
      setUninstallBusy(true);
      try {
        setUninstallPlan(await api.planUninstall(tool, root));
      } catch (e) {
        setError(String(e));
      } finally {
        setUninstallBusy(false);
      }
    },
    [tool],
  );

  /** Switches to `replacementRoot` first when the installation is selected or effective (Q9). */
  const confirmUninstall = useCallback(
    async (replacementRoot: string | null) => {
      if (!uninstallPlan) return;
      setError(null);
      setUninstallBusy(true);
      try {
        const replacement = replacementRoot ? await api.planToolApply(tool, replacementRoot) : null;
        const outcome = await api.uninstall(tool, uninstallPlan.installation.root, replacement);
        setUninstallOutcome(outcome);
        if (outcome.status === "removed") setUninstallPlan(null);
        await refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setUninstallBusy(false);
      }
    },
    [tool, uninstallPlan, refresh],
  );

  const openFolder = useCallback(async (path: string) => {
    try {
      await api.openFolder(path);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const [updates, setUpdates] = useState<UpdateCandidate[] | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  /** The installation an update replaces; offered for uninstall once the switch is applied. */
  const [replacedRoot, setReplacedRoot] = useState<string | null>(null);

  const checkUpdates = useCallback(async () => {
    setError(null);
    setUpdateBusy(true);
    try {
      setUpdates(await api.updateCandidates(tool));
    } catch (e) {
      setError(String(e));
    } finally {
      setUpdateBusy(false);
    }
  }, [tool]);

  const updateTo = useCallback(
    async (candidate: UpdateCandidate) => {
      setError(null);
      setUpdateBusy(true);
      try {
        const result = await api.updateInstallation(tool, candidate.latest);
        setUpdates((list) => list?.filter((u) => u.root !== candidate.root) ?? null);
        setReplacedRoot(candidate.root);
        setPlan(result.plan);
        await refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setUpdateBusy(false);
      }
    },
    [tool, refresh],
  );

  /** Applies the plan; after an update's switch, goes on to offer uninstalling the old one. */
  const applyPlanThenOffer = useCallback(async () => {
    const result = await applyPlan();
    if (result && !result.stale && !result.needsElevation && replacedRoot) {
      const old = replacedRoot;
      setReplacedRoot(null);
      await planUninstall(old);
    }
    return result;
  }, [applyPlan, replacedRoot, planUninstall]);

  // The list belongs to the tool it was checked for.
  // biome-ignore lint/correctness/useExhaustiveDependencies: clearing is the point when the tool changes
  useEffect(() => {
    setUpdates(null);
  }, [tool]);

  // A newly pinned mise is fetched in the background after an app update (ticket 17).
  useEffect(() => {
    api.prepareMise().catch(() => {
      // Offline: the old mise keeps working for uninstall and listing; installing retries the download.
    });
  }, []);

  const loadSdks = useCallback(async () => {
    setError(null);
    try {
      setAndroid(await api.getAndroidInventory());
      setMsvc(await api.getMsvcInventory());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return {
    tool,
    settings,
    saveSettings,
    pythonInfo,
    android,
    msvc,
    loadSdks,
    remoteVersions,
    remoteLoading,
    miseStatus,
    chosenVersion,
    installBusy,
    loadRemoteVersions,
    chooseVersion,
    installChosen,
    uninstallPlan,
    uninstallOutcome,
    uninstallBusy,
    planUninstall,
    confirmUninstall,
    openFolder,
    closeUninstall: () => {
      setUninstallPlan(null);
      setUninstallOutcome(null);
    },
    shellCheck,
    runShellCheck,
    openTerminal,
    setTool,
    installations,
    loading,
    error,
    plan,
    planBusy,
    applyBusy,
    undoResult,
    recovery,
    resumeRecovery: () => finishRecovery("resume"),
    rollBackRecovery: () => finishRecovery("rollBack"),
    refresh,
    buildPlan,
    applyPlan: applyPlanThenOffer,
    updates,
    updateBusy,
    replacedRoot,
    checkUpdates,
    updateTo,
    undoLast,
    clearPlan: () => {
      setPlan(null);
      setReplacedRoot(null);
    },
    clearUndoResult: () => setUndoResult(null),
  };
}
