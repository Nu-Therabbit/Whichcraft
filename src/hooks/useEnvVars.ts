import { useCallback, useState } from "react";
import type { EnvironmentApi } from "../features/environment/api";
import type { EnvVar } from "../types";

export function useEnvVars(environment: EnvironmentApi) {
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await environment.getEnvVars();
      setVars(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [environment]);

  return { vars, loading, error, refresh };
}
