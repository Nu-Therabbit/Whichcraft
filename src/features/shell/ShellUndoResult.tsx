import { Button } from "../../components/ui/Button";
import { useI18n } from "../../hooks/useI18n";
import type { ToolsState } from "../tools/model";
import type { ToolsDispatch } from "../tools/useToolsStore";

/** What the last Undo restored, or which values it left alone because they changed since. */
export function ShellUndoResult({ state, dispatch }: { state: ToolsState; dispatch: ToolsDispatch }) {
  const { t } = useI18n();
  const result = state.plan.undoResult;
  if (!result) return null;
  return (
    <div className="text-xs border border-rim-subtle rounded-md px-3 py-2 space-y-1">
      {result.conflicts.length > 0 ? (
        <>
          <p className="text-warn font-medium">{t("desktop_shell.undo_conflicts")}</p>
          <ul className="list-disc pl-4 text-dim">
            {result.conflicts.map((c) => (
              <li key={`${c.scope}-${c.name}`}>
                {c.scope} {c.name}: {c.message}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-success">{t("desktop_shell.undo_restored", { count: result.restored })}</p>
      )}
      <Button variant="ghost" size="xs" onClick={() => dispatch({ type: "clearUndoResult" })}>
        {t("desktop_shell.dismiss_undo_result")}
      </Button>
    </div>
  );
}
