import { describe, expect, it, vi } from "vitest";
import type { UninstallPlan } from "../../types";
import { fakeApi, harness, inst, planFor } from "./testHarness";

const jdk21 = inst("java", "21.0.12", "C:\\jdk21", { selected: true, effective: true });
const jdk21new = inst("java", "21.0.13", "C:\\store\\jdk21.0.13", { managed: true });
const applied = { planId: "p", stale: false, needsElevation: false };

function updateApi(overrides = {}) {
  return fakeApi({
    listToolInstallations: vi.fn(async () => [jdk21]),
    updateInstallation: vi.fn(async () => ({ installation: jdk21new, plan: planFor(jdk21new) })),
    profilesUsing: vi.fn(async () => ["Android work"]),
    applyToolPlan: vi.fn(async () => applied),
    repointProfiles: vi.fn(async () => ["Android work"]),
    planUninstall: vi.fn(async () => uninstallPlanFor(jdk21)),
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
    const api = updateApi();
    const h = harness(api, { installations: [jdk21] });
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
    const api = updateApi();
    const h = harness(api, { installations: [jdk21] });
    h.dispatch({ type: "update", candidate: { root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" } });
    await h.settle();
    h.dispatch({ type: "toggleRepoint", checked: false });
    h.dispatch({ type: "applyPlan" });
    await h.settle();
    expect(api.repointProfiles).not.toHaveBeenCalled();
    expect(api.planUninstall).toHaveBeenCalled();
  });

  it("a stale update switch is rebuilt and still leads to the uninstall offer", async () => {
    const applyToolPlan = vi
      .fn()
      .mockResolvedValueOnce({ planId: "p", stale: true, needsElevation: false })
      .mockResolvedValueOnce(applied);
    const api = updateApi({ applyToolPlan, planToolApply: vi.fn(async () => planFor(jdk21new)) });
    const h = harness(api, { installations: [jdk21] });
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

  it("uninstalls with exactly the switch that was shown, and shows it again when it went stale", async () => {
    const shown = planFor(jdk21new, { planId: "shown" });
    const planToolApply = vi.fn(async () => shown);
    const uninstall = vi.fn().mockResolvedValueOnce({ status: "blocked", reason: "the environment changed" });
    const api = fakeApi({ planUninstall: vi.fn(async () => uninstallPlanFor()), planToolApply, uninstall });
    const h = harness(api);
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
    const api = fakeApi({
      planUninstall: vi.fn(async () => uninstallPlanFor(jdk21, { needsReplacement: false })),
      uninstall: vi.fn(async () => ({ status: "cancelled" as const })),
      repointProfiles,
    });
    const h = harness(api);
    h.dispatch({ type: "planUninstall", root: "C:\\jdk21" });
    await h.settle();
    h.dispatch({ type: "confirmUninstall", replacementRoot: jdk21new.root, repoint: true });
    await h.settle();
    expect(h.state.uninstall.outcome).toEqual({ status: "cancelled" });
    expect(repointProfiles).not.toHaveBeenCalled();
  });

  it("installs what a profile misses, then shows the profile's plan", async () => {
    const profile = { id: "a", name: "Android work", tools: [] };
    const api = fakeApi({
      installMissing: vi.fn(async () => {}),
      listProfiles: vi.fn(async () => [profile]),
      profileStatus: vi.fn(async () => ({ profile, matchesEffective: false, unavailable: [] })),
      planProfile: vi.fn(async () => planFor(jdk21new, { additionalSelections: [] })),
    });
    const h = harness(api);
    h.dispatch({ type: "installMissing", profile });
    await h.settle();
    expect(h.state.profiles.busy).toBe(false);
    expect(h.state.profiles.list).toHaveLength(1);
    expect(h.state.plan.current?.selected.root).toBe(jdk21new.root);
  });

  it("a failing call shows its error and frees its buttons", async () => {
    const api = fakeApi({ updateCandidates: vi.fn(async () => Promise.reject(new Error("offline"))) });
    const h = harness(api);
    h.dispatch({ type: "checkUpdates" });
    expect(h.state.update.busy).toBe(true);
    await h.settle();
    expect(h.state.update.busy).toBe(false);
    expect(h.state.error).toContain("offline");
  });
});
