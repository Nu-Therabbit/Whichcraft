import type { WriteCoordinatorFacade } from "../../coordination/createWriteCoordinator";
import type { InvalidationScope, ToolsWriteKind, WriteAdmission, WriteOutcome } from "../../coordination/types";
import type { ProfileToolPin, ToolKind, ToolProfile } from "../../types";
import type { ToolsRuntime } from "./runtime";
import type { Operation, ToolsIntent, ToolsMsg } from "./messages";
import { isSingleToolPlan, type ToolsState } from "./model";
import { canConfirmUninstall } from "./reduce";

const PROFILE_TOOLS: ToolKind[] = ["java", "node", "python", "go", "flutter", "git"];

const SCOPES_AFTER_INSTALL: InvalidationScope[] = [
  "tools-installations",
  "tools-profiles",
  "tools-shell-check",
  "shell-overview",
];

/** Notify shell overview and refresh the active tool panel after any install attempt ends. */
async function afterInstallAttempt(ctx: EffectContext, originTool: ToolKind): Promise<void> {
  const { coordination } = ctx.runtime;
  coordination.invalidate(SCOPES_AFTER_INSTALL);
  const panelTool = ctx.getState().tool;
  if (panelTool === originTool) {
    await reload(ctx, originTool);
  } else if (ctx.getState().install.busy) {
    // Switched away mid-install: keep footer progress honest without blaming the new tool.
    ctx.dispatch({ type: "installed" });
  }
}

export interface EffectContext {
  /** The state as it was when the intent was dispatched. */
  state: ToolsState;
  /** Live panel state (may differ after overlapping intents). */
  getState: () => ToolsState;
  /** Dispatches a message: the reducer runs, then that message's effects. */
  dispatch: (msg: ToolsMsg) => void;
  runtime: ToolsRuntime;
  newId: () => string;
}

function shouldCommitToolMutation(
  ctx: EffectContext,
  originTool: ToolKind,
  resultBinding: ReturnType<WriteCoordinatorFacade["beginToolResult"]>,
  planBinding?: ReturnType<WriteCoordinatorFacade["beginPlanApply"]>,
): boolean {
  const { coordination } = ctx.runtime;
  if (ctx.getState().tool !== originTool) return false;
  if (!coordination.isToolResultCurrent(resultBinding)) return false;
  if (planBinding !== undefined && !coordination.isPlanApplyCurrent(planBinding)) return false;
  return true;
}

function releaseToolsWrite(ctx: EffectContext, admission: WriteAdmission | null, outcome: "success" | "failure" | "cancel") {
  if (admission) ctx.runtime.coordination.endToolsWrite(admission, outcome);
}

async function withToolsWrite(
  ctx: EffectContext,
  kind: ToolsWriteKind,
  op: Operation,
  fn: () => Promise<WriteOutcome | undefined>,
): Promise<void> {
  const gate = ctx.runtime.coordination.tryBeginToolsWrite(kind);
  if (!gate.ok) {
    ctx.dispatch({ type: "failed", op, error: gate.reason });
    return;
  }
  let outcome: WriteOutcome = "success";
  try {
    const explicit = await fn();
    if (explicit) outcome = explicit;
  } catch (e) {
    releaseToolsWrite(ctx, gate.admission, "failure");
    await readbackToolsState(ctx, ctx.state.tool);
    throw e;
  }
  releaseToolsWrite(ctx, gate.admission, outcome);
}

async function readbackToolsState(ctx: EffectContext, tool: ToolKind): Promise<void> {
  await reload(ctx, tool);
  await loadProfiles(ctx);
}

function dropToolMutation(ctx: EffectContext, originTool: ToolKind) {
  ctx.dispatch({ type: "toolMutationDropped", tool: originTool });
}

