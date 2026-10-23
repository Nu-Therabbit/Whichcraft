import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppServices } from "../contracts";
import { AppLoading } from "../components/AppLoading/AppLoading";
import { createProductionServices } from "./createProductionServices";
import { createUnavailableEnvarlyApi, splitEnvarlyApi } from "./appServices";
import { syncLegacyApiFacade } from "./wireAppServices";

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services: servicesOverride,
  children,
}: {
  services?: AppServices;
  children: ReactNode;
}) {
  const [services, setServices] = useState<AppServices | null>(servicesOverride ?? null);
  const [booting, setBooting] = useState(servicesOverride === undefined);

  useEffect(() => {
    if (servicesOverride !== undefined) {
      syncLegacyApiFacade(servicesOverride);
      setServices(servicesOverride);
      setBooting(false);
      return;
    }

    let cancelled = false;
    void createProductionServices()
      .then((resolved) => {
        if (cancelled) return;
        syncLegacyApiFacade(resolved);
        setServices(resolved);
        setBooting(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        const fallback = splitEnvarlyApi(createUnavailableEnvarlyApi(message));
        syncLegacyApiFacade(fallback);
        setServices(fallback);
        setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [servicesOverride]);

  if (booting) {
    return <AppLoading />;
  }

  if (!services) {
    return null;
  }

  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error("useAppServices requires AppServicesProvider");
  }
  return services;
}
