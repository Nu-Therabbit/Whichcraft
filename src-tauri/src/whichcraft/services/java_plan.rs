use serde::{Deserialize, Serialize};

use crate::commands::path::{dir_exists, expand_env_vars};
use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::model::{EnvSnapshot, EnvValue, EnvValueKind, VarScope};
use crate::path_manage;
use crate::whichcraft::java::JavaInstallation;
use crate::whichcraft::services::path_plan::{compute_prepend, path_entry_diff};

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
pub struct JavaApplyPlan {
    pub plan_id: String,
    pub requires_uac: bool,
    pub warnings: Vec<String>,
    pub limitation_notice: String,
    pub user_diffs: Vec<PlanVariableDiff>,
    pub system_diffs: Vec<PlanVariableDiff>,
    pub baseline: EnvSnapshot,
    pub selected: JavaInstallation,
    pub effective_after_user_only: bool,
}

pub fn build_java_apply_plan<B: EnvBackend>(
    backend: &B,
    installation: &JavaInstallation,
    plan_id: String,
) -> Result<JavaApplyPlan, EnvarlyError> {
    let baseline = crate::env_store::read_snapshot_with(backend)?;
    let user = backend.read_user()?;
    let system = backend.read_system()?;

    let root = installation.root.to_string_lossy().into_owned();
    let bin_dir = installation
        .root
        .join("bin")
        .to_string_lossy()
        .into_owned();

    let java_home_before = user.get("JAVA_HOME").map(|v| v.value.clone());
    let java_home_kind = user
        .get("JAVA_HOME")
        .and_then(|v| v.kind)
        .unwrap_or(EnvValueKind::String);

    let path_before = user.get("Path").map(|v| v.value.clone()).unwrap_or_default();
    let path_kind = user
        .get("Path")
        .and_then(|v| v.kind)
        .unwrap_or(EnvValueKind::ExpandString);

    let path_after = compute_prepend(&path_before, &bin_dir).unwrap_or(path_before.clone());

    let mut user_diffs = vec![
        PlanVariableDiff {
            name: "JAVA_HOME".into(),
            scope: VarScope::User,
            before: java_home_before.clone(),
            after: root.clone(),
            value_kind: java_home_kind,
        },
    ];

    if path_after != path_before {
        user_diffs.push(PlanVariableDiff {
            name: "Path".into(),
            scope: VarScope::User,
            before: Some(path_before.clone()),
            after: path_after.clone(),
            value_kind: path_kind,
        });
    }

    let user_path_raw = path_after.as_str();
    let system_path_raw = system.get("Path").map(|v| v.value.as_str()).unwrap_or("");
    let pathext = user
        .get("PATHEXT")
        .or_else(|| system.get("PATHEXT"))
        .map(|v| v.value.as_str())
        .unwrap_or("");

    let check = path_manage::check_command_with(
        "java",
        user_path_raw,
        system_path_raw,
        pathext,
        expand_env_vars,
        dir_exists,
    );
    let selected_bin = installation.root.join("bin");
    let effective_after = check.hits.first().is_some_and(|hit| {
        hit.directory
            .trim_end_matches(['\\', '/'])
            .eq_ignore_ascii_case(&selected_bin.to_string_lossy())
    });

    let mut warnings = Vec::new();
    if !effective_after {
        warnings.push(
            "system_path_may_still_win: applying user-only changes may not change the effective java.exe until System PATH is adjusted"
                .into(),
        );
    }

    Ok(JavaApplyPlan {
        plan_id,
        requires_uac: false,
        warnings,
        limitation_notice: "Programs already running and IDEs with their own SDK settings will not pick up these changes until restarted."
            .into(),
        user_diffs,
        system_diffs: Vec::new(),
        baseline,
        selected: installation.clone(),
        effective_after_user_only: effective_after,
    })
}

pub fn plan_is_stale(plan: &JavaApplyPlan, backend: &dyn EnvBackend) -> Result<bool, EnvarlyError> {
    let current = crate::env_store::read_snapshot_with(backend)?;
    for diff in plan.user_diffs.iter().chain(plan.system_diffs.iter()) {
        let map = match diff.scope {
            VarScope::User => &current.user,
            VarScope::System => &current.system,
            VarScope::OtherUser => {
                current.other_user.as_ref().unwrap_or(&current.user)
            }
        };
        let live = crate::whichcraft::services::get_var(map, &diff.name).map(|v| v.value.as_str());
        let expected = diff.before.as_deref();
        if live != expected {
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn plan_to_mutations(plan: &JavaApplyPlan) -> Vec<(PlanVariableDiff, (Vec<String>, Vec<String>))> {
    plan.user_diffs
        .iter()
        .chain(plan.system_diffs.iter())
        .map(|diff| {
            let (added, removed) = if diff.name.eq_ignore_ascii_case("path") {
                path_entry_diff(
                    diff.before.as_deref().unwrap_or(""),
                    diff.after.as_str(),
                )
            } else {
                (Vec::new(), Vec::new())
            };
            (diff.clone(), (added, removed))
        })
        .collect()
}

pub fn diff_to_env_value(diff: &PlanVariableDiff) -> EnvValue {
    EnvValue::typed(diff.after.clone(), diff.value_kind)
}
