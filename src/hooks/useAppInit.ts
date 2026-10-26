import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import type { EnvironmentApi } from "../features/environment/api";
import type { PlatformApi } from "../platform/api";
import type { EnvSnapshot } from "../types";

interface Params {
  environment: EnvironmentApi;
  platform: Pick<PlatformApi, "isElevated">;
  baselineRef: RefObject<EnvSnapshot | null>;
  setElevated: (v: boolean) => void;
  refreshPathStatus: () => Promise<void>;
  refresh: () => Promise<void>;
  checkForExternalChanges: () => Promise<void>;
}

export function useAppInit({
  environment,
  platform,
  baselineRef,
  setElevated,
  refreshPathStatus,
  refresh,
  checkForExternalChanges,
}: Params) {
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        baselineRef.current = await environment.getRegistrySnapshot();
      } catch {}
    })();
    void (async () => {
      try {
        setElevated(await platform.isElevated());
      } catch {}
    })();
    void refreshPathStatus();
    void refresh().finally(() => setInitializing(false));
  }, [baselineRef, environment, platform, setElevated, refreshPathStatus, refresh]);

  useEffect(() => {
    const onFocus = () => { void checkForExternalChanges(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkForExternalChanges]);

  const handleRefresh = useCallback(async () => {
    await refresh();
    await checkForExternalChanges();
  }, [refresh, checkForExternalChanges]);

  return { handleRefresh, initializing };
}
