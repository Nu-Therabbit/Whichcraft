import { isIntent, type Operation, type ToolsMsg } from "./messages";
import { isSingleToolPlan, type ToolsState } from "./model";
import {
  isSwitchPlannedEvent,
  isUninstallPlannedEvent,
  reduceSwitchPlanned,
  reduceUninstallPlanned,
} from "./uninstallPlanEvents";

const STALE = "Environment changed since the plan was created. Refresh and try again.";
const NEEDS_UAC = "This plan requires UAC approval for System PATH changes.";

export function isApplyPlanOutcomeError(error: string | null): boolean {
  return error === STALE || error === NEEDS_UAC;
}

/** The only place the panel's state changes. Pure: no API calls, no time, no randomness. */
export function reduce(s: ToolsState, msg: ToolsMsg): ToolsState {
  if (isUninstallPlannedEvent(msg)) return reduceUninstallPlanned(s, msg);
  if (isSwitchPlannedEvent(msg)) return reduceSwitchPlanned(s, msg);
  // A slow result for the tool the panel has since left must not land on the new one.
  if (!isIntent(msg) && msg.type === "planBuilt" && msg.tool !== s.tool) {
    if (msg.source === "profile" || !isSingleToolPlan(msg.plan)) {
      return {
        ...s,
        plan: { ...s.plan, current: msg.plan, building: false, source: msg.source ?? s.plan.source },
      };
    }
    return { ...s, plan: { ...s.plan, building: false } };
  }
  if (!isIntent(msg) && "tool" in msg && msg.type !== "toolMutationDropped" && msg.tool !== s.tool)
    return s;
  switch (msg.type) {
    // --- inventory ---
    case "started":
      return s;
    case "selectTool": {
      const leaving = s.tool;
      const sameTool = leaving === msg.tool;
      // A write still running, and profile or PATH cleanup plans (not owned by the tool being
      // left), outlive the switch; the effect drops a late result for the old tool itself.
      const current = s.plan.current;
      const keepPlan =
        s.plan.applying ||
        (current !== null &&
          (s.plan.source === "profile" || s.plan.source === "cleanup" || !isSingleToolPlan(current)));
      return {
        ...s,
        tool: msg.tool,
        loading: true,
        installations: [],
        install: sameTool
          ? s.install
          : { ...s.install, catalogTool: null, catalogError: null, versions: [], chosen: null, loading: false, miseStatus: null, retainErrorOnRefresh: false },
        update: {
          ...s.update,
          list: null,
          busy: false,
          pending: sameTool ? s.update.pending : null,
        },
        plan:
          sameTool || keepPlan
            ? s.plan
            : { ...s.plan, current: null, cleanup: null, source: null, building: false },
        uninstall:
          sameTool || s.uninstall.busy
            ? s.uninstall
          : {
              ...s.uninstall,
              plan: null,
              outcome: null,
              defaultReplacement: null,
              switchPlan: null,
              busy: false,
            },
      };
    }
    case "refresh":
      return { ...s, loading: true };
    case "refreshed":
      return {
        ...s,
        loading: false,
        reads: s.reads + 1,
        error:
          s.loading && !isApplyPlanOutcomeError(s.error) && !s.install.retainErrorOnRefresh
            ? null
            : s.error,
        installations: msg.installations,
        recovery: msg.recovery,
        unfinished: msg.unfinished,
        settings: msg.settings,
        pythonInfo: msg.pythonInfo,
        install: { ...s.install, retainErrorOnRefresh: false },
      };

    // --- plan, apply, undo, recovery ---
    // Building any other plan abandons an update's switch, so applying it must not go on to
    // repoint profiles or offer removing the old version.
    case "buildPlan":
    case "planProfile":
      return {
        ...s,
        error: msg.type === "buildPlan" && msg.keepPending ? s.error : null,
        plan: { ...s.plan, current: null, source: null, building: true },
        update: { ...s.update, pending: msg.type === "buildPlan" && msg.keepPending ? s.update.pending : null },
      };
    case "planBuilt":
      return {
        ...s,
        plan: {
          ...s.plan,
          current: msg.plan,
          building: false,
          source: msg.source ?? s.plan.source,
        },
      };
    case "toolMutationDropped": {
      // The write kept running after the panel moved to another tool; once it ends, the
      // left tool's own plan has nothing more to show.
      const current = s.plan.current;
      const leftPlan =
        msg.tool !== s.tool && current?.tool === msg.tool && s.plan.source !== "profile" && s.plan.source !== "cleanup";
      return {
        ...s,
        plan: leftPlan
          ? { ...s.plan, applying: false, current: null, source: null, cleanup: null }
          : { ...s.plan, applying: false },
        uninstall: { ...s.uninstall, busy: false },
      };
    }
    case "planCleanup":
      return {
        ...s,
        error: null,
        plan: { ...s.plan, current: null, source: null, building: true, cleanup: null },
        update: { ...s.update, pending: null },
      };
    case "cleanupPlanned":
      return {
        ...s,
        plan: {
          ...s.plan,
          current: msg.plan,
          building: false,
          source: "cleanup",
          cleanup: { duplicates: msg.duplicates, missing: msg.missing },
        },
      };
    case "applyPlan":
      return s.plan.current ? { ...s, error: null, plan: { ...s.plan, applying: true } } : s;
    case "applyFinished": {
      const plan = { ...s.plan, applying: false };
      if (msg.result.stale) {
        // A single-tool plan is rebuilt right away (buildPlan clears it); others are dropped.
        const keep = s.plan.current && isSingleToolPlan(s.plan.current);
        return { ...s, error: STALE, plan: keep ? plan : { ...plan, current: null } };
      }
      if (msg.result.needsElevation) return { ...s, error: NEEDS_UAC, plan };
      return { ...s, plan: { ...plan, current: null, source: null, cleanup: null } };
    }
    case "clearPlan":
      return {
        ...s,
        plan: { ...s.plan, current: null, source: null, cleanup: null },
        update: { ...s.update, pending: null },
      };
    case "undoLast":
    case "resolveRecovery":
      return { ...s, error: null, plan: { ...s.plan, applying: true } };
    case "undone":
      return { ...s, plan: { ...s.plan, applying: false, undoResult: msg.result } };
    case "recoveryResolved":
      return { ...s, plan: { ...s.plan, applying: false, undoResult: msg.result ?? s.plan.undoResult } };
    case "clearUndoResult":
      return { ...s, plan: { ...s.plan, undoResult: null } };

    // --- settings, shell, terminal, SDKs ---
    case "saveSettings":
    case "openTerminal":
    case "loadSdks":
    case "dismissUnfinished":
    case "loadProfiles":
      return {
        ...s,
        error:
          isApplyPlanOutcomeError(s.error) || s.install.retainErrorOnRefresh ? s.error : null,
      };
    case "createProfile":
    case "deleteProfile":
      return { ...s, error: null };
    case "checkShell":
      return { ...s, error: null, shellCheck: null };
    case "clearShellCheck":
      return { ...s, shellCheck: null };
    case "shellChecked":
      return { ...s, shellCheck: msg.check };
    case "sdksLoaded":
      return { ...s, sdks: { android: msg.android, msvc: msg.msvc } };

    // --- install ---
    case "openInstallList":
      return { ...s, error: null, install: { ...s.install, catalogTool: s.tool, catalogError: null, versions: [], loading: true, chosen: null } };
    case "versionsLoaded":
      return { ...s, install: { ...s.install, loading: false, miseStatus: msg.miseStatus, versions: msg.versions } };
    case "chooseVersion":
      return { ...s, install: { ...s.install, chosen: { version: msg.version, downloadBytes: null } } };
    case "versionSized":
      // A size that arrives after another version was picked is dropped.
      return s.install.chosen?.version === msg.chosen.version ? { ...s, install: { ...s.install, chosen: msg.chosen } } : s;
    case "install":
      return s.install.chosen ? { ...s, error: null, install: { ...s.install, busy: true } } : s;
    case "installed":
      return {
        ...s,
        install: { ...s.install, busy: false, chosen: null, retainErrorOnRefresh: false },
      };

    // --- update ---
    case "checkUpdates":
    case "update":
      return { ...s, error: null, update: { ...s.update, busy: true } };
    case "updatesChecked":
      return { ...s, update: { ...s.update, busy: false, list: msg.list } };
    case "updateInstalled":
      return {
        ...s,
        update: {
          busy: false,
          list: s.update.list?.filter((u) => u.root !== msg.candidateRoot) ?? null,
          pending: msg.pending,
        },
        plan: { ...s.plan, current: msg.plan },
      };
    case "toggleRepoint": {
      const pending = s.update.pending;
      if (!pending?.repoint) return s;
      return { ...s, update: { ...s.update, pending: { ...pending, repoint: { ...pending.repoint, checked: msg.checked } } } };
    }
    case "updateSwitched":
      return s.tool === msg.tool ? { ...s, update: { ...s.update, pending: null } } : s;

    // --- uninstall ---
    case "planUninstall":
      return {
        ...s,
        error: null,
        uninstall: {
          plan: null,
          outcome: null,
          busy: true,
          switchPlan: null,
          defaultReplacement: msg.defaultReplacement ?? null,
        },
      };
    case "chooseReplacement":
      return { ...s, uninstall: { ...s.uninstall, switchPlan: null } };
    case "confirmUninstall":
      if (!canConfirmUninstall(s, msg.replacementRoot)) return s;
      if (s.uninstall.plan && s.uninstall.plan.installation.tool !== s.tool) return s;
      return { ...s, error: null, uninstall: { ...s.uninstall, busy: true } };
    case "uninstallFinished":
      return {
        ...s,
        uninstall: {
          ...s.uninstall,
          busy: false,
          outcome: msg.outcome,
          plan: msg.outcome.status === "removed" ? null : s.uninstall.plan,
        },
      };
    case "closeUninstall":
      return { ...s, uninstall: { ...s.uninstall, plan: null, outcome: null, switchPlan: null } };
    case "openFolder":
      return s;

    // --- profiles ---
    case "profilesLoaded":
      return { ...s, profiles: { ...s.profiles, list: msg.list, current: msg.current } };
    case "checkMissing":
    case "installMissing":
      return { ...s, error: null, profiles: { ...s.profiles, busy: true } };
    case "missingChecked":
      return { ...s, profiles: { ...s.profiles, busy: false, missing: { profileId: msg.profileId, items: msg.items } } };
    case "missingInstalled":
      return { ...s, profiles: { ...s.profiles, busy: false, missing: null } };

    case "failed": {
      const next = endBusy({ ...s, error: msg.error }, msg.op);
      if (msg.op !== "install" && msg.op !== "update" && msg.op !== "profiles") return next;
      return { ...next, install: { ...next.install, catalogError: msg.op === "install" && s.install.loading ? msg.error : s.install.catalogError, retainErrorOnRefresh: true } };
    }
  }
}

/** The switch applied before removing must be the one on screen, for the chosen replacement. */
export function canConfirmUninstall(s: ToolsState, replacementRoot: string | null): boolean {
  const plan = s.uninstall.plan;
  if (!plan || s.uninstall.busy) return false;
  if (!plan.needsReplacement) return true;
  return !!replacementRoot && s.uninstall.switchPlan?.selected.root === replacementRoot;
}

function endBusy(s: ToolsState, op: Operation): ToolsState {
  switch (op) {
    case "inventory":
      return { ...s, loading: false, reads: s.reads + 1 };
    case "plan":
      return { ...s, plan: { ...s.plan, building: false } };
    case "apply":
      return { ...s, plan: { ...s.plan, applying: false } };
    case "install":
      return { ...s, install: { ...s.install, busy: false, loading: false } };
    case "update":
      return { ...s, update: { ...s.update, busy: false } };
    case "uninstall":
      return { ...s, uninstall: { ...s.uninstall, busy: false } };
    case "profiles":
      return { ...s, profiles: { ...s.profiles, busy: false } };
    case "other":
      return s;
  }
}
