import { describe, expect, it } from "vitest";
import type { EnvSnapshot, EnvVar } from "../types";
import { computeStageImport, computeStageSnapshot, stagedKey } from "./stagingLogic";

const registryVars: EnvVar[] = [
  {
    name: "KEEP",
    value: "current",
    valueKind: "String",
    scope: "User",
    listSeparator: null,
  },
  {
    name: "REMOVE",
    value: "gone",
    valueKind: "String",
    scope: "User",
    listSeparator: null,
  },
  {
    name: "KINDONLY",
    value: "same",
    valueKind: "String",
    scope: "User",
    listSeparator: null,
  },
];

const registryByKey = new Map(registryVars.map((v) => [stagedKey(v.name, v.scope), v]));

const snap: EnvSnapshot = {
  user: {
    KEEP: { value: "saved", kind: "String" },
    NEW: { value: "x", kind: "String" },
    KINDONLY: { value: "same", kind: "ExpandString" },
  },
  system: {},
};

describe("computeStageImport", () => {
  it("drops orphan pending edits when replacing staged work", () => {
    const prev = new Map([
      [
        stagedKey("ORPHAN", "User"),
        {
          kind: "set" as const,
          name: "ORPHAN",
          scope: "User" as const,
          originalValue: null,
          originalValueKind: null,
          newValue: "pending",
          newValueKind: "String" as const,
        },
      ],
    ]);
    const sets = [{ name: "IMPORTED", scope: "User" as const, value: "from-file", valueKind: "String" as const }];
    const merged = computeStageImport(registryByKey, prev, sets, [], false);
    expect(merged.has(stagedKey("ORPHAN", "User"))).toBe(true);
    const replaced = computeStageImport(registryByKey, prev, sets, [], true);
    expect(replaced.has(stagedKey("ORPHAN", "User"))).toBe(false);
    expect(replaced.get(stagedKey("IMPORTED", "User"))?.newValue).toBe("from-file");
  });
});

describe("computeStageSnapshot", () => {
  it("stages deletes and value-kind changes toward the snapshot", () => {
    const next = computeStageSnapshot(registryByKey, registryVars, new Map(), snap);
    expect(next.get(stagedKey("REMOVE", "User"))?.kind).toBe("delete");
    expect(next.get(stagedKey("KINDONLY", "User"))?.newValueKind).toBe("ExpandString");
    expect(next.get(stagedKey("NEW", "User"))?.kind).toBe("set");
  });

  it("drops orphan pending edits when replacing staged work", () => {
    const prev = new Map([
      [
        stagedKey("ORPHAN", "User"),
        {
          kind: "set" as const,
          name: "ORPHAN",
          scope: "User" as const,
          originalValue: null,
          originalValueKind: null,
          newValue: "pending",
          newValueKind: "String" as const,
        },
      ],
    ]);
    const merged = computeStageSnapshot(registryByKey, registryVars, prev, snap, false);
    expect(merged.has(stagedKey("ORPHAN", "User"))).toBe(true);

    const replaced = computeStageSnapshot(registryByKey, registryVars, prev, snap, true);
    expect(replaced.has(stagedKey("ORPHAN", "User"))).toBe(false);
    expect(replaced.get(stagedKey("REMOVE", "User"))?.kind).toBe("delete");
  });
});
