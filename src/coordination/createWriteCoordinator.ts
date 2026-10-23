import type { ToolApplyPlan } from "../features/tools/types";
import type { ToolKind } from "../types";
import {
  ENVIRONMENT_PENDING_TOOLS_MESSAGE,
  type CoordinatorReadBinding,
  type EnvironmentWriteKind,
  type InvalidationScope,
  type PlanApplyBinding,
  type ReadScopeKey,
  type ToolsWriteGateResult,
  type ToolsWriteKind,
  type WriteAdmission,
  type WriteAdmissionResult,
  type WriteOutcome,
  WRITE_BUSY_MESSAGE,
  readScopeKey,
} from "./types";

export type WriteCoordinatorFacade = {
  setEnvironmentPending: (pending: boolean) => void;
  tryBeginEnvironmentWrite: (kind: EnvironmentWriteKind) => WriteAdmissionResult;
  endEnvironmentWrite: (admission: WriteAdmission, outcome: WriteOutcome) => void;
  tryBeginToolsWrite: (kind: ToolsWriteKind) => WriteAdmissionResult;
  checkToolsWriteAllowed: () => ToolsWriteGateResult;
  endToolsWrite: (admission: WriteAdmission, outcome: WriteOutcome) => void;
  beginRead: (scope: ReadScopeKey) => CoordinatorReadBinding;
  isReadCurrent: (binding: CoordinatorReadBinding) => boolean;
  beginToolsRead: (tool: ToolKind) => CoordinatorReadBinding;
  isToolsReadCurrent: (binding: CoordinatorReadBinding) => boolean;
  beginEnvironmentRead: () => CoordinatorReadBinding;
  isEnvironmentReadCurrent: (binding: CoordinatorReadBinding) => boolean;
  beginShellCheck: (tool: ToolKind) => CoordinatorReadBinding;
  isShellCheckCurrent: (binding: CoordinatorReadBinding) => boolean;
  beginToolResult: (tool: ToolKind) => CoordinatorReadBinding;
  isToolResultCurrent: (binding: CoordinatorReadBinding) => boolean;
  registerReviewedPlan: (plan: ToolApplyPlan) => void;
  beginPlanApply: (planId: string, tool: ToolKind) => PlanApplyBinding;
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

function scopesForToolsWrite(_kind: ToolsWriteKind): InvalidationScope[] {
  return [
    "tools-installations",
    "tools-profiles",
    "tools-shell-check",
    "shell-overview",
    "environment-diagnostics",
    "environment-variables",
  ];
}

function readbackScopes(owner: WriteAdmission["owner"], kind: EnvironmentWriteKind | ToolsWriteKind): InvalidationScope[] {
  if (owner === "environment") return scopesForEnvironmentWrite(kind as EnvironmentWriteKind);
  return scopesForToolsWrite(kind as ToolsWriteKind);
}

export function createWriteCoordinator(): WriteCoordinatorFacade {
  let environmentPending = false;
  let activeWrite: WriteAdmission | null = null;
  let accountToken = "local";
  let accountRevision = 0;
  let toolsRevision = 0;
  let environmentRevision = 0;
  let readSeq = 0;
  const readLatest = new Map<string, number>();
  let reviewedPlan: PlanApplyBinding | null = null;
  const invalidationListeners = new Set<(scopes: InvalidationScope[]) => void>();

  let nextToken = 0;
  const newToken = () => `write-${++nextToken}`;

  const snapshot = () => ({
    accountRevision,
    accountToken,
    toolsRevision,
    environmentRevision,
  });

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
    if (outcome === "cancel") return;
    invalidate(readbackScopes(owner, admission.kind));
  };

  const beginRead = (scope: ReadScopeKey): CoordinatorReadBinding => {
    const key = readScopeKey(scope);
    const requestId = ++readSeq;
    readLatest.set(key, requestId);
    const snap = snapshot();
    return {
      requestId,
      scopeKey: key,
      tool: "tool" in scope ? scope.tool : undefined,
      ...snap,
    };
  };

  const isReadCurrent = (binding: CoordinatorReadBinding): boolean => {
    if (readLatest.get(binding.scopeKey) !== binding.requestId) return false;
    const snap = snapshot();
    return (
      binding.accountRevision === snap.accountRevision &&
      binding.accountToken === snap.accountToken &&
      binding.toolsRevision === snap.toolsRevision &&
      binding.environmentRevision === snap.environmentRevision
    );
  };

  const checkToolsWriteAllowed = (): ToolsWriteGateResult => {
    if (environmentPending) return { ok: false, reason: ENVIRONMENT_PENDING_TOOLS_MESSAGE };
    if (activeWrite) return { ok: false, reason: WRITE_BUSY_MESSAGE };
    return { ok: true };
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

    checkToolsWriteAllowed,

    tryBeginToolsWrite(kind: ToolsWriteKind): WriteAdmissionResult {
      const allowed = checkToolsWriteAllowed();
      if (!allowed.ok) return allowed;
      const admission: WriteAdmission = { token: newToken(), owner: "tools", kind };
      activeWrite = admission;
      return { ok: true, admission };
    },

    endToolsWrite(admission: WriteAdmission, outcome: WriteOutcome) {
      endWrite(admission, outcome, "tools");
    },

    beginRead,
    isReadCurrent,

    beginToolsRead(tool: ToolKind) {
      return beginRead({ kind: "tool-inventory", tool });
    },

    isToolsReadCurrent(binding: CoordinatorReadBinding) {
      return binding.scopeKey.startsWith("inv:") && isReadCurrent(binding);
    },

    beginEnvironmentRead() {
      return beginRead({ kind: "environment" });
    },

    isEnvironmentReadCurrent(binding: CoordinatorReadBinding) {
      return binding.scopeKey === "environment" && isReadCurrent(binding);
    },

    beginShellCheck(tool: ToolKind) {
      return beginRead({ kind: "shell-check", tool });
    },

    isShellCheckCurrent(binding: CoordinatorReadBinding) {
      return binding.scopeKey.startsWith("shell:") && isReadCurrent(binding);
    },

    beginToolResult(tool: ToolKind) {
      return beginRead({ kind: "tool-result", tool });
    },

    isToolResultCurrent(binding: CoordinatorReadBinding) {
      return binding.scopeKey === `result:${binding.tool}` && isReadCurrent(binding);
    },

    registerReviewedPlan(plan: ToolApplyPlan) {
      const snap = snapshot();
      reviewedPlan = {
        planId: plan.planId,
        tool: plan.tool,
        environmentRevision: snap.environmentRevision,
        toolsRevision: snap.toolsRevision,
        accountRevision: snap.accountRevision,
        accountToken: snap.accountToken,
      };
    },

    beginPlanApply(planId: string, tool: ToolKind): PlanApplyBinding {
      if (!reviewedPlan || reviewedPlan.planId !== planId || reviewedPlan.tool !== tool) {
        return {
          planId,
          tool,
          environmentRevision: -1,
          toolsRevision: -1,
          accountRevision: -1,
          accountToken: "",
        };
      }
      return { ...reviewedPlan };
    },

    isPlanApplyCurrent(binding: PlanApplyBinding): boolean {
      if (!reviewedPlan) return false;
      const snap = snapshot();
      return (
        binding.planId === reviewedPlan.planId &&
        binding.tool === reviewedPlan.tool &&
        binding.environmentRevision === reviewedPlan.environmentRevision &&
        binding.toolsRevision === reviewedPlan.toolsRevision &&
        binding.accountRevision === reviewedPlan.accountRevision &&
        binding.accountToken === reviewedPlan.accountToken &&
        snap.accountRevision === reviewedPlan.accountRevision &&
        snap.accountToken === reviewedPlan.accountToken
      );
    },

    notifyAccountContextChanged(accountSid: string | null) {
      const next = accountSid ?? "local";
      if (next === accountToken) return;
      accountToken = next;
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
