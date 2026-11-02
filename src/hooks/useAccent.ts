import { useState } from "react";
import { type Accent, applyAccentToDocument, getInitialAccent } from "../lib/themeDocument";

export function useAccent() {
  const [accent, setAccentState] = useState<Accent>(getInitialAccent);

  const setAccent = (next: Accent) => {
    setAccentState(next);
    applyAccentToDocument(next);
    try {
      localStorage.setItem("whichcraft-accent", next);
    } catch {
      // Blocked storage only means the choice is not remembered.
    }
  };

  return { accent, setAccent };
}
