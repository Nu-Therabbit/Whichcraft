import { useI18n } from "../../hooks/useI18n";
import { pathEntryChanges } from "../../lib/pathEntryChanges";
import type { ToolApplyPlan } from "../../types";

/** A PATH change as the entries it adds and removes; the whole value is too long to compare by eye. */
function PathEntryDiff({ before, after }: { before: string | null; after: string }) {
  const { added, removed } = pathEntryChanges(before, after);
  return (
    <ul className="text-xs wrap-anywhere">
      {added.map((e) => (
        <li key={`+${e}`} className="text-success">
          + {e}
        </li>
      ))}
      {removed.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a removed entry can repeat
        <li key={`-${e}-${i}`} className="text-danger line-through">
          − {e}
        </li>
      ))}
    </ul>
  );
}

/** What a plan writes: UAC note, warnings and every variable it changes. */
export function PlanDiffList({ plan }: { plan: ToolApplyPlan }) {
  const { t } = useI18n();
  return (
    <>
      {plan.requiresUac && <p className="text-xs text-warn">{t("tools.uac_required")}</p>}
      {plan.warnings.map((w) => (
        <p key={w} className="text-xs text-warn">
          {w}
        </p>
      ))}
      <p className="text-xs text-muted">{plan.limitationNotice}</p>
      <ul className="text-sm font-mono space-y-2">
        {[...plan.userDiffs, ...plan.systemDiffs].map((d) => (
          <li key={`${d.scope}-${d.name}`}>
            <span className="text-muted">
              {d.scope} {d.name}
            </span>
            {d.name.toLowerCase() === "path" ? (
              <PathEntryDiff before={d.before} after={d.after} />
            ) : (
              <>
                <div className="text-xs text-danger line-through wrap-anywhere">{d.before ?? "(empty)"}</div>
                <div className="text-xs text-success wrap-anywhere">{d.after}</div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
