import type { TFunction } from "i18next";

/** The backend reports `code: English detail`. A code this build doesn't know shows as sent. */
export function mismatchReasonText(reason: string, t: TFunction): string {
  switch (reason.split(":", 1)[0]) {
    case "system_path_may_shadow":
      return t("desktop_shell.mismatch_reason_system_path_may_shadow");
    case "unavailable":
      return t("desktop_shell.mismatch_reason_unavailable");
    default:
      return reason;
  }
}
