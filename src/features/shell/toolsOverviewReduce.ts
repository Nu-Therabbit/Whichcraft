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

/** The overview's read model: every tool's inventory, kept apart from the selected-tool store. */
export type ToolsOverviewModel = {
  query: string;
  selectedTool: ToolKind | null;
  detailOpen: boolean;
  byTool: Record<ToolKind, ToolOverviewSlice>;
  rescanning: boolean;
  accountError: string | null;
  pythonInfo: PythonSupplementalView | null;
  sdks: { android: AndroidInventory | null; msvc: MsvcInventory | null };
  sdkLoading: boolean;
  /** Some supplemental (Python/Android/MSVC) inventory failed to load. */
  sdkIncomplete: boolean;
};

export type ToolsOverviewEvent =
  | { type: "queryChanged"; query: string }
  | { type: "toolSelected"; tool: ToolKind | null }
  | { type: "detailClosed" }
  | { type: "scanStarted" }
  | { type: "scanSuperseded" }
  | { type: "accountFailed"; message: string }
  | { type: "sdkScanStarted" }
  | {
      type: "sdkScanned";
      pythonInfo: PythonSupplementalView | null;
      android: AndroidInventory | null;
      msvc: MsvcInventory | null;
      incomplete: boolean;
    }
  | { type: "toolScanStarted"; tool: ToolKind; generation: number }
  | {
      type: "toolScanned";
      tool: ToolKind;
      generation: number;
      accountToken: string;
      installations: ToolInstallationView[];
    }
  | { type: "toolScanFailed"; tool: ToolKind; generation: number; accountToken: string; error: string }
  | { type: "toolScanDiscarded"; tool: ToolKind; generation: number }
  | { type: "scanFinished" };

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

export function initialToolsOverview(): ToolsOverviewModel {
  return {
    query: "",
    selectedTool: null,
    detailOpen: false,
    byTool: Object.fromEntries(OVERVIEW_TOOL_KINDS.map((tool) => [tool, emptySlice()])) as Record<
      ToolKind,
      ToolOverviewSlice
    >,
    rescanning: false,
    accountError: null,
    pythonInfo: null,
    sdks: { android: null, msvc: null },
    sdkLoading: false,
    sdkIncomplete: false,
  };
}

function withSlice(
  model: ToolsOverviewModel,
  tool: ToolKind,
  slice: ToolOverviewSlice,
): ToolsOverviewModel {
  return { ...model, byTool: { ...model.byTool, [tool]: slice } };
}

export function reduceToolsOverview(
  model: ToolsOverviewModel,
  event: ToolsOverviewEvent,
): ToolsOverviewModel {
  switch (event.type) {
    case "queryChanged":
      return { ...model, query: event.query };
    case "toolSelected":
      return { ...model, selectedTool: event.tool, detailOpen: event.tool !== null };
    case "detailClosed":
      return { ...model, selectedTool: null, detailOpen: false };
    case "scanStarted":
      return { ...model, rescanning: true, accountError: null };
    case "scanSuperseded":
      return { ...model, sdkLoading: false };
    case "accountFailed": {
      const byTool = { ...model.byTool };
      for (const tool of OVERVIEW_TOOL_KINDS) {
        byTool[tool] = {
          ...byTool[tool],
          loading: false,
          inFlightRequestId: 0,
          error: event.message,
          installations: [],
          boundRequestId: 0,
          boundAccountToken: "",
        };
      }
      return { ...model, byTool, sdkLoading: false, accountError: event.message, rescanning: false };
    }
    case "sdkScanStarted":
      return { ...model, sdkLoading: true, sdkIncomplete: false };
    case "sdkScanned":
      return {
        ...model,
        pythonInfo: event.pythonInfo,
        sdks: { android: event.android, msvc: event.msvc },
        sdkIncomplete: event.incomplete,
        sdkLoading: false,
      };
    case "toolScanStarted":
      return withSlice(model, event.tool, {
        ...model.byTool[event.tool],
        loading: true,
        error: null,
        inFlightRequestId: event.generation,
      });
    case "toolScanned":
      return withSlice(model, event.tool, {
        loading: false,
        error: null,
        installations: event.installations,
        boundRequestId: event.generation,
        boundAccountToken: event.accountToken,
        inFlightRequestId: 0,
      });
    case "toolScanFailed":
      return withSlice(model, event.tool, {
        ...model.byTool[event.tool],
        loading: false,
        error: event.error,
        installations: [],
        boundRequestId: event.generation,
        boundAccountToken: event.accountToken,
        inFlightRequestId: 0,
      });
    case "toolScanDiscarded": {
      const slice = model.byTool[event.tool];
      // A newer scan already owns this slice's loading flag.
      if (slice.inFlightRequestId !== event.generation) return model;
      return withSlice(model, event.tool, { ...slice, loading: false, inFlightRequestId: 0 });
    }
    case "scanFinished":
      return { ...model, rescanning: false };
  }
}
