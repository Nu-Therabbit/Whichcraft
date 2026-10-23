import type { InvalidationScope } from "../../coordination/types";

/** Cross-feature readback when the registry diverges from baseline (once per diff episode). */
export const EXTERNAL_DIFF_CROSS_INVALIDATION_SCOPES: InvalidationScope[] = [
  "environment-variables",
  "environment-diagnostics",
  "tools-installations",
  "tools-profiles",
  "tools-shell-check",
  "shell-overview",
];
