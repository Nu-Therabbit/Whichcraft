import { useEffect, useState } from "react";
import type { EnvironmentApi } from "../features/environment/api";
import { diagnoseEnvironment, type EnvironmentDiagnostic } from "../lib/environmentDiagnostics";
import type { EnvVar } from "../types";

export function useDiagnostics(vars: EnvVar[], environment: EnvironmentApi) {
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostic[]>([]);

  useEffect(() => {
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
  }, [vars, environment]);

  return diagnostics;
}
