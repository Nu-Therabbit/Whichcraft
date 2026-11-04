import { configurationFixture } from "./configurationFixture";
export { configurationFixture } from "./configurationFixture";
import { vi } from "vitest";
import type { ConfigurationApi, ConfigurationPlan } from "../features/configuration/api";
export function fakeConfigurationApi(): ConfigurationApi {
  const fixture = configurationFixture();
  const plan: ConfigurationPlan = {
    id: "plan-1",
    source: fixture.git.identity.email?.source ?? "",
    scope: "local",
    before: "email = local@example.test",
    after: "email = new@example.test",
    impacts: [
      {
        repository: "E:/repos/sample",
        status: "verified",
        reason: null,
        before: fixture.git.identity,
        after: fixture.git.identity,
        matched: null,
      },
    ],
    warnings: [],
  };
  return {
    inspectConfiguration: vi.fn(async () => fixture),
    planConfiguration: vi.fn(async () => plan),
    applyConfiguration: vi.fn(async () => ({
      status: "written",
      readback: "verified",
      message: null,
      operation: { id: "operation-1", source: plan.source, status: "applied", recovery: null },
    })),
    undoConfiguration: vi.fn(async () => ({
      status: "restored",
      readback: "verified",
      message: null,
      operation: null,
    })),
    configurationOperation: vi.fn(async () => null),
    acknowledgeConfigurationRecovery: vi.fn(async () => {}),
    forgetConfigurationRepository: vi.fn(async () => {}),
  };
}
