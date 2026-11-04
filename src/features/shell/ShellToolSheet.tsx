import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { toolLogoVars, ToolLogo } from "../../components/ui/ToolLogo";
import { useI18n } from "../../hooks/useI18n";
import { usePresence } from "../../hooks/usePresence";
import type { ToolsState } from "../tools/model";
import type { ToolKind } from "../tools/types";
import type { ToolsDispatch } from "../tools/useToolsStore";
import { TOOL_DISPLAY, toolDescriptionKey } from "./overviewTools";
import { ShellInstallationDetail } from "./ShellInstallationDetail";
import { pickEffective, pickSelected } from "./toolOverviewModel";
import type { ToolOverviewSlice } from "./useToolsOverview";

interface Props {
  tool: ToolKind | null;
  slice: ToolOverviewSlice | null;
  state: ToolsState;
  dispatch: ToolsDispatch;
  /** A dialog is above the sheet, and Escape belongs to it first. */
  blocked: boolean;
  onClose: () => void;
  onInstall: (tool: ToolKind) => void;
  notice: ReactNode;
  onConfigureGit?: () => void;
}

function Stat({
  label,
  version,
  note,
  warn,
}: {
  label: string;
  version: string;
  note: string;
  warn?: boolean;
}) {
  return (
    <div className="shell-panel p-3">
      <h2 className="text-xs text-muted">{label}</h2>
      <p className={`shell-stat-value ${warn ? "text-warn" : ""}`}>{version}</p>
      <p className="truncate text-xs text-muted">{note}</p>
    </div>
  );
}

/** One tool, in a sheet that fills the workspace. The sidebar stays usable, so another tool opens from it directly. */
export function ShellToolSheet({
  tool,
  slice,
  state,
  dispatch,
  blocked,
  onClose,
  onInstall,
  notice,
  onConfigureGit,
}: Props) {
  const { t } = useI18n();
  const open = tool !== null;
  const presence = usePresence(open, 160);
  const lastTool = useRef(tool);
  const lastSlice = useRef(slice);
  if (tool) {
    lastTool.current = tool;
    lastSlice.current = slice;
  }
  const shown = tool ?? lastTool.current;
  const shownSlice = slice ?? lastSlice.current;
  const heading = useRef<HTMLHeadingElement>(null);

  // The sheet only exists once presence has mounted it, one commit after `open`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: another tool's sheet takes focus too
  useLayoutEffect(() => {
    if (open && presence.mounted) heading.current?.focus({ preventScroll: true });
  }, [open, presence.mounted, tool]);

  useEffect(() => {
    if (!open || blocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, blocked, onClose]);

  if (!presence.mounted || !shown || !shownSlice) return null;
  const effective = pickEffective(shownSlice.installations);
  const selected = pickSelected(shownSlice.installations);
  const mismatch = selected !== null && effective !== null && selected.root !== effective.root;
  return (
    <aside
      className="shell-tool-sheet"
      aria-label={t("desktop_shell.installation_details")}
      data-state={presence.state}
      data-tool={shown}
      style={toolLogoVars(shown)}
    >
      {/* Keyed here, so another tool starts at its own top rather than at the last tool's scroll position. */}
      <div key={shown} className="shell-sheet-scroll">
        <header className="shell-sheet-head">
          <span aria-hidden className="shell-card-mark" />
          <ToolLogo tool={shown} tile={44} size={30} />
          <div className="min-w-0 flex-1">
            <h1 ref={heading} tabIndex={-1} className="shell-sheet-title" translate="no">
              {TOOL_DISPLAY[shown].title}
            </h1>
            <p className="truncate text-muted">{t(toolDescriptionKey(shown))}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => dispatch({ type: "openTerminal" })}
            disabled={state.plan.applying}
          >
            {t("tools.open_terminal")}
          </Button>
          {shown === "git" && onConfigureGit && (
            <Button variant="secondary" onClick={onConfigureGit}>
              {t("configuration.configure_git")}
            </Button>
          )}
          <IconButton aria-label={t("desktop_shell.close_details")} icon="x" onClick={onClose} />
        </header>
        <div className="shell-sheet-body flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={t("desktop_shell.effective_installation")}
              version={effective?.version ?? "—"}
              note={effective?.vendor ?? t("desktop_shell.card_not_on_path")}
            />
            <Stat
              label={t("desktop_shell.selection")}
              version={selected?.version ?? "—"}
              warn={mismatch}
              note={selected?.vendor ?? t("desktop_shell.selection_none")}
            />
          </div>
          <ShellInstallationDetail
            tool={shown}
            state={state}
            dispatch={dispatch}
            onInstall={() => onInstall(shown)}
            notice={notice}
          />
        </div>
      </div>
    </aside>
  );
}
