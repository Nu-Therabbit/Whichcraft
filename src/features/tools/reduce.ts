import { isIntent, type Operation, type ToolsMsg } from "./messages";
import { isSingleToolPlan, type ToolsState } from "./model";

const STALE = "Environment changed since the plan was created. Refresh and try again.";
const NEEDS_UAC = "This plan requires UAC approval for System PATH changes.";

export function isApplyPlanOutcomeError(error: string | null): boolean {
  return error === STALE || error === NEEDS_UAC;
}

/** The only place the panel's state changes. Pure: no API calls, no time, no randomness. */
export function reduce(s: ToolsState, msg: ToolsMsg): ToolsState {
  // A slow result for the tool the panel has since left must not land on the new one.
  if (!isIntent(msg) && msg.type === "planBuilt" && msg.tool !== s.tool) {
    return { ...s, plan: { ...s.plan, building: false } };
  }
  if (
    !isIntent(msg) &&
    "tool" in msg &&
    msg.type !== "toolMutationDropped" &&
    msg.tool !== s.tool
  )
    return s;
  switch (msg.type) {
    // --- inventory ---
    case "started":
      return s;
    case "selectTool":
      // The update list belongs to the tool it was checked for.
      return {
        ...s,
        tool: msg.tool,
        loading: true,
        installations: [],
        update: { ...s.update, list: null },
      };
    case "refresh":
      return { ...s, loading: true };
    case "refreshed":
      return {
        ...s,
        loading: false,
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
        plan: { ...s.plan, current: null, building: true },
        update: { ...s.update, pending: msg.type === "buildPlan" && msg.keepPending ? s.update.pending : null },
      };
    case "planBuilt":
      return { ...s, plan: { ...s.plan, current: msg.plan, building: false } };
    case "toolMutationDropped":
      return {
        ...s,
        plan: { ...s.plan, applying: false },
        uninstall: { ...s.uninstall, busy: false },
      };
    case "planCleanup":
      return {
        ...s,
        error: null,
        plan: { ...s.plan, current: null, building: true, cleanup: null },
        update: { ...s.update, pending: null },
      };
    case "cleanupPlanned":
      return {
        ...s,
        plan: {
          ...s.plan,
          current: msg.plan,
          building: false,
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
      return { ...s, plan: { ...plan, current: null, cleanup: null } };
    }
    case "clearPlan":
      return { ...s, plan: { ...s.plan, current: null, cleanup: null }, update: { ...s.update, pending: null } };
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
    case "createProfile":
    case "deleteProfile":
      return { ...s, error: null };
    case "checkShell":
      return { ...s, error: null, shellCheck: null };
    case "shellChecked":
      return { ...s, shellCheck: msg.check };
    case "sdksLoaded":
      return { ...s, sdks: { android: msg.android, msvc: msg.msvc } };

    // --- install ---
    case "openInstallList":
      return { ...s, error: null, install: { ...s.install, loading: true, chosen: null } };
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
      return { ...s, update: { ...s.update, pending: null } };

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
    case "uninstallPlanned":
      return { ...s, uninstall: { ...s.uninstall, busy: false, plan: msg.plan } };
    case "chooseReplacement":
      return { ...s, uninstall: { ...s.uninstall, switchPlan: null } };
    case "switchPlanned":
      return { ...s, uninstall: { ...s.uninstall, switchPlan: msg.plan } };
    case "confirmUninstall":
      return canConfirmUninstall(s, msg.replacementRoot)
        ? { ...s, error: null, uninstall: { ...s.uninstall, busy: true } }
        : s;
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
      if (msg.op !== "install") return next;
      return { ...next, install: { ...next.install, retainErrorOnRefresh: true } };
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
      return { ...s, loading: false };
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
