import type {
  ConfigurationContext,
  ConfigurationInspection,
  ConfigurationIntent,
  ConfigurationOperation,
  ConfigurationPlan,
  ConfigurationWriteResult,
} from "./api";
export interface ConfigurationState {
  gitTab: string;
  sshTab: string;
  host: string;
  context: ConfigurationContext;
  view: ConfigurationInspection | null;
  loading: boolean;
  writing: boolean;
  error: string | null;
  draft: ConfigurationIntent | null;
  plan: ConfigurationPlan | null;
  result: ConfigurationWriteResult | null;
  operation: ConfigurationOperation | null;
  refresh: number;
  livePlan: ConfigurationPlan | null;
  liveError: string | null;
}
export const initialConfigurationState: ConfigurationState = {
  gitTab: "identity",
  sshTab: "hosts",
  host: "",
  context: { repository: null, git: null, sshClient: null },
  view: null,
  loading: false,
  writing: false,
  error: null,
  draft: null,
  plan: null,
  result: null,
  operation: null,
  refresh: 0,
  livePlan: null,
  liveError: null,
};
export type ConfigurationMessage =
  | { type: "section"; page: "git-config" | "ssh"; section: string }
  | { type: "host"; name: string }
  | { type: "context"; patch: Partial<ConfigurationContext> }
  | { type: "refresh" }
  | { type: "loading" }
  | { type: "loaded"; view: ConfigurationInspection }
  | { type: "error"; error: string }
  | { type: "draft"; draft: ConfigurationIntent | null }
  | { type: "plan"; plan: ConfigurationPlan | null }
  | { type: "writing" }
  | { type: "result"; result: ConfigurationWriteResult }
  | { type: "live"; plan: ConfigurationPlan | null; error: string | null }
  | { type: "operation"; operation: ConfigurationOperation | null };
export function configurationReduce(
  state: ConfigurationState,
  message: ConfigurationMessage,
): ConfigurationState {
  switch (message.type) {
    case "section":
      return {
        ...state,
        ...(message.page === "ssh" ? { sshTab: message.section } : { gitTab: message.section }),
      };
    case "host":
      return { ...state, host: message.name };
    case "context":
      return {
        ...state,
        livePlan: null,
        liveError: null,
        context: { ...state.context, ...message.patch },
        view: null,
        plan: null,
        draft: null,
        error: null,
      };
    case "refresh":
      return {
        ...state,
        livePlan: null,
        liveError: null,
        refresh: state.refresh + 1,
        plan: null,
        draft: null,
        error: null,
      };
    case "loading":
      return { ...state, loading: true, error: null };
    case "loaded":
      return {
        ...state,
        loading: false,
        view: message.view,
        operation: message.view.operation ?? state.operation,
      };
    case "error":
      return { ...state, loading: false, writing: false, error: message.error, plan: null };
    case "draft":
      return {
        ...state,
        livePlan: null,
        liveError: null,
        draft: message.draft,
        plan: null,
        error: null,
      };
    case "plan":
      return { ...state, loading: false, plan: message.plan };
    case "writing":
      return { ...state, writing: true, error: null };
    case "result":
      return {
        ...state,
        writing: false,
        result: message.result,
        operation: message.result.operation,
        plan: null,
        draft: null,
        refresh: state.refresh + 1,
      };
    case "live":
      return { ...state, livePlan: message.plan, liveError: message.error };
    case "operation":
      return { ...state, operation: message.operation };
  }
}

/** User intents cross this single boundary; I/O results return as ConfigurationMessage events. */
export type ConfigurationUserIntent =
  | {
      type:
        | "activate"
        | "refresh"
        | "chooseRepository"
        | "chooseIncludeTarget"
        | "preview"
        | "apply"
        | "undo"
        | "acknowledgeRecovery"
        | "closeReview";
    }
  | { type: "context"; patch: Partial<ConfigurationContext> }
  | { type: "edit"; draft: ConfigurationIntent | null }
  | { type: "chooseRuleFolder"; caseSensitive: boolean }
  | { type: "forget"; path: string }
  | { type: "section"; page: "git-config" | "ssh"; section: string }
  | { type: "host"; name: string };
