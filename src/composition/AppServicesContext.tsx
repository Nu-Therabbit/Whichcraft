import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AppServices } from "../contracts";
import { AppLoading } from "../components/AppLoading/AppLoading";
import { PlatformApiProvider } from "../platform/platformApiContext";
import { createProductionServices } from "./createProductionServices";
import { createUnavailableEnvarlyApi, splitEnvarlyApi } from "./appServices";
import { syncLegacyApiFacade } from "./wireAppServices";

export const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services: servicesOverride,
  children,
}: {
  services?: AppServices;
  children: ReactNode;
}) {
  const wiredOverrideRef = useRef<AppServices | null>(null);
  if (servicesOverride !== undefined && wiredOverrideRef.current !== servicesOverride) {
    syncLegacyApiFacade(servicesOverride);
    wiredOverrideRef.current = servicesOverride;
  }

  const [services, setServices] = useState<AppServices | null>(servicesOverride ?? null);

  useEffect(() => {
    if (servicesOverride !== undefined) {
      setServices(servicesOverride);
      return;
    }

    let cancelled = false;
    void createProductionServices()
      .then((resolved) => {
        if (cancelled) return;
        syncLegacyApiFacade(resolved);
        setServices(resolved);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        const fallback = splitEnvarlyApi(createUnavailableEnvarlyApi(message));
        syncLegacyApiFacade(fallback);
        setServices(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [servicesOverride]);

  if (services === null) {
    return <AppLoading />;
  }

  return (
    <AppServicesContext.Provider value={services}>
      <PlatformApiProvider platform={services.platform}>{children}</PlatformApiProvider>
    </AppServicesContext.Provider>
  );
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error("useAppServices requires AppServicesProvider");
  }
  return services;
}
