import { describe, expect, it, vi } from "vitest";
import { createWriteCoordinator } from "./createWriteCoordinator";
import { ENVIRONMENT_PENDING_TOOLS_MESSAGE, WRITE_BUSY_MESSAGE } from "./types";

describe("createWriteCoordinator", () => {
  it("blocks conflicting tool writes while environment edits are pending", () => {
    const coordination = createWriteCoordinator();
    coordination.setEnvironmentPending(true);
    const gate = coordination.tryBeginToolsWrite("apply-plan");
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toBe(ENVIRONMENT_PENDING_TOOLS_MESSAGE);
  });

  it("allows tool writes after pending environment edits are cleared", () => {
    const coordination = createWriteCoordinator();
    coordination.setEnvironmentPending(true);
    coordination.setEnvironmentPending(false);
    const gate = coordination.tryBeginToolsWrite("apply-plan");
    expect(gate.ok).toBe(true);
    if (gate.ok) coordination.endToolsWrite(gate.admission, "cancel");
  });

  it("serializes environment and tool writes and releases admission on end", () => {
    const coordination = createWriteCoordinator();
    const env = coordination.tryBeginEnvironmentWrite("apply-staged");
    expect(env.ok).toBe(true);
    const blocked = coordination.tryBeginToolsWrite("apply-plan");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe(WRITE_BUSY_MESSAGE);
    if (env.ok) coordination.endEnvironmentWrite(env.admission, "failure");
    const tools = coordination.tryBeginToolsWrite("undo");
    expect(tools.ok).toBe(true);
    if (tools.ok) coordination.endToolsWrite(tools.admission, "success");
  });

  it("drops stale tool reads after invalidation", () => {
    const coordination = createWriteCoordinator();
    const binding = coordination.beginToolsRead("java");
    coordination.invalidate(["tools-installations"]);
    expect(coordination.isToolsReadCurrent(binding)).toBe(false);
  });

  it("drops a slower inventory read superseded at the same revision", () => {
    const coordination = createWriteCoordinator();
    const first = coordination.beginToolsRead("java");
    const second = coordination.beginToolsRead("java");
    expect(coordination.isToolsReadCurrent(first)).toBe(false);
    expect(coordination.isToolsReadCurrent(second)).toBe(true);
  });

  it("notifies invalidation subscribers and bumps plan binding on account change", () => {
    const coordination = createWriteCoordinator();
    const listener = vi.fn();
    coordination.subscribeInvalidation(listener);
    const plan = coordination.beginPlanApply("plan-a");
    coordination.notifyAccountContextChanged("S-1-5-21");
    expect(listener).toHaveBeenCalled();
    expect(coordination.isPlanApplyCurrent(plan)).toBe(false);
  });
});
