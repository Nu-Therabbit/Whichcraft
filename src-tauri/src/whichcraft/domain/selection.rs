//! The installation the user chose for a tool, remembered so it can be shown even if it vanishes.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::tool::ToolKind;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolSelection {
    pub tool: ToolKind,
    pub root: PathBuf,
    pub vendor: String,
    pub version: String,
}
