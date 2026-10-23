import { createContext, useContext } from "react";
import type { EnvironmentApi } from "./api";

const EnvironmentApiContext = createContext<EnvironmentApi | null>(null);

export function EnvironmentApiProvider({
  environment,
  children,
}: {
  environment: EnvironmentApi;
  children: React.ReactNode;
}) {
  return (
    <EnvironmentApiContext.Provider value={environment}>{children}</EnvironmentApiContext.Provider>
  );
}

export function useEnvironmentApi(): EnvironmentApi {
  const environment = useContext(EnvironmentApiContext);
  if (!environment) {
    throw new Error("useEnvironmentApi requires EnvironmentApiProvider or EnvironmentProvider");
  }
  return environment;
}
