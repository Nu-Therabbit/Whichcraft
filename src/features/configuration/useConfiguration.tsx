import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { useAppServices } from "../../composition/AppServicesContext";
import { useWriteCoordinator } from "../../coordination/WriteCoordinatorContext";
import type { ConfigurationContext, ConfigurationIntent, ConfigurationWriteResult } from "./api";
import {
  configurationReduce,
  initialConfigurationState,
  type ConfigurationUserIntent,
} from "./model";

function useConfigurationController() {
  const { configuration: api, platform } = useAppServices();
  const coordination = useWriteCoordinator();
  const [state, emit] = useReducer(configurationReduce, initialConfigurationState);
  const generation = useRef(0);
  const mounted = useRef(true);
  const active = useRef(false);
  const ownWrite = useRef(false);
  const refresh = useCallback(() => {
    generation.current++;
    emit({ type: "refresh" });
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(
    () =>
      coordination.subscribeInvalidation((scopes) => {
        if (ownWrite.current && scopes.every((s) => s === "configuration")) return;
        if (
          scopes.some((s) =>
            [
              "configuration",
              "account-context",
              "tools-installations",
              "environment-variables",
            ].includes(s),
          )
        )
          refresh();
      }),
    [coordination, refresh],
  );
  useEffect(() => {
    let cancelled = false;
    void api
      .configurationOperation()
      .then((operation) => {
        if (!cancelled) emit({ type: "operation", operation });
      })
      .catch((error) => {
        if (!cancelled) emit({ type: "error", error: String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [api]);
  const context = state.context;
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is an explicit read request, even when the context is unchanged.
  useEffect(() => {
    if (!active.current || ownWrite.current) return;
    const current = ++generation.current;
    const binding = coordination.beginRead({ kind: "configuration" });
    emit({ type: "loading" });
    void api
      .inspectConfiguration(context)
      .then((view) => {
        if (
          mounted.current &&
          current === generation.current &&
          coordination.isReadCurrent(binding)
        )
          emit({ type: "loaded", view });
      })
      .catch((error) => {
        if (mounted.current && current === generation.current)
          emit({ type: "error", error: String(error) });
      });
  }, [api, context, coordination, state.refresh]);
  const activate = useCallback(() => {
    if (!active.current) {
      active.current = true;
      refresh();
    }
  }, [refresh]);
  useEffect(() => {
    if (state.draft?.kind !== "includeRule" || !state.draft.target || !state.view || state.writing)
      return;
    let cancelled = false;
    const current = generation.current;
    const inspection = state.view.id;
    const intent = state.draft;
    const timer = window.setTimeout(() => {
      void api
        .planConfiguration({ inspection, intent })
        .then((plan) => {
          if (!cancelled && current === generation.current)
            emit({ type: "live", plan, error: null });
        })
        .catch((error) => {
          if (!cancelled && current === generation.current)
            emit({ type: "live", plan: null, error: String(error) });
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, state.draft, state.view, state.writing]);
  const changeContext = useCallback(
    (patch: Partial<ConfigurationContext>) => {
      if (state.writing) return;
      generation.current++;
      emit({ type: "context", patch });
    },
    [state.writing],
  );
  const chooseRepository = useCallback(async () => {
    try {
      const repository = await platform.pickFolder(state.context.repository ?? undefined);
      if (repository) changeContext({ repository });
    } catch (error) {
      emit({ type: "error", error: String(error) });
    }
  }, [platform, state.context.repository, changeContext]);
  const draft = useCallback((value: ConfigurationIntent | null) => {
    generation.current++;
    emit({ type: "draft", draft: value });
  }, []);
  const chooseRuleFolder = useCallback(
    async (caseSensitive: boolean) => {
      if (state.draft?.kind !== "includeRule") return;
      try {
        const path = await platform.pickFolder();
        if (path)
          draft({
            ...state.draft,
            condition: `${caseSensitive ? "gitdir:" : "gitdir/i:"}${path.replace(/\\/g, "/").replace(/\/$/, "")}/`,
          });
      } catch (error) {
        emit({ type: "error", error: String(error) });
      }
    },
    [platform, state.draft, draft],
  );
  const chooseIncludeTarget = useCallback(async () => {
    if (state.draft?.kind !== "includeRule") return;
    try {
      const target = await platform.pickFile();
      if (target) draft({ ...state.draft, target });
    } catch (error) {
      emit({ type: "error", error: String(error) });
    }
  }, [platform, state.draft, draft]);
  const preview = useCallback(async () => {
    if (!state.view || !state.draft) return;
    const current = ++generation.current;
    const binding = coordination.beginRead({ kind: "configuration" });
    emit({ type: "loading" });
    try {
      const plan = await api.planConfiguration({ inspection: state.view.id, intent: state.draft });
      if (current === generation.current && mounted.current && coordination.isReadCurrent(binding))
        emit({ type: "plan", plan });
    } catch (error) {
      if (current === generation.current && mounted.current)
        emit({ type: "error", error: String(error) });
    }
  }, [api, state.view, state.draft, coordination]);
  const write = useCallback(
    async (kind: "apply" | "undo" | "recovery") => {
      const id = kind === "apply" ? state.plan?.id : state.operation?.id;
      if (!id) return;
      const gate = coordination.tryBeginConfigurationWrite(kind);
      if (!gate.ok) {
        emit({ type: "error", error: gate.reason });
        return;
      }
      generation.current++;
      ownWrite.current = true;
      emit({ type: "writing" });
      try {
        let result: ConfigurationWriteResult;
        if (kind === "recovery") {
          await api.acknowledgeConfigurationRecovery(id);
          result = {
            status: "acknowledged",
            readback: "verified",
            message: null,
            operation: await api.configurationOperation(),
          };
        } else
          result = await (kind === "apply"
            ? api.applyConfiguration(id)
            : api.undoConfiguration(id));
        coordination.endConfigurationWrite(
          gate.admission,
          result.status !== "failed" && result.readback === "verified" ? "success" : "failure",
        );
        if (mounted.current) emit({ type: "result", result });
      } catch (error) {
        coordination.endConfigurationWrite(gate.admission, "failure");
        if (mounted.current) emit({ type: "error", error: String(error) });
      } finally {
        ownWrite.current = false;
      }
    },
    [api, coordination, state.operation, state.plan],
  );
  const forget = useCallback(
    async (path: string) => {
      try {
        await api.forgetConfigurationRepository(path);
        if (path === state.context.repository) changeContext({ repository: null });
        else refresh();
      } catch (error) {
        emit({ type: "error", error: String(error) });
      }
    },
    [api, refresh, changeContext, state.context.repository],
  );
  const dispatch = useCallback(
    (intent: ConfigurationUserIntent) => {
      switch (intent.type) {
        case "activate":
          activate();
          break;
        case "refresh":
          refresh();
          break;
        case "context":
          changeContext(intent.patch);
          break;
        case "chooseRepository":
          void chooseRepository();
          break;
        case "edit":
          draft(intent.draft);
          break;
        case "chooseRuleFolder":
          void chooseRuleFolder(intent.caseSensitive);
          break;
        case "chooseIncludeTarget":
          void chooseIncludeTarget();
          break;
        case "preview":
          void preview();
          break;
        case "apply":
          void write("apply");
          break;
        case "undo":
          void write("undo");
          break;
        case "acknowledgeRecovery":
          void write("recovery");
          break;
        case "forget":
          void forget(intent.path);
          break;
        case "closeReview":
          emit({ type: "plan", plan: null });
          break;
        case "section":
        case "host":
          emit(intent);
          break;
      }
    },
    [
      activate,
      refresh,
      changeContext,
      chooseRepository,
      draft,
      chooseRuleFolder,
      chooseIncludeTarget,
      preview,
      write,
      forget,
    ],
  );
  return { state, dispatch };
}
const Context = createContext<ReturnType<typeof useConfigurationController> | null>(null);
export function ConfigurationProvider({ children }: { children: ReactNode }) {
  const controller = useConfigurationController();
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useConfiguration() {
  const context = useContext(Context);
  if (!context) throw new Error("ConfigurationProvider required");
  return context;
}
