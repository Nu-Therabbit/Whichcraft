import { useEffect, useState } from "react";
import type { EnvironmentApi } from "../features/environment/api";
import { diagnoseEnvironment, type EnvironmentDiagnostic } from "../lib/environmentDiagnostics";
import type { EnvVar } from "../types";

/** `ready` is false until the first variable read lands, so startup diagnoses once, not twice. */
export function useDiagnostics(vars: EnvVar[], environment: EnvironmentApi, ready = true) {
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostic[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void environment
      .getUnsupportedEnvValues()
      .then((unsupported) =>
        diagnoseEnvironment(vars, unsupported, environment.validatePaths.bind(environment)),
      )
      .then((result) => {
        if (!cancelled) setDiagnostics(result);
      })
      .catch(() => {
        if (!cancelled) setDiagnostics([]);
      });

    return () => {
      cancelled = true;
    };
  }, [vars, environment, ready]);

  return diagnostics;
}
