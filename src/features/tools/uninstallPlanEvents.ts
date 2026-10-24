import type { ToolKind, ToolApplyPlan, UninstallPlan } from "../../types";
import type { ToolsState } from "./model";

export type UninstallPlannedEvent = {
  type: "uninstallPlanned";
  tool?: ToolKind;
  plan: UninstallPlan;
};

export type SwitchPlannedEvent = {
  type: "switchPlanned";
  tool?: ToolKind;
  plan: ToolApplyPlan | null;
};

export function isUninstallPlannedEvent(msg: { type: string }): msg is UninstallPlannedEvent {
  return msg.type === "uninstallPlanned";
}

export function isSwitchPlannedEvent(msg: { type: string }): msg is SwitchPlannedEvent {
  return msg.type === "switchPlanned";
}

export function reduceUninstallPlanned(s: ToolsState, msg: UninstallPlannedEvent): ToolsState {
  const plannedFor = msg.tool ?? msg.plan.installation.tool;
  if (plannedFor !== s.tool) return { ...s, uninstall: { ...s.uninstall, busy: false } };
  return { ...s, uninstall: { ...s.uninstall, busy: false, plan: msg.plan } };
}

export function reduceSwitchPlanned(s: ToolsState, msg: SwitchPlannedEvent): ToolsState {
  if (!msg.plan) return { ...s, uninstall: { ...s.uninstall, switchPlan: null } };
  const plannedFor = msg.tool ?? msg.plan.tool;
  if (plannedFor !== s.tool) return s;
  return { ...s, uninstall: { ...s.uninstall, switchPlan: msg.plan } };
}
