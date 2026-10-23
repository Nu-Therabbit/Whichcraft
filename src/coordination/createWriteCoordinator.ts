import type { ToolKind } from "../types";
import {
  ENVIRONMENT_PENDING_TOOLS_MESSAGE,
  type EnvironmentReadBinding,
  type EnvironmentWriteKind,
  type InvalidationScope,
  type PlanApplyBinding,
  type ToolsReadBinding,
  type ToolsWriteKind,
  type WriteAdmission,
  type WriteAdmissionResult,
  type WriteOutcome,
  WRITE_BUSY_MESSAGE,
} from "./types";

export type WriteCoordinatorFacade = {
  setEnvironmentPending: (pending: boolean) => void;
  tryBeginEnvironmentWrite: (kind: EnvironmentWriteKind) => WriteAdmissionResult;
  endEnvironmentWrite: (admission: WriteAdmission, outcome: WriteOutcome) => void;
  tryBeginToolsWrite: (kind: ToolsWriteKind) => WriteAdmissionResult;
  endToolsWrite: (admission: WriteAdmission, outcome: WriteOutcome) => void;
  beginToolsRead: (tool: ToolKind) => ToolsReadBinding;
  isToolsReadCurrent: (binding: ToolsReadBinding) => boolean;
  beginEnvironmentRead: () => EnvironmentReadBinding;
  isEnvironmentReadCurrent: (binding: EnvironmentReadBinding) => boolean;
  beginPlanApply: (planId: string) => PlanApplyBinding;
  isPlanApplyCurrent: (binding: PlanApplyBinding) => boolean;
  notifyAccountContextChanged: (accountSid: string | null) => void;
  getAccountToken: () => string;
  invalidate: (scopes: InvalidationScope[]) => void;
  subscribeInvalidation: (listener: (scopes: InvalidationScope[]) => void) => () => void;
};

const ALL_SCOPES: InvalidationScope[] = [
  "environment-variables",
  "environment-diagnostics",
  "environment-external-diff",
  "tools-installations",
  "tools-profiles",
  "tools-shell-check",
  "shell-overview",
  "account-context",
];

function scopesForEnvironmentWrite(kind: EnvironmentWriteKind): InvalidationScope[] {
  if (kind === "apply-external-diff") {
    return [
      "environment-variables",
      "environment-diagnostics",
      "environment-external-diff",
      "tools-installations",
      "tools-profiles",
      "tools-shell-check",
      "shell-overview",
    ];
  }
  return [
    "environment-variables",
    "environment-diagnostics",
    "tools-installations",
    "tools-profiles",
    "tools-shell-check",
    "shell-overview",
  ];
}

function scopesForToolsWrite(kind: ToolsWriteKind): InvalidationScope[] {
  void kind;
  return [
    "tools-installations",
    "tools-profiles",
    "tools-shell-check",
    "shell-overview",
    "environment-diagnostics",
  ];
}

export function createWriteCoordinator(): WriteCoordinatorFacade {
  let environmentPending = false;
  let activeWrite: WriteAdmission | null = null;
  let accountToken = "local";
  let accountRevision = 0;
  let toolsRevision = 0;
  let environmentRevision = 0;
  const invalidationListeners = new Set<(scopes: InvalidationScope[]) => void>();

  let nextToken = 0;
  const newToken = () => `write-${++nextToken}`;

  const invalidate = (scopes: InvalidationScope[]) => {
    const unique = [...new Set(scopes)];
    if (unique.length === 0) return;
    if (unique.some((s) => s.startsWith("tools-") || s === "shell-overview")) toolsRevision += 1;
    if (unique.some((s) => s.startsWith("environment-"))) environmentRevision += 1;
    if (unique.includes("account-context")) {
      toolsRevision += 1;
      environmentRevision += 1;
    }
    for (const listener of invalidationListeners) listener(unique);
  };

  const endWrite = (admission: WriteAdmission, outcome: WriteOutcome, owner: WriteAdmission["owner"]) => {
    if (!activeWrite || activeWrite.token !== admission.token || activeWrite.owner !== owner) return;
    activeWrite = null;
    if (outcome === "success") {
      if (owner === "environment") {
        invalidate(scopesForEnvironmentWrite(admission.kind as EnvironmentWriteKind));
      } else {
        invalidate(scopesForToolsWrite(admission.kind as ToolsWriteKind));
      }
    }
  };

  return {
    setEnvironmentPending(pending: boolean) {
      environmentPending = pending;
    },

    tryBeginEnvironmentWrite(kind: EnvironmentWriteKind): WriteAdmissionResult {
      if (activeWrite) return { ok: false, reason: WRITE_BUSY_MESSAGE };
      const admission: WriteAdmission = { token: newToken(), owner: "environment", kind };
      activeWrite = admission;
      return { ok: true, admission };
    },

    endEnvironmentWrite(admission: WriteAdmission, outcome: WriteOutcome) {
      endWrite(admission, outcome, "environment");
    },

    tryBeginToolsWrite(kind: ToolsWriteKind): WriteAdmissionResult {
      if (environmentPending) return { ok: false, reason: ENVIRONMENT_PENDING_TOOLS_MESSAGE };
      if (activeWrite) return { ok: false, reason: WRITE_BUSY_MESSAGE };
      const admission: WriteAdmission = { token: newToken(), owner: "tools", kind };
      activeWrite = admission;
      return { ok: true, admission };
    },

    endToolsWrite(admission: WriteAdmission, outcome: WriteOutcome) {
      endWrite(admission, outcome, "tools");
    },

    beginToolsRead(tool: ToolKind): ToolsReadBinding {
      return {
        tool,
        accountRevision,
        accountToken,
        toolsRevision,
      };
    },

    isToolsReadCurrent(binding: ToolsReadBinding): boolean {
      return (
        binding.accountRevision === accountRevision &&
        binding.accountToken === accountToken &&
        binding.toolsRevision === toolsRevision
      );
    },

    beginEnvironmentRead(): EnvironmentReadBinding {
      return {
        accountRevision,
        accountToken,
        environmentRevision,
      };
    },

    isEnvironmentReadCurrent(binding: EnvironmentReadBinding): boolean {
      return (
        binding.accountRevision === accountRevision &&
        binding.accountToken === accountToken &&
        binding.environmentRevision === environmentRevision
      );
    },

    beginPlanApply(planId: string): PlanApplyBinding {
      return { planId, accountRevision, accountToken, toolsRevision };
    },

    isPlanApplyCurrent(binding: PlanApplyBinding): boolean {
      return (
        binding.accountRevision === accountRevision &&
        binding.accountToken === accountToken &&
        binding.toolsRevision === toolsRevision
      );
    },

    notifyAccountContextChanged(accountSid: string | null) {
      accountToken = accountSid ?? "local";
      accountRevision += 1;
      invalidate(["account-context", ...ALL_SCOPES]);
    },

    getAccountToken() {
      return accountToken;
    },

    invalidate,

    subscribeInvalidation(listener: (scopes: InvalidationScope[]) => void) {
      invalidationListeners.add(listener);
      return () => invalidationListeners.delete(listener);
    },
  };
}
