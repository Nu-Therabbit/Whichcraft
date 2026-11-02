import { useI18n } from "../../hooks/useI18n";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { usePresence } from "../../hooks/usePresence";
import { cn } from "../../lib/cn";
import { IconButton } from "./IconButton";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  size?: "md" | "lg" | "xl" | "2xl";
  /** Make the body a flex column instead of overflow-y-auto. Use for panels that manage their own scrolling. */
  flex?: boolean;
  children: ReactNode;
}

type Props = BaseProps &
  ({ title: string; ariaLabel?: never } | { title?: undefined; ariaLabel: string });

const sizeCls = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-[900px]",
};

// An unchecked radio in a checked group is not a tab stop, so it can't be the end of the cycle.
const TABBABLE =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="radio"]:not(:checked)), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function tabbableIn(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.checkVisibility?.() ?? true,
  );
}

export function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  size = "lg",
  flex = false,
  children,
}: Props) {
  const titleId = useId();
  const presence = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);

  const { t } = useI18n();
  const returnFocusRef = useRef<Element | null>(null);

  // Layout effects run before a child's own effect, which may focus its first field.
  useLayoutEffect(() => {
    if (open) returnFocusRef.current = document.activeElement;
  }, [open]);

  // A passive cleanup, because React restores the prior focus after a commit's layout cleanups.
  useEffect(() => {
    if (!open) return;
    return () => {
      // Leave focus alone if the action that closed the dialog already moved it somewhere else.
      const active = document.activeElement;
      if (active && active !== document.body && !active.closest('[aria-modal="true"]')) return;
      const returnTo = returnFocusRef.current;
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus();
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open && presence.mounted && !panelRef.current?.contains(document.activeElement)) {
      panelRef.current?.focus();
    }
  }, [open, presence.mounted]);

  const keepTabInside = (e: ReactKeyboardEvent) => {
    const panel = panelRef.current;
    if (e.key !== "Tab" || !panel?.contains(e.target as Node)) return;
    const tabbable = tabbableIn(panel);
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    if (!first) {
      e.preventDefault();
    } else if (e.shiftKey && (e.target === first || e.target === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && e.target === last) {
      e.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!presence.mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-6",
        presence.state === "closed" && "pointer-events-none",
      )}
      data-state={presence.state}
      role="dialog"
      aria-modal="true"
      aria-label={title ? undefined : ariaLabel}
      aria-labelledby={title ? titleId : undefined}
      onKeyDown={keepTabInside}
    >
      {/* Backdrop */}
      <div
        className="motion-modal-backdrop absolute inset-0"
        data-state={presence.state}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full flex flex-col bg-canvas border border-rim rounded-panel shadow-xl focus:outline-none",
          "max-h-[85vh] overflow-hidden",
          "motion-modal-panel",
          sizeCls[size],
        )}
        data-state={presence.state}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-rim shrink-0">
            <h2 id={titleId} className="text-base font-semibold text-fg">
              {title}
            </h2>
            <IconButton aria-label={t("ui.close")} icon="x" onClick={onClose} />
          </div>
        )}
        <div className={flex ? "flex-1 min-h-0 flex flex-col" : "flex-1 overflow-y-auto"}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
