import type { ToolsRuntime } from "./runtime";
import type { ProfileToolPin, ToolKind, ToolProfile } from "../../types";
import type { Operation, ToolsIntent, ToolsMsg } from "./messages";
import { isSingleToolPlan, type ToolsState } from "./model";
import { canConfirmUninstall } from "./reduce";

const PROFILE_TOOLS: ToolKind[] = ["java", "node", "python", "go", "flutter", "git"];

export interface EffectContext {
  /** The state as it was when the intent was dispatched. */
  state: ToolsState;
  /** Dispatches a message: the reducer runs, then that message's effects. */
  dispatch: (msg: ToolsMsg) => void;
  runtime: ToolsRuntime;
  newId: () => string;
}

/** The backend calls an intent needs, reported back as events. Never touches state itself. */
export async function runEffects(intent: ToolsIntent, ctx: EffectContext): Promise<void> {
  const op = operationOf(intent);
  try {
    await run(intent, ctx);
  } catch (e) {
    ctx.dispatch({ type: "failed", op, error: String(e) });
  }
}

async function run(msg: ToolsIntent, ctx: EffectContext): Promise<void> {
  const { state, dispatch, runtime } = ctx;
  const { tools, platform } = runtime;
  const tool = state.tool;
  switch (msg.type) {
    case "started":
      // A newly pinned mise is fetched in the background after an app update (ticket 17).
      // Offline, the old one keeps working for uninstall and listing; installing retries.
      tools.prepareMise().catch(() => {});
      return;
    case "selectTool":
      return reload(ctx, msg.tool);
    case "refresh":
      return reload(ctx, tool);

    case "buildPlan":
      dispatch({ type: "planBuilt", plan: await tools.planToolApply(tool, msg.root) });
      return;
    case "applyPlan": {
      const plan = state.plan.current;
      if (!plan) return;
      const result = plan.requiresUac
        ? await tools.applyToolPlanWithUac(plan)
        : await tools.applyToolPlan(plan);
      dispatch({ type: "applyFinished", result });
      if (result.stale) {
        if (isSingleToolPlan(plan)) dispatch({ type: "buildPlan", root: plan.selected.root, keepPending: true });
        return;
      }
      if (result.needsElevation) return;
      await reload(ctx, tool);
      const pending = state.update.pending;
      if (pending) {
        // The update's switch is in: move the profiles if left ticked, then offer removing the old one.
        if (pending.repoint?.checked) await tools.repointProfiles(pending.repoint.from, pending.installed);
        dispatch({ type: "updateSwitched" });
        dispatch({ type: "planUninstall", root: pending.replacedRoot, defaultReplacement: pending.installed.root });
      }
      return;
    }
    case "undoLast":
      dispatch({ type: "undone", result: await tools.undoLastWhichcraftApply() });
      return reload(ctx, tool);
    case "resolveRecovery": {
      const recovery = state.recovery;
      if (!recovery) return;
      if (msg.action === "resume") {
        await tools.resumeApply(recovery.journalId);
        dispatch({ type: "recoveryResolved", result: null });
      } else {
        dispatch({ type: "recoveryResolved", result: await tools.rollBackApply(recovery.journalId) });
      }
      return reload(ctx, tool);
    }

    case "saveSettings":
      await platform.saveWhichcraftSettings(msg.settings);
      return reload(ctx, tool);
    case "checkShell":
      dispatch({ type: "shellChecked", tool, check: await tools.shellCheck(tool) });
      return;
    case "openTerminal":
      return platform.openTerminal();
    case "loadSdks":
      dispatch({
        type: "sdksLoaded",
        android: await tools.getAndroidInventory(),
        msvc: await tools.getMsvcInventory(),
      });
      return;

    case "openInstallList": {
      // Listing may wait for mise to finish downloading, so its status is read afterwards.
      const versions = await tools.listRemoteVersions(tool);
      dispatch({ type: "versionsLoaded", tool, miseStatus: await tools.getMiseStatus(), versions });
      return;
    }
    case "chooseVersion":
      try {
        dispatch({
          type: "versionSized",
          tool,
          chosen: { version: msg.version, ...(await tools.downloadSize(tool, msg.version)) },
        });
      } catch {
        // The size is informative only; installing still works without it.
      }
      return;
    case "install": {
      const chosen = state.install.chosen;
      if (!chosen) return;
      await tools.installManaged(tool, chosen.version);
      dispatch({ type: "installed" });
      return reload(ctx, tool);
    }

    case "checkUpdates":
      dispatch({ type: "updatesChecked", tool, list: await tools.updateCandidates(tool) });
      return;
    case "update": {
      const old = state.installations.find((v) => v.root === msg.candidate.root);
      const result = await tools.updateInstallation(tool, msg.candidate.latest);
      const names = old ? await tools.profilesUsing(old) : [];
      dispatch({
        type: "updateInstalled",
        candidateRoot: msg.candidate.root,
        plan: result.plan,
        pending: {
          replacedRoot: msg.candidate.root,
          installed: result.installation,
          repoint: old && names.length > 0 ? { from: old, names, checked: true } : null,
        },
      });
      return reload(ctx, tool);
    }
    case "toggleRepoint":
      return;

    case "planUninstall":
      dispatch({ type: "uninstallPlanned", plan: await tools.planUninstall(tool, msg.root) });
      return;
    case "chooseReplacement":
      if (!msg.root || !state.uninstall.plan?.needsReplacement) return;
      dispatch({ type: "switchPlanned", plan: await tools.planToolApply(tool, msg.root) });
      return;
    case "confirmUninstall": {
      const plan = state.uninstall.plan;
      if (!plan || !canConfirmUninstall(state, msg.replacementRoot)) return;
      // The switch applied is exactly the one the user was shown.
      const replacement = plan.needsReplacement ? state.uninstall.switchPlan : null;
      const outcome = await tools.uninstall(tool, plan.installation.root, replacement);
      dispatch({ type: "uninstallFinished", outcome });
      // A switch gone stale must be shown again before it is applied.
      if (outcome.status === "blocked") dispatch({ type: "chooseReplacement", root: msg.replacementRoot });
      const target = plan.replacements.find((r) => r.root === msg.replacementRoot);
      if (outcome.status === "removed" && msg.repoint && target) {
        await tools.repointProfiles(plan.installation, target);
      }
      return reload(ctx, tool);
    }
    case "closeUninstall":
      return;
    case "openFolder":
      return platform.openFolder(msg.path);
    case "dismissUnfinished":
      await tools.dismissUnfinishedUninstall(msg.id);
      return reload(ctx, tool);

    case "loadProfiles":
      return loadProfiles(ctx);
    case "createProfile":
      return saveProfiles(ctx, [...profilesOf(state), { id: ctx.newId(), name: msg.name, tools: msg.tools }]);
    case "deleteProfile":
      return saveProfiles(ctx, profilesOf(state).filter((p) => p.id !== msg.id));
    case "planProfile":
      dispatch({ type: "planBuilt", plan: await tools.planProfile(msg.profile) });
      return;
    case "checkMissing":
      dispatch({
        type: "missingChecked",
        profileId: msg.profile.id,
        items: await tools.profileMissing(msg.profile),
      });
      return;
    case "installMissing":
      // F-3: install what is missing, then go straight on to the profile's plan.
      await tools.installMissing(msg.profile);
      dispatch({ type: "missingInstalled" });
      await loadProfiles(ctx);
      dispatch({ type: "planProfile", profile: msg.profile });
      return;

    case "planCleanup": {
      const result = await tools.planPathCleanup();
      dispatch({
        type: "cleanupPlanned",
        plan: result.userDiffs.length > 0 ? result : null,
        duplicates: result.removedDuplicates,
        missing: result.removedMissing,
      });
      return;
    }
    case "clearPlan":
    case "clearUndoResult":
      return;
  }
}

