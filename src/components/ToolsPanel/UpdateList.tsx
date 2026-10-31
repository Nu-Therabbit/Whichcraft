import { useI18n } from "../../hooks/useI18n";
import type { UpdateCandidate } from "../../types";
import { Button } from "../ui/Button";
import { StoreConfirm } from "./StoreConfirm";

interface Props {
  updates: UpdateCandidate[];
  busy: boolean;
  /** Set once a newer release is installed and its switch plan is shown. */
  awaitingSwitch: boolean;
  onUpdate: (candidate: UpdateCandidate) => void;
  /** Where installs go; until it is confirmed nothing is downloaded (I-5). */
  store: { confirmed: boolean; installStore: string; onConfirm: (store: string) => void };
  /** Profiles that use the version being replaced; moved to the new one with the switch (F-5). */
  repoint?: { names: string[]; checked: boolean; onToggle: (checked: boolean) => void } | null;
}

/** Newer releases in the same line; updating installs beside the old one, then switches (P-1). */
export function UpdateList({ updates, busy, awaitingSwitch, onUpdate, store, repoint }: Props) {
  const { t } = useI18n();
  return (
    <section className="border border-rim rounded-md p-4 flex flex-col gap-2 text-sm">
      <h3 className="font-semibold">{t("tools.updates.title")}</h3>
      {awaitingSwitch && <p className="text-xs text-muted">{t("tools.updates.next")}</p>}
      {awaitingSwitch && repoint && repoint.names.length > 0 && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={repoint.checked} onChange={(e) => repoint.onToggle(e.target.checked)} />
          <span>{t("tools.updates.repoint", { names: repoint.names.join(", ") })}</span>
        </label>
      )}
      {updates.length > 0 && !store.confirmed && (
        <StoreConfirm installStore={store.installStore} busy={busy} onConfirmStore={store.onConfirm} />
      )}
      {updates.length === 0 ? (
        <p className="text-muted">{t("tools.updates.none")}</p>
      ) : (
        <ul className="divide-y divide-rim">
          {updates.map((u) => (
            <li key={u.root} className="flex items-center gap-3 py-2">
              <div className="flex-1 flex flex-col">
                <span className="font-mono">{t("tools.updates.row", { current: u.current, latest: u.latest })}</span>
                <span className="text-xs text-muted font-mono wrap-anywhere">{u.root}</span>
              </div>
              <Button variant="secondary" size="sm" disabled={busy || !store.confirmed} onClick={() => onUpdate(u)}>
                {busy ? t("tools.updates.updating") : t("tools.updates.update")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
