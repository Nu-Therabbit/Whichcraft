import type { ToolKind } from "../features/tools/types";

export type InvalidationScope =
  | "configuration"
  | "environment-variables"
  | "environment-diagnostics"
  | "environment-external-diff"
  | "tools-installations"
  | "tools-profiles"
  | "tools-shell-check"
  | "shell-overview"
  | "account-context";

export type EnvironmentWriteKind = "apply-staged" | "apply-external-diff";
export type ConfigurationWriteKind = "apply" | "undo" | "recovery";

export type ToolsWriteKind = "apply-plan" | "undo" | "recovery" | "uninstall";

export type WriteOutcome = "success" | "failure" | "cancel";

export type WriteAdmission = {
  token: string;
  owner: "environment" | "tools" | "configuration";
  kind: EnvironmentWriteKind | ToolsWriteKind | ConfigurationWriteKind;
};

export type WriteAdmissionResult =
  | { ok: true; admission: WriteAdmission }
  | { ok: false; reason: string };

export type ToolsWriteGateResult = { ok: true } | { ok: false; reason: string };

export type ReadScopeKey =
  | { kind: "tool-inventory"; tool: ToolKind }
  | { kind: "overview-inventory"; tool: ToolKind }
  | { kind: "profiles" }
  | { kind: "configuration" }
  | { kind: "shell-check"; tool: ToolKind }
  | { kind: "environment" }
  | { kind: "external-diff" }
  | { kind: "check-command" }
  | { kind: "tool-result"; tool: ToolKind };

export type CoordinatorReadBinding = {
  requestId: number;
  scopeKey: string;
  tool?: ToolKind;
  accountRevision: number;
  accountToken: string;
  toolsRevision: number;
  environmentRevision: number;
};

export type PlanApplyBinding = {
  planId: string;
  tool: ToolKind;
  environmentRevision: number;
  toolsRevision: number;
  accountRevision: number;
  accountToken: string;
};

export const ENVIRONMENT_PENDING_TOOLS_MESSAGE =
  "Apply or discard pending environment edits before changing tools, profiles, or PATH cleanup.";

export const WRITE_BUSY_MESSAGE = "Another write is already in progress.";

export function readScopeKey(scope: ReadScopeKey): string {
  switch (scope.kind) {
    case "configuration":
      return "configuration";
    case "tool-inventory":
      return `inv:${scope.tool}`;
    case "overview-inventory":
      return `overview:${scope.tool}`;
    case "profiles":
      return "profiles";
    case "shell-check":
      return `shell:${scope.tool}`;
    case "environment":
      return "environment";
    case "external-diff":
      return "external-diff";
    case "check-command":
      return "check-command";
    case "tool-result":
      return `result:${scope.tool}`;
  }
}
