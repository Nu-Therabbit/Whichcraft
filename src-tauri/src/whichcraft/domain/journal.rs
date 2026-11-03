//! The record of one apply: what it changed and how far it got, for Undo and recovery.

use serde::{Deserialize, Serialize};

use crate::model::{EnvSnapshot, EnvValue, VarScope};

use super::selection::ToolSelection;
use super::tool::ToolKind;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum JournalStatus {
    Pending,
    Completed,
    Failed,
    /// A completed apply that has since been undone; Undo skips it.
    Undone,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MutationRecord {
    pub name: String,
    pub scope: VarScope,
    pub before: Option<EnvValue>,
    pub after: Option<EnvValue>,
    #[serde(default)]
    pub path_added: Vec<String>,
    #[serde(default)]
    pub path_removed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WhichcraftJournal {
    pub id: String,
    pub status: JournalStatus,
    pub kind: String,
    pub created_at: String,
    pub baseline: EnvSnapshot,
    pub mutations: Vec<MutationRecord>,
    /// The tool choices this apply records once it completes, so a resumed apply records them too.
    #[serde(default)]
    pub selections: Vec<ToolSelection>,
    /// What each of `selections` replaced, so Undo can put the earlier choice back.
    #[serde(default)]
    pub previous_selections: Vec<PreviousSelection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreviousSelection {
    pub tool: ToolKind,
    /// `None` when the tool had no choice yet.
    pub selection: Option<ToolSelection>,
}
