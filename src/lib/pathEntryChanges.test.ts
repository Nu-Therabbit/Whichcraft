import { describe, expect, it } from "vitest";
import { pathEntryChanges } from "./pathEntryChanges";

describe("pathEntryChanges", () => {
  it("lists the entry a switch adds and the old one it removes", () => {
    expect(pathEntryChanges("C:\\jdk17\\bin;C:\\u", "C:\\jdk21\\bin;C:\\u")).toEqual({
      added: ["C:\\jdk21\\bin"],
      removed: ["C:\\jdk17\\bin"],
    });
  });

  it("ignores case, trailing slashes and empty segments", () => {
    expect(pathEntryChanges("C:\\Tools\\;;c:\\u", "c:\\tools;C:\\U")).toEqual({ added: [], removed: [] });
  });

  it("shows each dropped duplicate", () => {
    expect(pathEntryChanges("C:\\go\\bin;C:\\x;C:\\go\\bin\\", "C:\\go\\bin;C:\\x")).toEqual({
      added: [],
      removed: ["C:\\go\\bin\\"],
    });
  });

  it("treats a missing value as empty", () => {
    expect(pathEntryChanges(null, "C:\\a")).toEqual({ added: ["C:\\a"], removed: [] });
  });
});
