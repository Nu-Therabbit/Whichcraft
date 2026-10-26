import type { InvalidationScope } from "../../coordination/types";

/** Cross-feature readback for each distinct externally observed registry state. */
export const EXTERNAL_DIFF_CROSS_INVALIDATION_SCOPES: InvalidationScope[] = [
  "environment-variables",
  "environment-diagnostics",
  "tools-installations",
  "tools-profiles",
  "tools-shell-check",
  "shell-overview",
];
