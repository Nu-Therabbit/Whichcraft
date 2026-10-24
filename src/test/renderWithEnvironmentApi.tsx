import { render, type RenderOptions } from "@testing-library/react";
import type { EnvironmentApi } from "../features/environment/api";
import { EnvironmentApiProvider } from "../features/environment/environmentApiContext";
import type { PlatformApi } from "../platform/api";
import { PlatformApiProvider } from "../platform/platformApiContext";
import { fakePlatformApi } from "./fakePlatformApi";

export function renderWithEnvironmentApi(
  ui: React.ReactElement,
  environment: EnvironmentApi,
  options?: Omit<RenderOptions, "wrapper"> & { platform?: PlatformApi },
) {
  const { platform = fakePlatformApi(), ...renderOptions } = options ?? {};
  return render(
    <PlatformApiProvider platform={platform}>
      <EnvironmentApiProvider environment={environment}>{ui}</EnvironmentApiProvider>
    </PlatformApiProvider>,
    renderOptions,
  );
}
