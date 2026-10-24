import { render, type RenderOptions } from "@testing-library/react";
import type { EnvironmentApi } from "../features/environment/api";
import { EnvironmentApiProvider } from "../features/environment/environmentApiContext";

export function renderWithEnvironmentApi(
  ui: React.ReactElement,
  environment: EnvironmentApi,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(
    <EnvironmentApiProvider environment={environment}>{ui}</EnvironmentApiProvider>,
    options,
  );
}
