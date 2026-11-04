//! Transport-safe configuration evidence and typed editing intents. No filesystem access.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationContext {
    pub repository: Option<String>,
    pub git: Option<String>,
    pub ssh_client: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigExecutable {
    pub path: String,
    pub label: String,
    pub effective: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigOccurrence {
    pub id: String,
    pub key: String,
    pub value: String,
    pub source: String,
    pub scope: String,
    pub line: Option<usize>,
    pub editable: bool,
    pub reason: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSource {
    pub path: String,
    pub scope: String,
    pub included_from: Option<String>,
    pub revision: String,
    pub content: String,
    pub writable: bool,
    pub reason: Option<String>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitIdentity {
    pub name: Option<ConfigOccurrence>,
    pub email: Option<ConfigOccurrence>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionalInclude {
    pub id: String,
    pub condition: String,
    pub target: String,
    pub source: String,
    pub line: usize,
    pub editable: bool,
    pub reason: Option<String>,
    pub active: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInspection {
    pub executable: String,
    pub version: String,
    pub remote_rules: bool,
    pub impact_preview: bool,
    pub repository: Option<String>,
    pub git_directory: Option<String>,
    pub common_directory: Option<String>,
    pub identity: CommitIdentity,
    pub occurrences: Vec<ConfigOccurrence>,
    pub sources: Vec<ConfigSource>,
    pub rules: Vec<ConditionalInclude>,
    pub diagnostics: Vec<String>,
    pub trust_command: Option<String>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshHost {
    pub name: String,
    pub values: Vec<ConfigOccurrence>,
    pub unresolved: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicKeyInfo {
    pub path: String,
    pub exists: bool,
    pub referenced: bool,
    pub algorithm: Option<String>,
    pub fingerprint: Option<String>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshInspection {
    pub client: Option<String>,
    pub clients: Vec<ConfigExecutable>,
    pub command: Option<String>,
    pub sources: Vec<ConfigSource>,
    pub hosts: Vec<SshHost>,
    pub keys: Vec<PublicKeyInfo>,
    pub diagnostics: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentRepository {
    pub path: String,
    pub available: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationInspection {
    pub id: String,
    pub context: ConfigurationContext,
    pub executables: Vec<ConfigExecutable>,
    pub recent_repositories: Vec<RecentRepository>,
    pub git: GitInspection,
    pub ssh: SshInspection,
    pub operation: Option<ConfigurationOperationView>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ConfigurationIntent {
    GitValue {
        occurrence: String,
        value: String,
    },
    SshIdentity {
        occurrence: String,
        value: String,
    },
    IncludeRule {
        rule: Option<String>,
        source: String,
        condition: String,
        target: String,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationPlanRequest {
    pub inspection: String,
    pub intent: ConfigurationIntent,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationImpact {
    pub repository: String,
    pub status: String,
    pub reason: Option<String>,
    pub before: CommitIdentity,
    pub after: CommitIdentity,
    pub matched: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationPlan {
    pub id: String,
    pub source: String,
    pub scope: String,
    pub before: String,
    pub after: String,
    pub impacts: Vec<ConfigurationImpact>,
    pub warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationOperationView {
    pub id: String,
    pub source: String,
    pub status: String,
    pub recovery: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationWriteResult {
    pub status: String,
    pub readback: String,
    pub message: Option<String>,
    pub operation: Option<ConfigurationOperationView>,
}
