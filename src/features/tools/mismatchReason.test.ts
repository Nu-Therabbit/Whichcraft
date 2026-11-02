import i18n from "i18next";
import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import { mismatchReasonText } from "./mismatchReason";

describe("mismatchReasonText", () => {
  it("translates the reason codes the backend sends", () => {
    expect(
      mismatchReasonText("system_path_may_shadow: effective java is not this installation", i18n.t),
    ).toBe(en.desktop_shell.mismatch_reason_system_path_may_shadow);
    expect(
      mismatchReasonText("unavailable: the selected installation's folder is missing", i18n.t),
    ).toBe(en.desktop_shell.mismatch_reason_unavailable);
  });

  it("shows an unknown reason as sent", () => {
    expect(mismatchReasonText("Folder missing", i18n.t)).toBe("Folder missing");
  });
});
