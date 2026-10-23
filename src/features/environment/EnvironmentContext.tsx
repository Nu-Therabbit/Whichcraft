import { createContext, useContext, useMemo } from "react";
import { useAppServices } from "../../composition/AppServicesContext";
import { createEnvironmentRuntime } from "./runtime";
import { EnvironmentApiProvider } from "./environmentApiContext";
import { useEnvironmentController } from "./useEnvironmentController";

export type EnvironmentController = ReturnType<typeof useEnvironmentController>;

const EnvironmentControllerContext = createContext<EnvironmentController | null>(null);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const services = useAppServices();
  const runtime = useMemo(
    () => createEnvironmentRuntime(services.environment),
    [services.environment],
  );
  const controller = useEnvironmentController(runtime, services.platform);

  return (
    <EnvironmentApiProvider environment={services.environment}>
      <EnvironmentControllerContext.Provider value={controller}>
        {children}
      </EnvironmentControllerContext.Provider>
    </EnvironmentApiProvider>
  );
}

export function useEnvironment(): EnvironmentController {
  const controller = useContext(EnvironmentControllerContext);
  if (!controller) {
    throw new Error("useEnvironment requires EnvironmentProvider");
  }
  return controller;
}
