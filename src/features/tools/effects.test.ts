import { describe, expect, it, vi } from "vitest";
import { ENVIRONMENT_PENDING_TOOLS_MESSAGE } from "../../coordination/types";
import type { UninstallPlan } from "../../types";
import { initialToolsState } from "./model";
import { fakeToolsRuntime, harness, inst, planFor } from "./testHarness";

const jdk21 = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
const jdk21new = inst("java", "21.0.13", "C:\\store\\jdk21.0.13", { managed: true });
const applied = { planId: "p", stale: false, needsElevation: false };

function updateRuntime(overrides = {}) {
  return fakeToolsRuntime({
    listToolInstallations: vi.fn(async () => [jdk21]),
    updateInstallation: vi.fn(async () => ({ installation: jdk21new, plan: planFor(jdk21new) })),
    profilesUsing: vi.fn(async () => ["Android work"]),
    applyToolPlan: vi.fn(async () => applied),
    repointProfiles: vi.fn(async () => ["Android work"]),
    planUninstall: vi.fn(async () => uninstallPlanFor(jdk21)),
    listProfiles: vi.fn(async () => []),
    profileStatus: vi.fn(async (profile) => ({ profile, matches: true })),
    ...overrides,
  });
}

function uninstallPlanFor(installation = jdk21, extra: Partial<UninstallPlan> = {}): UninstallPlan {
  return {
    installation,
    method: { kind: "recycleFolder" },
    usage: { processes: [], folderLocked: false },
    needsReplacement: true,
    replacements: [jdk21new],
    affectedProfiles: ["Android work"],
    gradleHint: false,
    noConfirmation: false,
    ...extra,
  };
}

