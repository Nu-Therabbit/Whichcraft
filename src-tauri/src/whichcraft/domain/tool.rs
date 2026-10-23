//! The developer tools Whichcraft knows.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolKind {
    Java,
    Node,
    Python,
    Go,
    Flutter,
    Git,
}
