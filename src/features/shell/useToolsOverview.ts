import { useCallback, useEffect, useRef, useState } from "react";
import type { WriteCoordinatorFacade } from "../../coordination/createWriteCoordinator";
import type { EnvironmentApi } from "../environment/api";
import type { ToolsApi } from "../tools/api";
import type {
  AndroidInventory,
  MsvcInventory,
  PythonSupplementalView,
  ToolInstallationView,
  ToolKind,
} from "../tools/types";
import { OVERVIEW_TOOL_KINDS } from "./overviewTools";

export type ToolOverviewSlice = {
  loading: boolean;
  error: string | null;
  installations: ToolInstallationView[];
  boundRequestId: number;
  boundAccountToken: string;
  inFlightRequestId: number;
};

export type ToolsOverviewState = {
  query: string;
  setQuery: (value: string) => void;
  selectedTool: ToolKind | null;
  selectTool: (tool: ToolKind | null) => void;
  detailOpen: boolean;
  closeDetail: () => void;
  rescan: () => Promise<void>;
  rescanning: boolean;
  accountError: string | null;
  byTool: Record<ToolKind, ToolOverviewSlice>;
  pythonInfo: PythonSupplementalView | null;
  sdks: { android: AndroidInventory | null; msvc: MsvcInventory | null };
  sdkLoading: boolean;
  sdkError: string | null;
};

function emptySlice(): ToolOverviewSlice {
  return {
    loading: false,
    error: null,
    installations: [],
    boundRequestId: 0,
    boundAccountToken: "",
    inFlightRequestId: 0,
  };
}

function initialByTool(): Record<ToolKind, ToolOverviewSlice> {
  return Object.fromEntries(OVERVIEW_TOOL_KINDS.map((tool) => [tool, emptySlice()])) as Record<
    ToolKind,
    ToolOverviewSlice
  >;
}

type ActiveScan = { generation: number; accountToken: string };

const RETIRED_SCAN: ActiveScan = { generation: 0, accountToken: "" };

function applyStaleDiscard(
  prev: Record<ToolKind, ToolOverviewSlice>,
  tool: ToolKind,
  generation: number,
): Record<ToolKind, ToolOverviewSlice> {
  const slice = prev[tool];
  if (slice.inFlightRequestId !== generation) return prev;
  return {
    ...prev,
    [tool]: { ...slice, loading: false, inFlightRequestId: 0 },
  };
}

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

export function useToolsOverview(
  tools: ToolsApi,
  environment: EnvironmentApi,
  coordination?: WriteCoordinatorFacade,
): ToolsOverviewState {
  const [query, setQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<ToolKind | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [byTool, setByTool] = useState(initialByTool);
  const [rescanning, setRescanning] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [pythonInfo, setPythonInfo] = useState<PythonSupplementalView | null>(null);
  const [sdks, setSdks] = useState<{ android: AndroidInventory | null; msvc: MsvcInventory | null }>({
    android: null,
    msvc: null,
  });
  const [sdkLoading, setSdkLoading] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const requestId = useRef(0);
  const activeScan = useRef<ActiveScan>(RETIRED_SCAN);

  const loadTool = useCallback(
    async (tool: ToolKind, generation: number, accountToken: string) => {
      setByTool((prev) => ({
        ...prev,
        [tool]: { ...prev[tool], loading: true, error: null, inFlightRequestId: generation },
      }));
      const coordBinding = coordination?.beginToolsRead(tool);
      try {
        const installations = await tools.listToolInstallations(tool);
        setByTool((prev) => {
          if (coordBinding && coordination && !coordination.isToolsReadCurrent(coordBinding)) {
            return applyStaleDiscard(prev, tool, generation);
          }
          if (!resultStillValid(generation, accountToken, requestId.current, activeScan.current)) {
            return applyStaleDiscard(prev, tool, generation);
          }
          return {
            ...prev,
            [tool]: {
              loading: false,
              error: null,
              installations,
              boundRequestId: generation,
              boundAccountToken: accountToken,
              inFlightRequestId: 0,
            },
          };
        });
      } catch (err) {
        setByTool((prev) => {
          if (coordBinding && coordination && !coordination.isToolsReadCurrent(coordBinding)) {
            return applyStaleDiscard(prev, tool, generation);
          }
          if (!resultStillValid(generation, accountToken, requestId.current, activeScan.current)) {
            return applyStaleDiscard(prev, tool, generation);
          }
          return {
            ...prev,
            [tool]: {
              ...prev[tool],
              loading: false,
              error: String(err),
              installations: [],
              boundRequestId: generation,
              boundAccountToken: accountToken,
              inFlightRequestId: 0,
            },
          };
        });
      }
    },
    [coordination, tools],
  );

  const rescan = useCallback(async () => {
    const generation = ++requestId.current;
    setRescanning(true);
    setAccountError(null);

    let accountToken: string;
    try {
      const selected = await environment.getSelectedAccount();
      if (generation !== requestId.current) {
        setSdkLoading(false);
        return;
      }
      accountToken = selected?.sid ?? "local";
      coordination?.notifyAccountContextChanged(selected?.sid ?? null);
    } catch (err) {
      if (generation !== requestId.current) return;
      const message = String(err);
      activeScan.current = RETIRED_SCAN;
      setSdkLoading(false);
      setAccountError(message);
      setByTool((prev) => {
        const next = { ...prev };
        for (const tool of OVERVIEW_TOOL_KINDS) {
          next[tool] = {
            ...next[tool],
            loading: false,
            inFlightRequestId: 0,
            error: message,
            installations: [],
            boundRequestId: 0,
            boundAccountToken: "",
          };
        }
        return next;
      });
      setRescanning(false);
      return;
    }

    if (generation !== requestId.current) {
      setSdkLoading(false);
      return;
    }

    activeScan.current = { generation, accountToken };

    setSdkLoading(true);
    setSdkError(null);
    const sdkResults = await Promise.allSettled([
      tools.getPythonLauncherInfo(),
      tools.getAndroidInventory(),
      tools.getMsvcInventory(),
    ]);
    if (generation !== requestId.current) {
      setSdkLoading(false);
      return;
    }
    setPythonInfo(sdkResults[0].status === "fulfilled" ? sdkResults[0].value : null);
    setSdks({
      android: sdkResults[1].status === "fulfilled" ? sdkResults[1].value : null,
      msvc: sdkResults[2].status === "fulfilled" ? sdkResults[2].value : null,
    });
    if (sdkResults.some((result) => result.status === "rejected")) {
      setSdkError("Some supplemental inventory could not be loaded.");
    }
    setSdkLoading(false);

    await Promise.all(OVERVIEW_TOOL_KINDS.map((tool) => loadTool(tool, generation, accountToken)));
    if (generation === requestId.current) setRescanning(false);
  }, [coordination, environment, loadTool, tools]);

  useEffect(() => {
    void rescan();
  }, [rescan]);

  const selectTool = useCallback((tool: ToolKind | null) => {
    setSelectedTool(tool);
    setDetailOpen(tool !== null);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedTool(null);
  }, []);

  return {
    query,
    setQuery,
    selectedTool,
    selectTool,
    detailOpen,
    closeDetail,
    rescan,
    rescanning,
    accountError,
    byTool,
    pythonInfo,
    sdks,
    sdkLoading,
    sdkError,
  };
};
