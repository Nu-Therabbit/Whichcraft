use serde::{Deserialize, Serialize};

use crate::error::WhichcraftError;
use crate::model::EnvChange;

/// One System-scope change plus the value the plan saw, so the elevated side can refuse a stale plan.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedChange {
    pub expected_before: Option<String>,
    pub change: EnvChange,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ElevatedRequest {
    pub changes: Vec<ExpectedChange>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ElevatedOutcome {
    Applied,
    /// The user declined the UAC prompt; nothing was written.
    Cancelled,
    /// A System value changed after the plan was made; nothing was written.
    Stale,
    Failed(String),
}

/// Writes System-scope changes from a separate process elevated through UAC, and waits for it.
pub trait Elevator {
    fn apply_system(&self, request: &ElevatedRequest) -> Result<ElevatedOutcome, WhichcraftError>;
}
