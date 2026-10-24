import { describe, expect, it, vi } from "vitest";
import { createWriteCoordinator } from "../../coordination/createWriteCoordinator";
import type { CheckCommandResult } from "../../types";
import type { EnvironmentApi } from "./api";
import { resolveCheckCommand } from "./checkCommandSession";

const hitResult = (input: string): CheckCommandResult => ({
  input,
  queriedName: input,
  hadExtension: true,
  hits: [{ directory: "C:\\Windows", matchedFile: input, source: "System" }],
  fullPathStatus: null,
});

const spawnProbe = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnProbe(...args),
  exec: (...args: unknown[]) => spawnProbe(...args),
  execFile: (...args: unknown[]) => spawnProbe(...args),
}));

function minimalEnv(checkCommand: EnvironmentApi["checkCommand"]): EnvironmentApi {
  return { checkCommand } as EnvironmentApi;
}

describe("resolveCheckCommand", () => {
  it("resolveCheckCommand does not execute the typed input", async () => {
    spawnProbe.mockClear();
    const checkCommand = vi.fn(async (input: string) => hitResult(input));
    const coordination = createWriteCoordinator();
    const result = await resolveCheckCommand(
      minimalEnv(checkCommand),
      coordination,
      "wc-exec-probe-token.exe",
    );
    expect(checkCommand).toHaveBeenCalledWith("wc-exec-probe-token.exe");
    expect(result?.hits[0]?.matchedFile).toBe("wc-exec-probe-token.exe");
    expect(spawnProbe).not.toHaveBeenCalled();
  });

  it("drops a stale success when environment invalidates before resolve", async () => {
    let release: (value: CheckCommandResult) => void = () => {};
    const checkCommand = vi.fn(
      () =>
        new Promise<CheckCommandResult>((resolve) => {
          release = resolve;
        }),
    );
    const coordination = createWriteCoordinator();
    const pending = resolveCheckCommand(minimalEnv(checkCommand), coordination, "node.exe");
    coordination.invalidate(["environment-variables"]);
    release(hitResult("node.exe"));
    await expect(pending).resolves.toBeNull();
  });

  it("drops a stale failure when environment invalidates before reject", async () => {
    let rejectLate: (error: Error) => void = () => {};
    const checkCommand = vi.fn(
      () =>
        new Promise<CheckCommandResult>((_, reject) => {
          rejectLate = reject;
        }),
    );
    const coordination = createWriteCoordinator();
    const pending = resolveCheckCommand(minimalEnv(checkCommand), coordination, "node.exe");
    coordination.invalidate(["environment-variables"]);
    rejectLate(new Error("backend boom"));
    await expect(pending).resolves.toBeNull();
  });
});
