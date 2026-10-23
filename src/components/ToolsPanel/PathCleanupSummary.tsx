import { useI18n } from "../../hooks/useI18n";

interface Props {
  duplicates: string[];
  missing: string[];
  /** The cleanup plan is on screen waiting to be applied. */
  pending: boolean;
}

/** Why each User PATH entry is proposed for removal; the diff below it is what gets applied. */
export function PathCleanupSummary({ duplicates, missing, pending }: Props) {
  const { t } = useI18n();
  if (duplicates.length === 0 && missing.length === 0) {
    return <p className="text-sm text-muted">{t("tools.cleanup.clean")}</p>;
  }
  if (!pending) return null;
  return (
    <section className="border border-rim rounded-md p-4 flex flex-col gap-2 text-sm">
      <h3 className="font-semibold">{t("tools.cleanup.title")}</h3>
      {duplicates.length > 0 && (
        <div>
          <p>{t("tools.cleanup.duplicates")}</p>
          <ul className="list-disc pl-5 font-mono text-xs">
            {duplicates.map((d, i) => (
              // The same entry can repeat several times.
              // biome-ignore lint/suspicious/noArrayIndexKey: entries are not unique
              <li key={`${d}-${i}`}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <p>{t("tools.cleanup.missing")}</p>
          <ul className="list-disc pl-5 font-mono text-xs">
            {missing.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: entries are not unique
              <li key={`${m}-${i}`}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted">{t("tools.cleanup.review")}</p>
    </section>
  );
}
