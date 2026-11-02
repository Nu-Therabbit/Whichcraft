import { useThemeContext } from "../../context/ThemeContext";
import { useI18n } from "../../hooks/useI18n";
import { scopeLabel } from "../../lib/scopeLabel";
import { useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { cn } from "../../lib/cn";
import type { DiffEntry } from "../../lib/diff";
import { registryKindLabel } from "../../lib/envValueKind";
import { Icon } from "../ui/Icon";

const KIND_LABEL: Record<DiffEntry["kind"], string> = {
  added: "ui.kind_added",
  removed: "ui.kind_removed",
  changed: "ui.kind_changed",
};

const DIFF_COLORS = {
  diffViewerBackground: "var(--color-surface)",
  diffViewerColor: "var(--color-fg)",
  addedBackground: "color-mix(in srgb, var(--color-success) 14%, transparent)",
  addedColor: "var(--color-success)",
  removedBackground: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
  removedColor: "var(--color-danger)",
  wordAddedBackground: "color-mix(in srgb, var(--color-success) 24%, transparent)",
  wordRemovedBackground: "color-mix(in srgb, var(--color-danger) 24%, transparent)",
  addedGutterBackground: "color-mix(in srgb, var(--color-success) 14%, transparent)",
  removedGutterBackground: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
  addedGutterColor: "var(--color-success)",
  removedGutterColor: "var(--color-danger)",
  gutterBackground: "var(--color-surface)",
  gutterBackgroundDark: "var(--color-surface)",
  gutterColor: "var(--color-muted)",
  emptyLineBackground: "var(--color-surface)",
  highlightBackground: "var(--color-hover)",
  highlightGutterBackground: "var(--color-hover)",
  codeFoldBackground: "var(--color-hover)",
  codeFoldGutterBackground: "var(--color-hover)",
  codeFoldContentColor: "var(--color-muted)",
  diffViewerTitleBackground: "var(--color-hover)",
  diffViewerTitleColor: "var(--color-muted)",
  diffViewerTitleBorderColor: "var(--color-rim-subtle)",
};

const KIND_COLORS: Record<DiffEntry["kind"], string> = {
  added: "text-success border-success/30 bg-success/5",
  removed: "text-danger border-danger/30 bg-danger/5",
  changed: "text-warn border-warn/30 bg-warn/5",
};

const KIND_DOT: Record<DiffEntry["kind"], string> = {
  added: "bg-success",
  removed: "bg-danger",
  changed: "bg-warn",
};

function pathLines(value: string) {
  return value.split(";").join("\n");
}

function isLongOrPath(entry: DiffEntry): boolean {
  const val = entry.kind === "changed" ? entry.oldValue : entry.value;
  return val.includes(";") || val.length > 80;
}

interface EntryRowProps {
  entry: DiffEntry;
  accepted: boolean;
  onToggle: () => void;
}

export function EntryRow({ entry, accepted, onToggle }: EntryRowProps) {
  const { t } = useI18n();
  const dark = useThemeContext() === "dark";
  const [expanded, setExpanded] = useState(false);
  const showDiff = entry.kind === "changed" && isLongOrPath(entry);
  const showExpand = isLongOrPath(entry);

  const displayOld =
    entry.kind === "changed" ? entry.oldValue : entry.kind === "removed" ? entry.value : "";
  const displayNew =
    entry.kind === "changed" ? entry.newValue : entry.kind === "added" ? entry.value : "";

  return (
    <div
      className={cn(
        "rounded border transition-opacity",
        KIND_COLORS[entry.kind],
        !accepted && "border-dashed",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          type="checkbox"
          checked={accepted}
          onChange={onToggle}
          className="shrink-0 accent-accent w-3.5 h-3.5 cursor-pointer"
          aria-label={`${t(KIND_LABEL[entry.kind])} ${entry.name}`}
        />
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", KIND_DOT[entry.kind])} />
        <span className="font-mono text-xs font-semibold text-fg truncate flex-1">
          {entry.name}
        </span>
        <span className="text-xs uppercase tracking-wide font-semibold shrink-0">
          {scopeLabel(t, entry.scope)}
        </span>
        <span
          className={cn(
            "text-xs uppercase tracking-wide font-semibold shrink-0 px-2 py-1 rounded",
            KIND_COLORS[entry.kind],
          )}
        >
          {t(KIND_LABEL[entry.kind])}
        </span>
        {showExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={t(expanded ? "ui.collapse_entry" : "ui.expand_entry", { name: entry.name })}
            aria-expanded={expanded}
            className="text-dim hover:text-fg text-xs shrink-0 transition-colors"
          >
            <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
          </button>
        )}
      </div>

      {!showExpand && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {entry.kind === "changed" && entry.oldValueKind !== entry.newValueKind && (
            <p className="font-mono text-xs text-muted">
              {registryKindLabel(entry.oldValueKind)} → {registryKindLabel(entry.newValueKind)}
            </p>
          )}
          {(entry.kind === "removed" || entry.kind === "changed") && (
            <p className="font-mono text-xs text-danger line-through truncate">{displayOld}</p>
          )}
          {(entry.kind === "added" || entry.kind === "changed") && (
            <p className="font-mono text-xs text-success truncate">{displayNew}</p>
          )}
        </div>
      )}

      {showExpand && expanded && (
        <div className="px-3 pb-3">
          {showDiff ? (
            <div className="rounded overflow-hidden text-xs">
              <ReactDiffViewer
                oldValue={pathLines(displayOld)}
                newValue={pathLines(displayNew)}
                splitView={false}
                compareMethod={DiffMethod.LINES}
                useDarkTheme={dark}
                hideLineNumbers
                styles={{ variables: { dark: DIFF_COLORS, light: DIFF_COLORS } }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {displayOld && (
                <p className="font-mono text-xs text-danger line-through break-all">
                  {displayOld}
                </p>
              )}
              {displayNew && (
                <p className="font-mono text-xs text-success break-all">{displayNew}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
