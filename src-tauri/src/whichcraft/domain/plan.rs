//! A switch as a plan: the variables it writes, shown as a diff before anything is applied.

use serde::{Deserialize, Serialize};

pub const RESTART_LIMITATION_NOTICE: &str =
    "Programs already running and IDEs with their own SDK settings will not pick up these changes until restarted.";

use crate::model::{EnvSnapshot, EnvValueKind, VarScope};

use super::installation::ToolInstallation;
use super::tool::ToolKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanVariableDiff {
    pub name: String,
    pub scope: VarScope,
    pub before: Option<String>,
    pub after: String,
    pub value_kind: EnvValueKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolApplyPlan {
    pub plan_id: String,
    pub tool: ToolKind,
    pub requires_uac: bool,
    pub warnings: Vec<String>,
    pub limitation_notice: String,
    pub user_diffs: Vec<PlanVariableDiff>,
    pub system_diffs: Vec<PlanVariableDiff>,
    pub baseline: EnvSnapshot,
    pub selected: ToolInstallation,
    /// Other tools this plan also selects (a profile applies several tools as one plan).
    #[serde(default)]
    pub additional_selections: Vec<ToolInstallation>,
    /// False for plans that are not a tool choice (PATH cleanup); applying them leaves the
    /// remembered selections alone.
    #[serde(default = "records_selection_default")]
    pub records_selection: bool,
    pub effective_after_user_only: bool,
}

fn records_selection_default() -> bool {
    true
}

pub fn path_dirs_for_tool(installation: &ToolInstallation) -> Vec<String> {
    match installation.tool {
        ToolKind::Java => vec![
            installation.root.join("bin").to_string_lossy().into_owned(),
        ],
        ToolKind::Node | ToolKind::Python => {
            vec![installation.root.to_string_lossy().into_owned()]
        }
        ToolKind::Go => vec![
            installation
                .root
                .join("bin")
                .to_string_lossy()
                .into_owned(),
        ],
        ToolKind::Flutter => vec![
            installation
                .root
                .join("bin")
                .to_string_lossy()
                .into_owned(),
        ],
        ToolKind::Git => vec![
            installation
                .root
                .join("cmd")
                .to_string_lossy()
                .into_owned(),
            installation
                .root
                .join("bin")
                .to_string_lossy()
                .into_owned(),
        ],
    }
}
