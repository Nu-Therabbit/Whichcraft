export interface ConfigurationContext {
  repository: string | null;
  git: string | null;
  sshClient: string | null;
}
export interface ConfigExecutable {
  path: string;
  label: string;
  effective: boolean;
}
export interface ConfigOccurrence {
  id: string;
  key: string;
  value: string;
  source: string;
  scope: string;
  line: number | null;
  editable: boolean;
  reason: string | null;
}
export interface ConfigSource {
  path: string;
  scope: string;
  includedFrom: string | null;
  revision: string;
  content: string;
  writable: boolean;
  reason: string | null;
}
export interface CommitIdentity {
  name: ConfigOccurrence | null;
  email: ConfigOccurrence | null;
}
export interface ConditionalInclude {
  id: string;
  condition: string;
  target: string;
  source: string;
  line: number;
  editable: boolean;
  reason: string | null;
  active: boolean;
}
export interface GitInspection {
  executable: string;
  version: string;
  remoteRules: boolean;
  impactPreview: boolean;
  repository: string | null;
  gitDirectory: string | null;
  commonDirectory: string | null;
  identity: CommitIdentity;
  occurrences: ConfigOccurrence[];
  sources: ConfigSource[];
  rules: ConditionalInclude[];
  diagnostics: string[];
  trustCommand: string | null;
}
export interface SshHost {
  name: string;
  values: ConfigOccurrence[];
  unresolved: string[];
}
export interface PublicKeyInfo {
  path: string;
  exists: boolean;
  referenced: boolean;
  algorithm: string | null;
  fingerprint: string | null;
}
export interface SshInspection {
  client: string | null;
  clients: ConfigExecutable[];
  command: string | null;
  sources: ConfigSource[];
  hosts: SshHost[];
  keys: PublicKeyInfo[];
  diagnostics: string[];
}
export interface ConfigurationOperation {
  id: string;
  source: string;
  status: string;
  recovery: string | null;
}
export interface ConfigurationInspection {
  id: string;
  context: ConfigurationContext;
  executables: ConfigExecutable[];
  recentRepositories: { path: string; available: boolean }[];
  git: GitInspection;
  ssh: SshInspection;
  operation: ConfigurationOperation | null;
}
export type ConfigurationIntent =
  | { kind: "gitValue" | "sshIdentity"; occurrence: string; value: string }
  | { kind: "includeRule"; rule: string | null; source: string; condition: string; target: string };
export interface ConfigurationImpact {
  repository: string;
  status: string;
  reason: string | null;
  before: CommitIdentity;
  after: CommitIdentity;
  matched: boolean | null;
}
export interface ConfigurationPlan {
  id: string;
  source: string;
  scope: string;
  before: string;
  after: string;
  impacts: ConfigurationImpact[];
  warnings: string[];
}
export interface ConfigurationWriteResult {
  status: string;
  readback: string;
  message: string | null;
  operation: ConfigurationOperation | null;
}
export interface ConfigurationApi {
  inspectConfiguration(context: ConfigurationContext): Promise<ConfigurationInspection>;
  planConfiguration(request: {
    inspection: string;
    intent: ConfigurationIntent;
  }): Promise<ConfigurationPlan>;
  applyConfiguration(id: string): Promise<ConfigurationWriteResult>;
  undoConfiguration(id: string): Promise<ConfigurationWriteResult>;
  configurationOperation(): Promise<ConfigurationOperation | null>;
  acknowledgeConfigurationRecovery(id: string): Promise<void>;
  forgetConfigurationRepository(path: string): Promise<void>;
}