function guardConflictingToolWork(ctx: EffectContext, op: Operation): boolean {
  const gate = ctx.runtime.coordination.checkToolsWriteAllowed();
  if (!gate.ok) {
    ctx.dispatch({ type: "failed", op, error: gate.reason });
    return false;
  }
  return true;
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
  const { tools, platform, coordination } = runtime;
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

    case "buildPlan": {
      if (!guardConflictingToolWork(ctx, "plan")) return;
      const planTool = msg.tool ?? tool;
      const plan = await tools.planToolApply(planTool, msg.root);
      coordination.registerReviewedPlan(plan);
      dispatch({
        type: "planBuilt",
        tool: plan.tool,
        plan,
        source: msg.source ?? "inventory",
      });
      return;
    }
    case "applyPlan": {
      const plan = state.plan.current;
      if (!plan) return;
      const originTool = tool;
      const planSource = state.plan.source;
      let staleRebuild: { tool: ToolKind; root: string } | null = null;
      await withToolsWrite(ctx, "apply-plan", "apply", async () => {
        const resultBinding = coordination.beginToolResult(originTool);
        const planBinding = coordination.beginPlanApply(plan.planId, plan.tool);
        if (!coordination.isPlanApplyCurrent(planBinding)) {
          dropToolMutation(ctx, originTool);
          return "cancel";
        }
        const result = plan.requiresUac
          ? await tools.applyToolPlanWithUac(plan)
          : await tools.applyToolPlan(plan);
        if (!shouldCommitToolMutation(ctx, originTool, resultBinding, planBinding)) {
          dropToolMutation(ctx, originTool);
          return "cancel";
        }
        dispatch({ type: "applyFinished", tool: originTool, result });
        if (result.stale) {
          if (isSingleToolPlan(plan)) staleRebuild = { tool: plan.tool, root: plan.selected.root };
          await readbackToolsState(ctx, originTool);
          return "failure";
        }
        if (result.needsElevation) return "cancel";
        await readbackToolsState(ctx, originTool);
        const pending = ctx.getState().tool === originTool ? ctx.getState().update.pending : null;
        if (pending) {
          // The update's switch is in: move the profiles if left ticked, then offer removing the old one.
          if (pending.repoint?.checked) await tools.repointProfiles(pending.repoint.from, pending.installed);
          dispatch({ type: "updateSwitched", tool: originTool });
          dispatch({ type: "planUninstall", root: pending.replacedRoot, defaultReplacement: pending.installed.root });
        }
      });
      if (staleRebuild) {
        dispatch({
          type: "buildPlan",
          root: staleRebuild.root,
          tool: staleRebuild.tool,
          keepPending: true,
          source: planSource === "profile" ? "profile" : "inventory",
        });
      }
      return;
    }
    case "undoLast":
      return withToolsWrite(ctx, "undo", "apply", async () => {
        const originTool = tool;
        const resultBinding = coordination.beginToolResult(originTool);
        const result = await tools.undoLastWhichcraftApply();
        if (!shouldCommitToolMutation(ctx, originTool, resultBinding)) {
          dropToolMutation(ctx, originTool);
          return "cancel";
        }
        dispatch({ type: "undone", tool: originTool, result });
        await readbackToolsState(ctx, originTool);
      });
    case "resolveRecovery": {
      const recovery = state.recovery;
      if (!recovery) return;
      return withToolsWrite(ctx, "recovery", "apply", async () => {
        const originTool = tool;
        const resultBinding = coordination.beginToolResult(originTool);
        try {
          if (msg.action === "resume") {
            await tools.resumeApply(recovery.journalId);
            if (!shouldCommitToolMutation(ctx, originTool, resultBinding)) {
              dropToolMutation(ctx, originTool);
              return "cancel";
            }
            dispatch({ type: "recoveryResolved", tool: originTool, result: null });
          } else {
            const result = await tools.rollBackApply(recovery.journalId);
            if (!shouldCommitToolMutation(ctx, originTool, resultBinding)) {
              dropToolMutation(ctx, originTool);
              return "cancel";
            }
            dispatch({ type: "recoveryResolved", tool: originTool, result });
          }
        } finally {
          if (coordination.isToolResultCurrent(resultBinding)) {
            await readbackToolsState(ctx, originTool);
          }
        }
      });
    }

    case "saveSettings":
      await platform.saveWhichcraftSettings(msg.settings);
      return reload(ctx, tool);
    case "checkShell": {
      const binding = coordination.beginShellCheck(tool);
      const check = await tools.shellCheck(tool);
      if (!coordination.isShellCheckCurrent(binding)) return;
      dispatch({ type: "shellChecked", tool, check });
      return;
    }
    case "clearShellCheck":
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
      const originTool = tool;
      try {
        await tools.installManaged(originTool, chosen.version);
        if (ctx.getState().tool === originTool) {
          dispatch({ type: "installed" });
        }
      } catch (e) {
        if (ctx.getState().tool === originTool) {
          dispatch({ type: "failed", op: "install", error: String(e) });
        }
      } finally {
        await afterInstallAttempt(ctx, originTool);
      }
      return;
    }

    case "checkUpdates":
      dispatch({ type: "updatesChecked", tool, list: await tools.updateCandidates(tool) });
      return;
    case "update": {
      const originTool = tool;
      const old = state.installations.find((v) => v.root === msg.candidate.root);
      const result = await tools.updateInstallation(originTool, msg.candidate.latest);
      if (ctx.getState().tool !== originTool) return;
      const names = old ? await tools.profilesUsing(old) : [];
      dispatch({
        type: "updateInstalled",
        tool: originTool,
        candidateRoot: msg.candidate.root,
        plan: result.plan,
        pending: {
          replacedRoot: msg.candidate.root,
          installed: result.installation,
          repoint: old && names.length > 0 ? { from: old, names, checked: true } : null,
        },
      });
      coordination.registerReviewedPlan(result.plan);
      return reload(ctx, originTool);
    }
    case "toggleRepoint":
      return;

    case "planUninstall": {
      const originTool = tool;
      const plan = await tools.planUninstall(originTool, msg.root);
      dispatch({ type: "uninstallPlanned", tool: originTool, plan });
      return;
    }
    case "chooseReplacement": {
      if (!msg.root || !state.uninstall.plan?.needsReplacement) return;
      const originTool = tool;
      if (state.uninstall.plan.installation.tool !== originTool) return;
      const switchPlan = await tools.planToolApply(originTool, msg.root);
      coordination.registerReviewedPlan(switchPlan);
      dispatch({ type: "switchPlanned", tool: originTool, plan: switchPlan });
      return;
    }
    case "confirmUninstall": {
      const plan = state.uninstall.plan;
      if (!plan || plan.installation.tool !== tool || !canConfirmUninstall(state, msg.replacementRoot)) {
        const live = ctx.getState();
        if (plan && plan.installation.tool !== live.tool && live.uninstall.busy) {
          dispatch({ type: "toolMutationDropped", tool: live.tool });
        }
        return;
      }
      return withToolsWrite(ctx, "uninstall", "uninstall", async () => {
        const originTool = tool;
        const resultBinding = coordination.beginToolResult(originTool);
        // The switch applied is exactly the one the user was shown.
        const replacement = plan.needsReplacement ? state.uninstall.switchPlan : null;
        let planBinding: ReturnType<WriteCoordinatorFacade["beginPlanApply"]> | undefined;
        if (replacement) {
          planBinding = coordination.beginPlanApply(replacement.planId, replacement.tool);
          if (!coordination.isPlanApplyCurrent(planBinding)) {
            dispatch({ type: "chooseReplacement", root: msg.replacementRoot });
            return "cancel";
          }
        }
        const outcome = await tools.uninstall(originTool, plan.installation.root, replacement);
        if (!shouldCommitToolMutation(ctx, originTool, resultBinding, planBinding)) {
          dropToolMutation(ctx, originTool);
          return "cancel";
        }
        dispatch({ type: "uninstallFinished", tool: originTool, outcome });
        // A switch gone stale must be shown again before it is applied.
        if (outcome.status === "blocked") dispatch({ type: "chooseReplacement", root: msg.replacementRoot });
        const target = plan.replacements.find((r) => r.root === msg.replacementRoot);
        if (outcome.status === "removed" && msg.repoint && target) {
          await tools.repointProfiles(plan.installation, target);
        }
        await readbackToolsState(ctx, tool);
      });
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
      if (!guardConflictingToolWork(ctx, "profiles")) return;
      return saveProfiles(ctx, [...profilesOf(state), { id: ctx.newId(), name: msg.name, tools: msg.tools }]);
    case "deleteProfile":
      if (!guardConflictingToolWork(ctx, "profiles")) return;
      return saveProfiles(ctx, profilesOf(state).filter((p) => p.id !== msg.id));
    case "planProfile": {
      if (!guardConflictingToolWork(ctx, "plan")) return;
      const plan = await tools.planProfile(msg.profile);
      coordination.registerReviewedPlan(plan);
      dispatch({ type: "planBuilt", tool: plan.tool, plan, source: "profile" });
      return;
    }
    case "checkMissing":
      dispatch({
        type: "missingChecked",
        profileId: msg.profile.id,
        items: await tools.profileMissing(msg.profile),
      });
      return;
    case "installMissing":
      // F-3: install what is missing, then go straight on to the profile's plan.
      // Installing without switching does not require resolving staged environment edits.
      await tools.installMissing(msg.profile);
      dispatch({ type: "missingInstalled" });
      await loadProfiles(ctx);
      dispatch({ type: "planProfile", profile: msg.profile });
      return;

    case "planCleanup": {
      if (!guardConflictingToolWork(ctx, "plan")) return;
      const result = await tools.planPathCleanup();
      if (result.userDiffs.length > 0) coordination.registerReviewedPlan(result);
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
async function reload(ctx: EffectContext, tool: ToolKind): Promise<void> {
  const { runtime, dispatch } = ctx;
  const { tools, platform, coordination } = runtime;
  const binding = coordination.beginToolsRead(tool);
  try {
    const recovery = await tools.getRecoveryStatus();
    if (!coordination.isToolsReadCurrent(binding)) return;
    const unfinished = await tools.unfinishedUninstalls();
    if (!coordination.isToolsReadCurrent(binding)) return;
    const settings = await platform.getWhichcraftSettings();
    if (!coordination.isToolsReadCurrent(binding)) return;
    const installations = await tools.listToolInstallations(tool);
    if (!coordination.isToolsReadCurrent(binding)) return;
    const pythonInfo = tool === "python" ? await tools.getPythonLauncherInfo() : null;
    if (!coordination.isToolsReadCurrent(binding)) return;
    dispatch({
      type: "refreshed",
      tool,
      recovery,
      unfinished,
      settings,
      installations,
      pythonInfo,
    });
  } catch (e) {
    if (!coordination.isToolsReadCurrent(binding)) return;
    dispatch({ type: "failed", op: "inventory", error: String(e) });
  }
}

/** Each profile with whether it matches what is effective now; recomputed on every load (F-6). */
async function loadProfiles(ctx: EffectContext): Promise<void> {
  const { tools, coordination } = ctx.runtime;
  const binding = coordination.beginRead({ kind: "profiles" });
  const list = await tools.listProfiles();
  if (!coordination.isReadCurrent(binding)) return;
  const statuses = await Promise.all(list.map((p) => tools.profileStatus(p)));
  if (!coordination.isReadCurrent(binding)) return;
  const current: ProfileToolPin[] = [];
  for (const kind of PROFILE_TOOLS) {
    const effective = (await tools.listToolInstallations(kind)).find((v) => v.effective);
    if (!coordination.isReadCurrent(binding)) return;
    if (effective) {
      current.push({ tool: kind, vendor: effective.vendor, version: effective.version, preferredRoot: effective.root });
    }
  }
  if (!coordination.isReadCurrent(binding)) return;
  ctx.dispatch({ type: "profilesLoaded", list: statuses, current });
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
