import { useState } from "react";
import type { ToolInstallationView } from "../tools/types";

/** The root that just became effective, so its row can mark the switch. */
export function useArrival(items: ToolInstallationView[]): string | null {
  const root = items.find((item) => item.effective)?.root ?? null;
  const [last, setLast] = useState(root);
  const [arrived, setArrived] = useState<string | null>(null);
  // The first scan arriving is not a switch, so it must not play the arrival.
  if (last !== root) {
    setLast(root);
    if (last !== null && root !== null) setArrived(root);
  }
  return arrived;
}
