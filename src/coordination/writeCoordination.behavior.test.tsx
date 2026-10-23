import { fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../contexts/UndoContext";
import { splitEnvarlyApi } from "../composition/appServices";
import { AppServicesProvider } from "../composition/AppServicesContext";
import { configureProductionServices } from "../composition/createProductionServices";
import { EnvironmentProvider, useEnvironment } from "../features/environment/EnvironmentContext";
import { fakeToolsRuntime } from "../features/tools/testHarness";
import { WriteCoordinatorProvider, useWriteCoordinator } from "./WriteCoordinatorContext";

function InvalidateToolsButton() {
  const coordination = useWriteCoordinator();
  useEnvironment();
  return (
    <button type="button" onClick={() => coordination.invalidate(["tools-installations"])}>
      Invalidate tools
    </button>
  );
}

function ApplyStagedCapture({
  onReady,
}: {
  onReady: (apply: (takeSnapshot: boolean) => Promise<boolean>, toolsWriteIdle: () => boolean) => void;
}) {
  const coordination = useWriteCoordinator();
  const env = useEnvironment();
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    onReady(env.handleApplyStaged, () => {
      const gate = coordination.tryBeginToolsWrite("apply-plan");
      if (!gate.ok) return false;
      coordination.endToolsWrite(gate.admission, "cancel");
      return true;
    });
  }, [coordination, env.handleApplyStaged, onReady]);
  return null;
}

describe("write coordination behaviour", () => {
  it("refreshes environment variables when tool-side invalidation fires", async () => {
    const getEnvVars = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          name: "REFRESHED",
          value: "1",
          valueKind: "String" as const,
          scope: "User" as const,
          listSeparator: null,
        },
      ]);
    const { api: fake } = fakeToolsRuntime({ getEnvVars });
    configureProductionServices(splitEnvarlyApi(fake));

    const view = render(
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider>
            <EnvironmentProvider>
              <InvalidateToolsButton />
            </EnvironmentProvider>
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    );

    await waitFor(() => expect(getEnvVars).toHaveBeenCalledTimes(1));
    fireEvent.click(view.getByRole("button", { name: /invalidate tools/i }));
    await waitFor(() => expect(getEnvVars.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("releases environment admission when apply progress subscription fails", async () => {
    const onApplyProgress = vi.fn(async () => {
      throw new Error("subscribe failed");
    });
    const applyEnvChanges = vi.fn(async () => {});
    const { api: fake } = fakeToolsRuntime({
      getEnvVars: async () => [],
      onApplyProgress,
      applyEnvChanges,
      getRegistrySnapshot: async () => ({ user: {}, system: {} }),
      getUnsupportedEnvValues: async () => [],
      validatePaths: async () => [],
    });
    configureProductionServices(splitEnvarlyApi(fake));

    let applyStaged: ((takeSnapshot: boolean) => Promise<boolean>) | null = null;
    let canToolsWrite: (() => boolean) | null = null;

    render(
      <UndoProvider>
        <AppServicesProvider>
          <WriteCoordinatorProvider>
            <EnvironmentProvider>
              <ApplyStagedCapture
                onReady={(apply, canWrite) => {
                  applyStaged = apply;
                  canToolsWrite = canWrite;
                }}
              />
            </EnvironmentProvider>
          </WriteCoordinatorProvider>
        </AppServicesProvider>
      </UndoProvider>,
    );

    await waitFor(() => {
      expect(applyStaged).not.toBeNull();
      expect(canToolsWrite).not.toBeNull();
    });
    const apply = applyStaged as (takeSnapshot: boolean) => Promise<boolean>;
    const writeIdle = canToolsWrite as () => boolean;
    expect(writeIdle()).toBe(true);
    await apply(false);
    await waitFor(() => expect(writeIdle()).toBe(true));
    expect(applyEnvChanges).not.toHaveBeenCalled();
  });
});
