import { describe, expect, it } from "vitest";
import type { UninstallPlan } from "../../types";
import { initialToolsState, type ToolsState } from "./model";
import { reduce } from "./reduce";
import { inst, planFor } from "./testHarness";

const jdk17 = inst("java", "17.0.20.1", "C:\\jdk17", { selected: true });
const jdk21 = inst("java", "21.0.12", "C:\\jdk21");

function uninstallPlan(extra: Partial<UninstallPlan> = {}): UninstallPlan {
  return {
    installation: jdk17,
    method: { kind: "recycleFolder" },
    usage: { processes: [], folderLocked: false },
    needsReplacement: true,
    replacements: [jdk21],
    affectedProfiles: [],
    gradleHint: false,
    noConfirmation: false,
    ...extra,
  };
}

const withUninstall = (extra: Partial<ToolsState["uninstall"]> = {}): ToolsState => {
  const s = initialToolsState();
  return { ...s, uninstall: { ...s.uninstall, plan: uninstallPlan(), ...extra } };
};

describe("reduce", () => {
  it("will not confirm an uninstall until the switch for that replacement is on screen", () => {
    const s = withUninstall();
    expect(reduce(s, { type: "confirmUninstall", replacementRoot: "C:\\jdk21", repoint: false })).toBe(s);
    const shown = withUninstall({ switchPlan: planFor(jdk21) });
    expect(reduce(shown, { type: "confirmUninstall", replacementRoot: "C:\\other", repoint: false })).toBe(shown);
    expect(reduce(shown, { type: "confirmUninstall", replacementRoot: "C:\\jdk21", repoint: false }).uninstall.busy).toBe(true);
  });

  it("picking another replacement drops the switch shown for the previous one", () => {
    const s = withUninstall({ switchPlan: planFor(jdk21) });
    expect(reduce(s, { type: "chooseReplacement", root: "C:\\jdk22" }).uninstall.switchPlan).toBeNull();
  });

  it("keeps a stale single-tool plan to rebuild it, and drops a stale profile plan", () => {
    const base = initialToolsState();
    const single = { ...base, plan: { ...base.plan, current: planFor(jdk21), applying: true } };
    const stale = { type: "applyFinished" as const, result: { planId: "p", stale: true, needsElevation: false } };
    const afterSingle = reduce(single, stale);
    expect(afterSingle.plan.current).not.toBeNull();
    expect(afterSingle.error).toMatch(/Environment changed/);

    const profile = { ...base, plan: { ...base.plan, current: planFor(jdk21, { additionalSelections: [jdk17] }) } };
    expect(reduce(profile, stale).plan.current).toBeNull();
  });

  it("building another plan abandons an update's switch, a stale rebuild does not", () => {
    const base = initialToolsState();
    const pending = { replacedRoot: "C:\\jdk21", installed: jdk17, repoint: null };
    const s = { ...base, update: { ...base.update, pending } };
    expect(reduce(s, { type: "buildPlan", root: "C:\\x" }).update.pending).toBeNull();
    expect(reduce(s, { type: "planCleanup" }).update.pending).toBeNull();
    expect(reduce(s, { type: "buildPlan", root: "C:\\jdk17", keepPending: true }).update.pending).toBe(pending);
  });

  it("drops a download size that arrives after another version was picked", () => {
    let s = reduce(initialToolsState(), { type: "chooseVersion", version: "22.1.0" });
    s = reduce(s, { type: "chooseVersion", version: "22.2.0" });
    s = reduce(s, { type: "versionSized", chosen: { version: "22.1.0", downloadBytes: 1 } });
    expect(s.install.chosen).toEqual({ version: "22.2.0", downloadBytes: null });
  });

  it("a failure ends only its own operation's busy flag", () => {
    let s = reduce(initialToolsState(), { type: "checkUpdates" });
    s = reduce(s, { type: "install" }); // nothing chosen: ignored
    s = reduce(s, { type: "chooseVersion", version: "22.2.0" });
    s = reduce(s, { type: "install" });
    s = reduce(s, { type: "failed", op: "install", error: "offline" });
    expect(s.install.busy).toBe(false);
    expect(s.update.busy).toBe(true);
    expect(s.error).toBe("offline");
  });

  it("switching tools clears the update list checked for the previous tool", () => {
    const base = initialToolsState();
    const s = { ...base, update: { ...base.update, list: [{ root: "C:\\jdk21", current: "21.0.12", latest: "21.0.13" }] } };
    const next = reduce(s, { type: "selectTool", tool: "node" });
    expect(next.tool).toBe("node");
    expect(next.update.list).toBeNull();
  });
});
