import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppServices } from "../contracts";
import { mergeEnvarlyApi } from "../contracts";
import { wireLegacyApiFacade } from "../api";
import { createProductionServices } from "./createProductionServices";

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services: servicesOverride,
  children,
}: {
  services?: AppServices;
  children: ReactNode;
}) {
  const [services, setServices] = useState<AppServices | null>(() => {
    if (servicesOverride) {
      wireLegacyApiFacade(mergeEnvarlyApi(servicesOverride));
    }
    return servicesOverride ?? null;
  });

  useEffect(() => {
    if (servicesOverride) {
      wireLegacyApiFacade(mergeEnvarlyApi(servicesOverride));
      setServices(servicesOverride);
      return;
    }
    let cancelled = false;
    void createProductionServices().then((resolved) => {
      if (cancelled) return;
      wireLegacyApiFacade(mergeEnvarlyApi(resolved));
      setServices(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [servicesOverride]);

  const value = useMemo(() => services, [services]);

  if (!value) return null;

  return <AppServicesContext.Provider value={value}>{children}</AppServicesContext.Provider>;
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error("useAppServices requires AppServicesProvider");
  }
  return services;
}