describe("tools effects", () => {
  it("update, switch, move the profiles, then offer removing the old version with the new one suggested", async () => {
    const { api, runtime } = updateRuntime();
    const h = harness(runtime, { installations: [jdk21] });
    h.dispatch({ type: "update", candidate: { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" } });
    await h.settle();
    expect(h.state.plan.current?.selected.root).toBe(jdk21new.root);
    expect(h.state.update.pending?.repoint).toEqual({ from: jdk21, names: ["Android work"], checked: true });
    expect(api.repointProfiles).not.toHaveBeenCalled();

    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(api.repointProfiles).toHaveBeenCalledWith(jdk21, jdk21new);
    expect(api.planUninstall).toHaveBeenCalledWith("java", "C:\\jdk21");
    expect(h.state.uninstall.defaultReplacement).toBe(jdk21new.root);
    expect(h.state.uninstall.plan?.installation.root).toBe("C:\\jdk21");
    expect(h.state.update.pending).toBeNull();
  });

  it("does not move the profiles when the user unticks it", async () => {
    const { api, runtime } = updateRuntime();
    const h = harness(runtime, { installations: [jdk21] });
    h.dispatch({ type: "update", candidate: { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" } });
    await h.settle();
    h.dispatch({ type: "toggleRepoint", checked: false });
    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(api.repointProfiles).not.toHaveBeenCalled();
    expect(api.planUninstall).toHaveBeenCalled();
  });

  it("does not repoint or offer uninstall when update switch baseline went stale before apply", async () => {
    const { api, runtime, coordination } = updateRuntime();
    const h = harness(runtime, { installations: [jdk21] });
    h.dispatch({ type: "update", candidate: { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" } });
    await h.settle();
    coordination.invalidate(["environment-variables"]);
    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(api.repointProfiles).not.toHaveBeenCalled();
    expect(api.planUninstall).not.toHaveBeenCalled();
  });

  it("does not repoint or offer uninstall when update switch apply needs UAC", async () => {
    const applyToolPlan = vi.fn(async () => ({ planId: "p", stale: false, needsElevation: true }));
    const { api, runtime } = updateRuntime({ applyToolPlan });
    const h = harness(runtime, { installations: [jdk21] });
    h.dispatch({ type: "update", candidate: { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" } });
    await h.settle();
    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(api.repointProfiles).not.toHaveBeenCalled();
    expect(api.planUninstall).not.toHaveBeenCalled();
  });

  it("a stale update switch is rebuilt and still leads to the uninstall offer", async () => {
    const applyToolPlan = vi
      .fn()
      .mockResolvedValueOnce({ planId: "p", stale: true, needsElevation: false })
      .mockResolvedValueOnce(applied);
    const { api, runtime } = updateRuntime({
      applyToolPlan,
      planToolApply: vi.fn(async () => planFor(jdk21new)),
    });
    const h = harness(runtime, { installations: [jdk21] });
    h.dispatch({ type: "update", candidate: { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" } });
    await h.settle();
    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(h.state.error).toMatch(/Environment changed/);
    expect(h.state.plan.current?.selected.root).toBe(jdk21new.root);
    expect(api.planUninstall).not.toHaveBeenCalled();

    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(api.planUninstall).toHaveBeenCalledWith("java", "C:\\jdk21");
  });

  it("does not uninstall when the reviewed switch plan id or baseline no longer matches", async () => {
    const shown = planFor(jdk21new, { planId: "reviewed-for-uninstall" });
    const planToolApply = vi.fn(async () => shown);
    const uninstall = vi.fn(async () => ({ status: "removed" as const }));
    const { runtime, coordination } = fakeToolsRuntime({
      planUninstall: vi.fn(async () => uninstallPlanFor()),
      planToolApply,
      uninstall,
    });
    const h = harness(runtime);
    h.dispatch({ type: "planUninstall", root: "C:\\jdk21" });
    await h.settle();
    h.dispatch({ type: "chooseReplacement", root: jdk21new.root });
    await h.settle();
    coordination.invalidate(["environment-variables"]);
    h.dispatch({ type: "confirmUninstall", replacementRoot: jdk21new.root, repoint: false });
    await h.settle();
    expect(uninstall).not.toHaveBeenCalled();
    expect(planToolApply).toHaveBeenCalledTimes(2);
  });

  it("uninstalls with exactly the switch that was shown, and shows it again when it went stale", async () => {
    const shown = planFor(jdk21new, { planId: "shown" });
    const planToolApply = vi.fn(async () => shown);
    const uninstall = vi.fn().mockResolvedValueOnce({ status: "blocked", reason: "the environment changed" });
    const { runtime } = fakeToolsRuntime({
      planUninstall: vi.fn(async () => uninstallPlanFor()),
      planToolApply,
      uninstall,
    });
    const h = harness(runtime);
    h.dispatch({ type: "planUninstall", root: "C:\\jdk21" });
    await h.settle();
    h.dispatch({ type: "confirmUninstall", replacementRoot: jdk21new.root, repoint: true });
    await h.settle();
    expect(uninstall).not.toHaveBeenCalled();

    h.dispatch({ type: "chooseReplacement", root: jdk21new.root });
    await h.settle();
    h.dispatch({ type: "confirmUninstall", replacementRoot: jdk21new.root, repoint: true });
    await h.settle();
    expect(uninstall).toHaveBeenCalledWith("java", "C:\\jdk21", shown);
    expect(h.state.uninstall.outcome).toEqual({ status: "blocked", reason: "the environment changed" });
    expect(planToolApply).toHaveBeenCalledTimes(2);
    expect(h.state.uninstall.switchPlan).toBe(shown);
  });

  it("moves profiles only once the installation is really removed", async () => {
    const repointProfiles = vi.fn(async () => []);
    const { runtime } = fakeToolsRuntime({
      planUninstall: vi.fn(async () => uninstallPlanFor(jdk21, { needsReplacement: false })),
      uninstall: vi.fn(async () => ({ status: "cancelled" as const })),
      repointProfiles,
    });
    const h = harness(runtime);
    h.dispatch({ type: "planUninstall", root: "C:\\jdk21" });
    await h.settle();
    h.dispatch({ type: "confirmUninstall", replacementRoot: jdk21new.root, repoint: true });
    await h.settle();
    expect(h.state.uninstall.outcome).toEqual({ status: "cancelled" });
    expect(repointProfiles).not.toHaveBeenCalled();
  });

  it("installs what a profile misses, then shows the profile's plan", async () => {
    const profile = { id: "a", name: "Android work", tools: [] };
    const { runtime } = fakeToolsRuntime({
      installMissing: vi.fn(async () => {}),
      listProfiles: vi.fn(async () => [profile]),
      profileStatus: vi.fn(async () => ({ profile, matchesEffective: false, unavailable: [] })),
      planProfile: vi.fn(async () => planFor(jdk21new, { additionalSelections: [] })),
    });
    const h = harness(runtime);
    h.dispatch({ type: "installMissing", profile });
    await h.settle();
    expect(h.state.profiles.busy).toBe(false);
    expect(h.state.profiles.list).toHaveLength(1);
    expect(h.state.plan.current?.selected.root).toBe(jdk21new.root);
  });

  it("a failing call shows its error and frees its buttons", async () => {
    const { runtime } = fakeToolsRuntime({
      updateCandidates: vi.fn(async () => Promise.reject(new Error("offline"))),
    });
    const h = harness(runtime);
    h.dispatch({ type: "checkUpdates" });
    expect(h.state.update.busy).toBe(true);
    await h.settle();
    expect(h.state.update.busy).toBe(false);
    expect(h.state.error).toContain("offline");
  });
  it("a slow inventory for the tool the panel left does not replace the new tool's list", async () => {
    let releaseJava: () => void = () => {};
    const javaGate = new Promise<void>((resolve) => {
      releaseJava = resolve;
    });
    const node22 = inst("node", "22.23.4", "C:\\node22");
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async (tool) => {
        if (tool === "java") {
          await javaGate;
          return [jdk21];
        }
        return [node22];
      }),
    });
    const h = harness(runtime);
    h.dispatch({ type: "refresh" });
    h.dispatch({ type: "selectTool", tool: "node" });
    await vi.waitFor(() => expect(h.state.installations).toEqual([node22]));
    releaseJava();
    await h.settle();
    expect(h.state.tool).toBe("node");
    expect(h.state.installations).toEqual([node22]);
  });

  it("drops a slower inventory reload superseded by a newer refresh", async () => {
    const jdkOld = inst("java", "21.0.11", "C:\\old", { selected: true, effective: true });
    const jdkNew = inst("java", "21.0.12", "C:\\new", { selected: true, effective: true });
    let releaseFirst: (value: typeof jdkOld[]) => void = () => {};
    const listToolInstallations = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([jdkNew]);
    const { runtime } = fakeToolsRuntime({
      listToolInstallations,
      getRecoveryStatus: vi.fn(async () => null),
      unfinishedUninstalls: vi.fn(async () => []),
      listProfiles: vi.fn(async () => []),
      profileStatus: vi.fn(async (profile) => ({ profile, matches: true })),
    });
    const h = harness(runtime, { installations: [jdkOld] });
    h.dispatch({ type: "refresh" });
    await vi.waitFor(() => expect(listToolInstallations).toHaveBeenCalledTimes(1));
    h.dispatch({ type: "refresh" });
    releaseFirst([jdkOld]);
    await h.settle();
    expect(h.state.installations[0]?.root).toBe("C:\\new");
  });

  it("clears uninstall.busy when a late uninstall is dropped after switching tools", async () => {
    const shown = planFor(jdk21new, { planId: "shown" });
    const node = inst("node", "22.0.0", "C:\\node", { selected: true, effective: true });
    let releaseUninstall: (value: { status: "removed" }) => void = () => {};
    const uninstall = vi.fn(
      () =>
        new Promise<{ status: "removed" }>((resolve) => {
          releaseUninstall = resolve;
        }),
    );
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async (tool: string) => (tool === "java" ? [jdk21] : [node])),
      planUninstall: vi.fn(async () => uninstallPlanFor()),
      planToolApply: vi.fn(async () => shown),
      uninstall,
    });
    const h = harness(runtime, { tool: "java", installations: [jdk21] });
    h.dispatch({ type: "planUninstall", root: "C:\\jdk21" });
    await h.settle();
    h.dispatch({ type: "chooseReplacement", root: jdk21new.root });
    await h.settle();
    h.dispatch({ type: "confirmUninstall", replacementRoot: jdk21new.root, repoint: false });
    expect(h.state.uninstall.busy).toBe(true);
    h.dispatch({ type: "selectTool", tool: "node" });
    releaseUninstall({ status: "removed" });
    await h.settle();
    expect(h.state.uninstall.busy).toBe(false);
    expect(h.state.uninstall.outcome).toBeNull();
    expect(h.state.tool).toBe("node");
  });

  it("clears plan.building when a late planBuilt arrives for another tool", async () => {
    const node = inst("node", "22.0.0", "C:\\node", { selected: true, effective: true });
    let releasePlan: (value: ReturnType<typeof planFor>) => void = () => {};
    const planToolApply = vi.fn(
      () =>
        new Promise<ReturnType<typeof planFor>>((resolve) => {
          releasePlan = resolve;
        }),
    );
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async (tool: string) => (tool === "java" ? [jdk21] : [node])),
      planToolApply,
    });
    const h = harness(runtime, { tool: "java", installations: [jdk21] });
    h.dispatch({ type: "buildPlan", root: "C:\\jdk21" });
    expect(h.state.plan.building).toBe(true);
    h.dispatch({ type: "selectTool", tool: "node" });
    releasePlan(planFor(jdk21));
    await h.settle();
    expect(h.state.plan.building).toBe(false);
    expect(h.state.plan.current).toBeNull();
    expect(h.state.tool).toBe("node");
  });

  it("does not leave plan.applying true when a late undo is dropped", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
    const node = inst("node", "22.0.0", "C:\\node", { selected: true, effective: true });
    let releaseUndo: (v: { planId: string; stale: boolean; needsElevation: boolean }) => void = () => {};
    const undoLastWhichcraftApply = vi.fn(
      () =>
        new Promise<{ planId: string; stale: boolean; needsElevation: boolean }>((resolve) => {
          releaseUndo = resolve;
        }),
    );
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async (tool: string) => (tool === "java" ? [jdk] : [node])),
      undoLastWhichcraftApply,
      listProfiles: vi.fn(async () => []),
      profileStatus: vi.fn(async (p) => ({ profile: p, matches: true })),
    });
    const h = harness(runtime, { tool: "java", installations: [jdk] });
    h.dispatch({ type: "undoLast" });
    expect(h.state.plan.applying).toBe(true);
    h.dispatch({ type: "selectTool", tool: "node" });
    releaseUndo({ planId: "p", stale: false, needsElevation: false });
    await h.settle();
    expect(h.state.plan.applying).toBe(false);
  });

  it("does not leave plan.applying true when a late recovery resolve is dropped", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
    let releaseRollBack: (v: { planId: string; stale: boolean; needsElevation: boolean }) => void = () => {};
    const rollBackApply = vi.fn(
      () =>
        new Promise<{ planId: string; stale: boolean; needsElevation: boolean }>((resolve) => {
          releaseRollBack = resolve;
        }),
    );
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk]),
      rollBackApply,
      listProfiles: vi.fn(async () => []),
      profileStatus: vi.fn(async (p) => ({ profile: p, matches: true })),
    });
    const recovery = {
      journalId: "j-1",
      kind: "java_apply",
      createdAt: "2026-10-23T09:00:00Z",
      canResume: true,
      items: [],
    };
    const h = harness(runtime, {
      tool: "java",
      installations: [jdk],
      recovery,
    });
    h.dispatch({ type: "resolveRecovery", action: "rollBack" });
    expect(h.state.plan.applying).toBe(true);
    h.dispatch({ type: "selectTool", tool: "node" });
    releaseRollBack({ planId: "p", stale: false, needsElevation: false });
    await h.settle();
    expect(h.state.plan.applying).toBe(false);
  });

  it("drops a delayed profile load superseded by invalidation", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
    let releaseProfiles: (value: []) => void = () => {};
    const listProfiles = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<[]>((resolve) => {
            releaseProfiles = resolve;
          }),
      )
      .mockResolvedValueOnce([{ id: "p1", name: "Winner", tools: [] }]);
    const { runtime, coordination } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk]),
      listProfiles,
      profileStatus: vi.fn(async (p) => ({ profile: p, matchesEffective: false, unavailable: [] })),
    });
    const h = harness(runtime, { installations: [jdk], profiles: { ...initialToolsState().profiles, list: [] } });
    h.dispatch({ type: "loadProfiles" });
    coordination.invalidate(["tools-profiles"]);
    h.dispatch({ type: "loadProfiles" });
    releaseProfiles([]);
    await h.settle();
    expect(h.state.profiles.list[0]?.profile.name).toBe("Winner");
  });

  it("does not apply a late tool result after switching tools", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
    const node = inst("node", "22.0.0", "C:\\node", { selected: true, effective: true });
    let releaseApply: (value: { planId: string; stale: boolean; needsElevation: boolean }) => void = () => {};
    const applyToolPlan = vi.fn(
      () =>
        new Promise<{ planId: string; stale: boolean; needsElevation: boolean }>((resolve) => {
          releaseApply = resolve;
        }),
    );
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async (tool: string) => (tool === "java" ? [jdk] : [node])),
      planToolApply: vi.fn(async () => planFor(jdk)),
      applyToolPlan,
    });
    const h = harness(runtime, {
      tool: "java",
      installations: [jdk],
      plan: { ...initialToolsState().plan, current: planFor(jdk) },
    });
    h.dispatch({ type: "applyPlan" });
    h.dispatch({ type: "selectTool", tool: "node" });
    releaseApply({ planId: "p", stale: false, needsElevation: false });
    await h.settle();
    expect(h.state.tool).toBe("node");
    expect(h.state.plan.current).toBeNull();
  });

  it("keeps the newer shell check when an older response returns later", async () => {
    const jdk = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
    const shellPayload = (path: string) => ({
      tool: "java" as const,
      shell: "windows_terminal" as const,
      effectivePath: path,
      shellPath: path,
      matches: path === "newer",
    });
    let releaseFirst: (value: ReturnType<typeof shellPayload>) => void = () => {};
    const shellCheck = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(shellPayload("newer"));
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk]),
      shellCheck,
    });
    const h = harness(runtime, { installations: [jdk] });
    h.dispatch({ type: "checkShell" });
    h.dispatch({ type: "checkShell" });
    releaseFirst(shellPayload("older"));
    await h.settle();
    expect(h.state.shellCheck?.effectivePath).toBe("newer");
  });

  it("does not commit apply when the on-screen plan id is not the reviewed plan", async () => {
    const reviewed = planFor(jdk21, { planId: "reviewed-plan-id" });
    const onScreen = planFor(jdk21new, { planId: "other-plan-id" });
    const applyToolPlan = vi.fn(async () => ({ planId: onScreen.planId, stale: false, needsElevation: false }));
    const { runtime } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk21, jdk21new]),
      planToolApply: vi.fn(async () => onScreen),
      applyToolPlan,
      listProfiles: vi.fn(async () => []),
      profileStatus: vi.fn(async (p) => ({ profile: p, matches: true })),
    });
    const h = harness(runtime, { installations: [jdk21, jdk21new] });
    h.dispatch({ type: "buildPlan", root: jdk21new.root });
    await h.settle();
    runtime.coordination.registerReviewedPlan(reviewed);
    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(applyToolPlan).not.toHaveBeenCalled();
    expect(h.state.plan.current?.planId).toBe("other-plan-id");
    expect(h.state.plan.applying).toBe(false);
  });

  it("blocks tool apply while staged environment edits are pending", async () => {
    const applyToolPlan = vi.fn(async () => ({ planId: "p", stale: false, needsElevation: false }));
    const { runtime, coordination } = fakeToolsRuntime({
      listToolInstallations: vi.fn(async () => [jdk21]),
      planToolApply: vi.fn(async () => planFor(jdk21)),
      applyToolPlan,
    });
    coordination.setEnvironmentPending(true);
    const h = harness(runtime, {
      installations: [jdk21],
      plan: { ...initialToolsState().plan, current: planFor(jdk21) },
    });
    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(applyToolPlan).not.toHaveBeenCalled();
    expect(h.state.error).toBe(ENVIRONMENT_PENDING_TOOLS_MESSAGE);
  });

  it("invalidates shell overview after a successful install and reloads inventory", async () => {
    const listener = vi.fn();
    const installManaged = vi.fn(async () => "C:\\store\\node\\22.0.1");
    const { runtime, coordination } = fakeToolsRuntime({
      installManaged,
      listToolInstallations: vi.fn(async () => [inst("node", "22.0.1", "C:\\store\\node\\22.0.1", { managed: true })]),
    });
    coordination.subscribeInvalidation(listener);
    const h = harness(runtime, {
      tool: "node",
      install: {
        ...initialToolsState().install,
        chosen: { version: "22.0.1", downloadBytes: 1000, diskBytes: 2000 },
      },
    });
    h.dispatch({ type: "install" });
    await h.settle();
    expect(installManaged).toHaveBeenCalledWith("node", "22.0.1");
    expect(listener).toHaveBeenCalledWith(
      expect.arrayContaining(["shell-overview", "tools-installations"]),
    );
    expect(h.state.install.busy).toBe(false);
  });

  it("invalidates shell overview when install fails and still reloads the panel", async () => {
    const listener = vi.fn();
    const installManaged = vi.fn(async () => {
      throw new Error("download failed");
    });
    const listToolInstallations = vi.fn(async () => []);
    const { runtime, coordination } = fakeToolsRuntime({ installManaged, listToolInstallations });
    coordination.subscribeInvalidation(listener);
    const h = harness(runtime, {
      tool: "node",
      install: {
        ...initialToolsState().install,
        chosen: { version: "22.0.1", downloadBytes: null },
      },
    });
    h.dispatch({ type: "install" });
    await h.settle();
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining(["shell-overview"]));
    expect(h.state.error).toMatch(/download failed/);
    expect(h.state.install.busy).toBe(false);
    expect(listToolInstallations).toHaveBeenCalled();
  });

  it("invalidates shell overview when install is cancelled and clears busy after switching tools", async () => {
    const listener = vi.fn();
    let finishInstall!: () => void;
    const installManaged = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishInstall = () => resolve("C:\\store\\node\\22.0.1");
        }),
    );
    const { runtime, coordination } = fakeToolsRuntime({
      installManaged,
      listToolInstallations: vi.fn(async () => []),
    });
    coordination.subscribeInvalidation(listener);
    const h = harness(runtime, {
      tool: "node",
      install: {
        ...initialToolsState().install,
        chosen: { version: "22.0.1", downloadBytes: null },
      },
    });
    h.dispatch({ type: "install" });
    h.dispatch({ type: "selectTool", tool: "java" });
    finishInstall();
    await h.settle();
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining(["shell-overview"]));
    expect(h.state.install.busy).toBe(false);
  });

  it("reads the mise status after listing versions, so a finished download unlocks Install", async () => {
    let fetching = true;
    const status = (f: boolean) => ({ version: "2026.10.1", present: !f, downloadBytes: 1, oldVersions: [], fetching: f });
    const { runtime } = fakeToolsRuntime({
      getMiseStatus: vi.fn(async () => status(fetching)),
      listRemoteVersions: vi.fn(async () => {
        fetching = false;
        return [{ version: "22.24.0", downloadBytes: null, installBytes: null }];
      }),
    });
    const h = harness(runtime);
    h.dispatch({ type: "openInstallList" });
    await h.settle();
    expect(h.state.install.miseStatus?.fetching).toBe(false);
    expect(h.state.install.versions).toHaveLength(1);
  });
});
