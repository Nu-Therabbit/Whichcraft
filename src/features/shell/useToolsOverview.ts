import { useCallback, useEffect, useRef, useState } from "react";
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
  };
}

function initialByTool(): Record<ToolKind, ToolOverviewSlice> {
  return Object.fromEntries(OVERVIEW_TOOL_KINDS.map((tool) => [tool, emptySlice()])) as Record<
    ToolKind,
    ToolOverviewSlice
  >;
}

export function useToolsOverview(
  tools: ToolsApi,
  environment: EnvironmentApi,
): ToolsOverviewState {
  const [query, setQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<ToolKind | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [byTool, setByTool] = useState(initialByTool);
  const [rescanning, setRescanning] = useState(false);
  const [pythonInfo, setPythonInfo] = useState<PythonSupplementalView | null>(null);
  const [sdks, setSdks] = useState<{ android: AndroidInventory | null; msvc: MsvcInventory | null }>({
    android: null,
    msvc: null,
  });
  const [sdkLoading, setSdkLoading] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const requestId = useRef(0);
  const accountToken = useRef("local");

  const loadTool = useCallback(
    async (tool: ToolKind, generation: number, account: string) => {
      setByTool((prev) => ({
        ...prev,
        [tool]: { ...prev[tool], loading: true, error: null },
      }));
      try {
        const installations = await tools.listToolInstallations(tool);
        setByTool((prev) => {
          if (generation !== requestId.current || account !== accountToken.current) return prev;
          return {
            ...prev,
            [tool]: {
              loading: false,
              error: null,
              installations,
              boundRequestId: generation,
              boundAccountToken: account,
            },
          };
        });
      } catch (err) {
        setByTool((prev) => {
          if (generation !== requestId.current || account !== accountToken.current) return prev;
          return {
            ...prev,
            [tool]: {
              ...prev[tool],
              loading: false,
              error: String(err),
              installations: [],
              boundRequestId: generation,
              boundAccountToken: account,
            },
          };
        });
      }
    },
    [tools],
  );

  const rescan = useCallback(async () => {
    setRescanning(true);
    requestId.current += 1;
    const generation = requestId.current;
    let account = "local";
    try {
      const selected = await environment.getSelectedAccount();
      account = selected?.sid ?? "local";
    } catch {}
    accountToken.current = account;

    setSdkLoading(true);
    setSdkError(null);
    const sdkResults = await Promise.allSettled([
      tools.getPythonLauncherInfo(),
      tools.getAndroidInventory(),
      tools.getMsvcInventory(),
    ]);
    if (generation === requestId.current) {
      setPythonInfo(sdkResults[0].status === "fulfilled" ? sdkResults[0].value : null);
      setSdks({
        android: sdkResults[1].status === "fulfilled" ? sdkResults[1].value : null,
        msvc: sdkResults[2].status === "fulfilled" ? sdkResults[2].value : null,
      });
      if (sdkResults.some((result) => result.status === "rejected")) {
        setSdkError("Some supplemental inventory could not be loaded.");
      }
      setSdkLoading(false);
    }

    await Promise.all(OVERVIEW_TOOL_KINDS.map((tool) => loadTool(tool, generation, account)));
    if (generation === requestId.current) setRescanning(false);
  }, [environment, loadTool, tools]);

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
    byTool,
    pythonInfo,
    sdks,
    sdkLoading,
    sdkError,
  };
}
