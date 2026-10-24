import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { WriteCoordinatorFacade } from "../../coordination/createWriteCoordinator";
import type { EnvironmentApi } from "../environment/api";
import type { ToolsApi } from "../tools/api";
import type { ToolKind } from "../tools/types";
import { OVERVIEW_TOOL_KINDS } from "./overviewTools";
import {
  initialToolsOverview,
  reduceToolsOverview,
  type ToolsOverviewModel,
} from "./toolsOverviewReduce";

export type { ToolOverviewSlice } from "./toolsOverviewReduce";

export type ToolsOverviewState = ToolsOverviewModel & {
  setQuery: (value: string) => void;
  selectTool: (tool: ToolKind | null) => void;
  closeDetail: () => void;
  rescan: () => Promise<void>;
};

type ActiveScan = { generation: number; accountToken: string };

const RETIRED_SCAN: ActiveScan = { generation: 0, accountToken: "" };

function resultStillValid(
  generation: number,
  accountToken: string,
  requestId: number,
  scan: ActiveScan,
): boolean {
  if (generation !== requestId) return false;
  if (scan.generation === 0) return false;
  return generation === scan.generation && accountToken === scan.accountToken;
}

/** Loads every overview tool's inventory; the reducer owns state, these effects own the API calls. */
export function useToolsOverview(
  tools: ToolsApi,
  environment: EnvironmentApi,
  coordination?: WriteCoordinatorFacade,
): ToolsOverviewState {
  const [model, dispatch] = useReducer(reduceToolsOverview, undefined, initialToolsOverview);

  const requestId = useRef(0);
  const activeScan = useRef<ActiveScan>(RETIRED_SCAN);

  const loadTool = useCallback(
    async (tool: ToolKind, generation: number, accountToken: string) => {
      dispatch({ type: "toolScanStarted", tool, generation });
      const coordBinding = coordination?.beginRead({ kind: "overview-inventory", tool });
      const stillCurrent = () =>
        !(coordBinding && coordination && !coordination.isReadCurrent(coordBinding)) &&
        resultStillValid(generation, accountToken, requestId.current, activeScan.current);
      try {
        const installations = await tools.listToolInstallations(tool);
        dispatch(
          stillCurrent()
            ? { type: "toolScanned", tool, generation, accountToken, installations }
            : { type: "toolScanDiscarded", tool, generation },
        );
      } catch (err) {
        dispatch(
          stillCurrent()
            ? { type: "toolScanFailed", tool, generation, accountToken, error: String(err) }
            : { type: "toolScanDiscarded", tool, generation },
        );
      }
    },
    [coordination, tools],
  );

  const rescan = useCallback(async () => {
    const generation = ++requestId.current;
    dispatch({ type: "scanStarted" });

    let accountToken: string;
    try {
      const selected = await environment.getSelectedAccount();
      if (generation !== requestId.current) {
        dispatch({ type: "scanSuperseded" });
        return;
      }
      accountToken = selected?.sid ?? "local";
      coordination?.notifyAccountContextChanged(selected?.sid ?? null);
    } catch (err) {
      if (generation !== requestId.current) return;
      activeScan.current = RETIRED_SCAN;
      dispatch({ type: "accountFailed", message: String(err) });
      return;
    }

    if (generation !== requestId.current) {
      dispatch({ type: "scanSuperseded" });
      return;
    }

    activeScan.current = { generation, accountToken };

    dispatch({ type: "sdkScanStarted" });
    const [python, android, msvc] = await Promise.allSettled([
      tools.getPythonLauncherInfo(),
      tools.getAndroidInventory(),
      tools.getMsvcInventory(),
    ]);
    if (generation !== requestId.current) {
      dispatch({ type: "scanSuperseded" });
      return;
    }
    dispatch({
      type: "sdkScanned",
      pythonInfo: python.status === "fulfilled" ? python.value : null,
      android: android.status === "fulfilled" ? android.value : null,
      msvc: msvc.status === "fulfilled" ? msvc.value : null,
      incomplete: [python, android, msvc].some((result) => result.status === "rejected"),
    });

    await Promise.all(OVERVIEW_TOOL_KINDS.map((tool) => loadTool(tool, generation, accountToken)));
    if (generation === requestId.current) dispatch({ type: "scanFinished" });
  }, [coordination, environment, loadTool, tools]);

  useEffect(() => {
    void rescan();
  }, [rescan]);

  const actions = useMemo(
    () => ({
      setQuery: (query: string) => dispatch({ type: "queryChanged", query }),
      selectTool: (tool: ToolKind | null) => dispatch({ type: "toolSelected", tool }),
      closeDetail: () => dispatch({ type: "detailClosed" }),
    }),
    [],
  );

  return { ...model, ...actions, rescan };
}
