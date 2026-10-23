import type { VarScope } from "./varScope";

export interface UndoConflict {
  name: string;
  scope: VarScope;
  message: string;
}

export interface UndoResult {
  conflicts: UndoConflict[];
  restored: number;
}