/** Reads what the panel shows for `tool` from the backend again. */
async function reload({ runtime, dispatch }: EffectContext, tool: ToolKind): Promise<void> {
  const { tools, platform } = runtime;
  try {
    dispatch({
      type: "refreshed",
      tool,
      recovery: await tools.getRecoveryStatus(),
      unfinished: await tools.unfinishedUninstalls(),
      settings: await platform.getWhichcraftSettings(),
      installations: await tools.listToolInstallations(tool),
      pythonInfo: tool === "python" ? await tools.getPythonLauncherInfo() : null,
    });
  } catch (e) {
    dispatch({ type: "failed", op: "inventory", error: String(e) });
  }
}

/** Each profile with whether it matches what is effective now; recomputed on every load (F-6). */
async function loadProfiles({ runtime, dispatch }: EffectContext): Promise<void> {
  const { tools } = runtime;
  const list = await tools.listProfiles();
  const statuses = await Promise.all(list.map((p) => tools.profileStatus(p)));
  const current: ProfileToolPin[] = [];
  for (const kind of PROFILE_TOOLS) {
    const effective = (await tools.listToolInstallations(kind)).find((v) => v.effective);
    if (effective) {
      current.push({ tool: kind, vendor: effective.vendor, version: effective.version, preferredRoot: effective.root });
    }
  }
  dispatch({ type: "profilesLoaded", list: statuses, current });
}

async function saveProfiles(ctx: EffectContext, next: ToolProfile[]): Promise<void> {
  const { saveProfiles } = ctx.runtime.tools;
  await saveProfiles(next);
  await loadProfiles(ctx);
}

const profilesOf = (s: ToolsState) => s.profiles.list.map((p) => p.profile);

function operationOf(intent: ToolsIntent): Operation {
  switch (intent.type) {
    case "started":
    case "selectTool":
    case "refresh":
      return "inventory";
    case "buildPlan":
    case "planProfile":
    case "planCleanup":
      return "plan";
    case "applyPlan":
    case "undoLast":
    case "resolveRecovery":
      return "apply";
    case "openInstallList":
    case "install":
      return "install";
    case "checkUpdates":
    case "update":
      return "update";
    case "planUninstall":
    case "confirmUninstall":
      return "uninstall";
    case "checkMissing":
    case "installMissing":
      return "profiles";
    default:
      return "other";
  }
}
