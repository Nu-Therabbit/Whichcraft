import type { EnvironmentApi } from "./api";

export type EnvironmentRuntime = {
  environment: EnvironmentApi;
};

export function createEnvironmentRuntime(environment: EnvironmentApi): EnvironmentRuntime {
  return { environment };
}
