import { type Ref, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { useI18n } from "../../hooks/useI18n";
import { isSingleToolPlan, type ToolsState } from "../tools/model";
import type { ToolApplyPlan, ToolInstallationRef } from "../tools/types";
import type { ToolsDispatch } from "../tools/useToolsStore";
import { TOOL_DISPLAY } from "./overviewTools";
import { pickEffective } from "./toolOverviewModel";

/** What a finished Apply changed, offered for Undo until it is dismissed or the tool changes. */
export function useAppliedVersion(state: ToolsState) {
  const { plan, tool } = state;
  const [applied, setApplied] = useState<ToolInstallationRef | null>(null);
  // Undo also runs as `applying`, but with no plan on screen, so it never counts here.
  const applying = useRef<ToolApplyPlan | null>(null);

  useEffect(() => {
    if (plan.applying) {
      if (plan.current && plan.current.tool === tool && isSingleToolPlan(plan.current) && plan.source !== "profile") applying.current = plan.current;
      return;
    }
    // The sheet can have moved to another tool while the Apply was running, and this result is not that tool's.
    if (applying.current?.tool === tool && !plan.current && !state.error) setApplied(applying.current.selected);
    applying.current = null;
  }, [plan.applying, plan.current, plan.source, state.error, tool]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: another tool has its own result
  useEffect(() => setApplied(null), [tool]);

  return [applied, setApplied] as const;
}

export function ShellAppliedNotice({ applied, state, dispatch, onClose, ref }: { applied: ToolInstallationRef; state: ToolsState; dispatch: ToolsDispatch; onClose: () => void; ref?: Ref<HTMLDivElement> }) {
  const { t } = useI18n();
  return (
    <div ref={ref} tabIndex={-1} aria-live="polite" className="shell-banner" data-tone="ok">
      <span className="shell-banner-tile text-accent">
        <Icon name="check" size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 font-medium">
        {/* An Apply can succeed and Windows still resolve elsewhere, so this says what the readback found. */}
        {t(pickEffective(state.installations)?.root === applied.root ? "desktop_shell.applied_notice" : "desktop_shell.applied_not_effective", {
          tool: TOOL_DISPLAY[state.tool].title,
          version: applied.version,
        })}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={state.plan.applying}
        onClick={() => {
          onClose();
          dispatch({ type: "undoLast" });
        }}
      >
        {t("desktop_shell.undo_short")}
      </Button>
      <IconButton aria-label={t("desktop_shell.dismiss_undo_result")} icon="x" onClick={onClose} />
    </div>
  );
}
