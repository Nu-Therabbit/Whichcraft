import { describe, expect, it } from "vitest";
import { inst } from "../../test/toolsTestHarness";
import { byVersion, scanHealth } from "./toolOverviewModel";

const slice = (overrides: Partial<Parameters<typeof scanHealth>[0]>) => ({
  loading: false,
  error: null,
  installations: [],
  boundRequestId: 1,
  ...overrides,
});

describe("scanHealth", () => {
  it("has nothing to show until the first scan finishes", () => {
    expect(scanHealth(slice({ boundRequestId: 0 }))).toBe("loading");
    expect(scanHealth(slice({ boundRequestId: 0, loading: true }))).toBe("loading");
  });

  it("keeps the last result on screen during a rescan", () => {
    const installations = [inst("java", "21.0.1", "C:\\jdk21", { effective: true, selected: true })];
    expect(scanHealth(slice({ loading: true, installations }))).toBe("ok");
  });

  it("keeps a difference from the Selection in view during a rescan", () => {
    const installations = [
      inst("java", "21.0.1", "C:\\effective", { effective: true }),
      inst("java", "17.0.1", "C:\\selected", { selected: true }),
    ];
    expect(scanHealth(slice({ loading: true, installations }))).toBe("mismatch");
  });

  it("reports a failed scan even when an earlier one found installations", () => {
    const installations = [inst("java", "21.0.1", "C:\\jdk21", { effective: true })];
    expect(scanHealth(slice({ error: "offline", installations }))).toBe("error");
  });
});

describe("byVersion", () => {
  it("orders versions numerically, not as text", () => {
    const sorted = byVersion([inst("java", "21.0.1", "C:\\a"), inst("java", "8.0.1", "C:\\b"), inst("java", "11.0.2", "C:\\c")]);
    expect(sorted.map((item) => item.version)).toEqual(["8.0.1", "11.0.2", "21.0.1"]);
  });
});
