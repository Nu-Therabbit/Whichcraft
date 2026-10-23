import { useI18n } from "../../hooks/useI18n";
import type { UpdateCandidate } from "../../types";
import { Button } from "../ui/Button";

interface Props {
  updates: UpdateCandidate[];
  busy: boolean;
  /** Set once a newer release is installed and its switch plan is shown. */
  awaitingSwitch: boolean;
  onUpdate: (candidate: UpdateCandidate) => void;
}

/** Newer releases in the same line; updating installs beside the old one, then switches (P-1). */
export function UpdateList({ updates, busy, awaitingSwitch, onUpdate }: Props) {
  const { t } = useI18n();
  return (
    <section className="border border-rim rounded-md p-4 flex flex-col gap-2 text-sm">
      <h3 className="font-semibold">{t("tools.updates.title")}</h3>
      {awaitingSwitch && <p className="text-xs text-muted">{t("tools.updates.next")}</p>}
      {updates.length === 0 ? (
        <p className="text-muted">{t("tools.updates.none")}</p>
      ) : (
        <ul className="divide-y divide-rim">
          {updates.map((u) => (
            <li key={u.root} className="flex items-center gap-3 py-2">
              <div className="flex-1 flex flex-col">
                <span className="font-mono">{t("tools.updates.row", { current: u.current, latest: u.latest })}</span>
                <span className="text-xs text-muted font-mono break-all">{u.root}</span>
              </div>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => onUpdate(u)}>
                {busy ? t("tools.updates.updating") : t("tools.updates.update")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
