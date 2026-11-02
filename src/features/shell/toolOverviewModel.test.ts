import { describe, expect, it } from "vitest";
import { inst } from "../../test/toolsTestHarness";
import { byVersion, cardLines, scanHealth } from "./toolOverviewModel";

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

describe("cardLines", () => {
  const main = (installations: Parameters<typeof cardLines>[0]) => cardLines(installations).main?.version;

  it("shows only what Windows uses when the Selection matches, and counts the rest", () => {
    const installations = [
      inst("java", "17.0.1", "C:\\a"),
      inst("java", "21.0.1", "C:\\b", { effective: true, selected: true }),
      inst("java", "11.0.1", "C:\\c"),
    ];
    expect(main(installations)).toBe("21.0.1");
    expect(cardLines(installations).selection).toBeNull();
    expect(cardLines(installations).hidden).toBe(2);
  });

  it("never hides a Selection that differs from what Windows uses", () => {
    const installations = [
      inst("java", "17.0.1", "C:\\a"),
      inst("java", "21.0.1", "C:\\b", { effective: true }),
      inst("java", "21.0.2", "C:\\c", { selected: true }),
      inst("java", "21.0.3", "C:\\d"),
    ];
    expect(main(installations)).toBe("21.0.1");
    expect(cardLines(installations).selection?.version).toBe("21.0.2");
    expect(cardLines(installations).hidden).toBe(2);
  });

  it("shows the Selection when nothing is on PATH", () => {
    expect(main([inst("python", "3.14.1", "C:\\a"), inst("python", "3.12.1", "C:\\b", { selected: true })])).toBe("3.12.1");
  });

  it("falls back to the newest usable version, numerically", () => {
    expect(main([inst("go", "1.9.0", "C:\\a"), inst("go", "1.27.0", "C:\\b"), inst("go", "1.30.0", "C:\\c", { available: false })])).toBe("1.27.0");
  });

  it("still shows an installation when none is usable", () => {
    expect(main([inst("go", "1.9.0", "C:\\a", { available: false })])).toBe("1.9.0");
  });

  it("has nothing to show when nothing is installed", () => {
    expect(cardLines([])).toEqual({ main: null, selection: null, hidden: 0 });
  });
});

describe("byVersion", () => {
  it("orders versions numerically, not as text", () => {
    const sorted = byVersion([inst("java", "21.0.1", "C:\\a"), inst("java", "8.0.1", "C:\\b"), inst("java", "11.0.2", "C:\\c")]);
    expect(sorted.map((item) => item.version)).toEqual(["8.0.1", "11.0.2", "21.0.1"]);
  });
});
