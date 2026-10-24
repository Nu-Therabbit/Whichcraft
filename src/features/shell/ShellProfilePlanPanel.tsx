import type { ToolsDispatch } from "../tools/useToolsStore";
import type { ToolsState } from "../tools/model";
import { ShellPlanReview } from "./ShellPlanReview";

/** Profile plans remain visible independently of the inspected tool. */
export function ShellProfilePlanPanel({ state, dispatch }: { state: ToolsState; dispatch: ToolsDispatch }) {
  const { plan } = state;
  if (!plan.current || plan.source !== "profile") return null;
  return <ShellPlanReview current={plan.current} applying={plan.applying} building={plan.building} dispatch={dispatch} />;
}
