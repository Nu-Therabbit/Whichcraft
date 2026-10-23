use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::whichcraft::api::ToolKind;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInstallation {
    pub tool: ToolKind,
    pub vendor: String,
    pub version: String,
    pub root: PathBuf,
    pub managed: bool,
}
