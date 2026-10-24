import type { WriteCoordinatorFacade } from "../../coordination/createWriteCoordinator";
import type { CheckCommandResult } from "../../types";
import type { EnvironmentApi } from "./api";

/** Resolves a command through the backend API only (never runs the binary locally). */
export async function resolveCheckCommand(
  environment: EnvironmentApi,
  coordination: WriteCoordinatorFacade | undefined,
  input: string,
): Promise<CheckCommandResult | null> {
  const binding = coordination?.beginCheckCommand();
  const result = await environment.checkCommand(input);
  if (binding && !coordination?.isCheckCommandCurrent(binding)) return null;
  return result;
}
