import { useCallback, useState } from "react";
import type { WriteCoordinatorFacade } from "../coordination/createWriteCoordinator";
import type { EnvironmentApi } from "../features/environment/api";
import type { EnvVar } from "../types";

type EnvReadGuard = Pick<WriteCoordinatorFacade, "beginEnvironmentRead" | "isEnvironmentReadCurrent">;

export function useEnvVars(environment: EnvironmentApi, readGuard?: EnvReadGuard) {
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const binding = readGuard?.beginEnvironmentRead();
    setLoading(true);
    setError(null);
    try {
      const data = await environment.getEnvVars();
      if (binding && readGuard && !readGuard.isEnvironmentReadCurrent(binding)) return;
      setVars(data);
    } catch (e) {
      if (binding && readGuard && !readGuard.isEnvironmentReadCurrent(binding)) return;
      setError(String(e));
    } finally {
      if (!binding || !readGuard || readGuard.isEnvironmentReadCurrent(binding)) setLoading(false);
    }
  }, [environment, readGuard]);

  return { vars, loading, error, refresh };
}
