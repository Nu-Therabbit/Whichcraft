import type { TFunction } from "i18next";

/** A registry scope as the interface names it. Another account's scope shows its username instead. */
export function scopeLabel(t: TFunction, scope: string): string {
  if (scope === "User") return t("ui.scope_user");
  if (scope === "System") return t("ui.scope_system");
  return scope;
}
