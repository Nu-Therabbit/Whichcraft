use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteVersion {
    pub version: String,
    pub download_bytes: Option<u64>,
    pub install_bytes: Option<u64>,
}

pub trait ToolManager: Send + Sync {
    fn list_remote(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError>;
}
