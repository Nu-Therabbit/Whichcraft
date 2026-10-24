import { useEffect } from "react";

/** `undoLocal` undoes an in-progress local edit and returns true, or returns false when there is none. */
export function useKeyboardShortcuts(undo: () => void, redo: () => void, undoLocal: () => boolean) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "z" && !e.shiftKey && undoLocal()) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, undoLocal]);
}
