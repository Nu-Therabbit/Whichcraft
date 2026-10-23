import type { ToolKind } from "../types";

export type InvalidationScope =
  | "environment-variables"
  | "environment-diagnostics"
  | "environment-external-diff"
  | "tools-installations"
  | "tools-profiles"
  | "tools-shell-check"
  | "shell-overview"
  | "account-context";

export type EnvironmentWriteKind = "apply-staged" | "apply-external-diff";

export type ToolsWriteKind =
  | "apply-plan"
  | "undo"
  | "recovery"
  | "uninstall"
  | "install-missing-profile-chain";

export type WriteOutcome = "success" | "failure" | "cancel";

export type WriteAdmission = {
  token: string;
  owner: "environment" | "tools";
  kind: EnvironmentWriteKind | ToolsWriteKind;
};

export type WriteAdmissionResult =
  | { ok: true; admission: WriteAdmission }
  | { ok: false; reason: string };

export type ToolsReadBinding = {
  tool: ToolKind;
  accountRevision: number;
  accountToken: string;
  toolsRevision: number;
};

export type EnvironmentReadBinding = {
  accountRevision: number;
  accountToken: string;
  environmentRevision: number;
};

export type PlanApplyBinding = {
  planId: string;
  accountRevision: number;
  accountToken: string;
  toolsRevision: number;
};

export const ENVIRONMENT_PENDING_TOOLS_MESSAGE =
  "Apply or discard pending environment edits before changing tools, profiles, or PATH cleanup.";

export const WRITE_BUSY_MESSAGE = "Another registry write is already in progress.";
