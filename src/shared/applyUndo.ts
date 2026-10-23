import type { VarScope } from "../features/environment/types";

export interface UndoConflict {
  name: string;
  scope: VarScope;
  message: string;
}

export interface UndoResult {
  conflicts: UndoConflict[];
  restored: number;
}
