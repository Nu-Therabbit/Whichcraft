use serde::{Deserialize, Serialize};

use crate::commands::path::dir_exists;
use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::model::{EnvSnapshot, EnvValue, EnvValueKind, VarScope};
use crate::path_manage;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::services::get_var;
use crate::whichcraft::services::path_plan::{compute_prepend, path_entries, path_entry_diff};

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

pub fn build_tool_apply_plan<B: EnvBackend>(
    backend: &B,
    installation: &ToolInstallation,
    plan_id: String,
) -> Result<ToolApplyPlan, EnvarlyError> {
    if !installation.root.is_dir() {
        return Err(EnvarlyError::InvalidInput(
            "installation folder is missing (unavailable)".into(),
        ));
    }

    let baseline = crate::env_store::read_snapshot_with(backend)?;
    let user = backend.read_user()?;
    let system = backend.read_system()?;

    let path_before = user.get("Path").map(|v| v.value.clone()).unwrap_or_default();
    let path_kind = user
        .get("Path")
        .and_then(|v| v.kind)
        .unwrap_or(EnvValueKind::ExpandString);

    let mut path_after = path_before.clone();
    for dir in path_dirs_for_tool(installation) {
        if let Some(next) = compute_prepend(&path_after, &dir) {
            path_after = next;
        }
    }

    let mut user_diffs = Vec::new();
    if installation.tool == ToolKind::Java {
        let root = installation.root.to_string_lossy().into_owned();
        let java_home_before = user.get("JAVA_HOME").map(|v| v.value.clone());
        let java_home_kind = user
            .get("JAVA_HOME")
            .and_then(|v| v.kind)
            .unwrap_or(EnvValueKind::String);
        user_diffs.push(PlanVariableDiff {
            name: "JAVA_HOME".into(),
            scope: VarScope::User,
            before: java_home_before,
            after: root,
            value_kind: java_home_kind,
        });
    }

    if path_after != path_before {
        user_diffs.push(PlanVariableDiff {
            name: "Path".into(),
            scope: VarScope::User,
            before: Some(path_before.clone()),
            after: path_after.clone(),
            value_kind: path_kind,
        });
    }

    let system_path_before = system.get("Path").map(|v| v.value.clone()).unwrap_or_default();
    let system_path_kind = system
        .get("Path")
        .and_then(|v| v.kind)
        .unwrap_or(EnvValueKind::ExpandString);

    let mut system_diffs = Vec::new();
    let mut warnings = Vec::new();
    let cmd = crate::whichcraft::tools::command_name(installation.tool);
    let pathext = user
        .get("PATHEXT")
        .or_else(|| system.get("PATHEXT"))
        .map(|v| v.value.as_str())
        .unwrap_or("");

    // Judge PATH with the values this plan writes: a System `%JAVA_HOME%\bin` follows the new
    // JAVA_HOME, so it is not a shadow to remove.
    let mut user_after = user.clone();
    for diff in &user_diffs {
        user_after.insert(diff.name.clone(), crate::model::EnvValue::typed(diff.after.clone(), diff.value_kind));
    }
    let expand = crate::whichcraft::services::registry_expander(&user_after, &system);
    let check_user = path_manage::check_command_with(
        cmd,
        &path_after,
        system_path_before.as_str(),
        pathext,
        &expand,
        dir_exists,
    );
    let effective_after_user = check_user.hits.first().is_some_and(|hit| {
        path_dirs_for_tool(installation)
            .iter()
            .any(|d| hit.directory.eq_ignore_ascii_case(d))
    });

    if !effective_after_user {
        if let Some(shadow) = find_system_shadow(&system_path_before, installation, &expand) {
            let mut system_after = system_path_before.clone();
            system_after = remove_path_entry(&system_after, &shadow);
            system_diffs.push(PlanVariableDiff {
                name: "Path".into(),
                scope: VarScope::System,
                before: Some(system_path_before.clone()),
                after: system_after,
                value_kind: system_path_kind,
            });
            warnings.push(format!(
                "system_path_removal: will remove {shadow} from System PATH (affects all users)"
            ));
        } else {
            warnings.push(format!(
                "system_path_may_still_win: effective {cmd} may not change until System PATH is adjusted"
            ));
        }
    }

    for dir in path_dirs_for_tool(installation) {
        if is_local_appdata_path(&dir) && system_diffs.iter().any(|d| d.scope == VarScope::System) {
            return Err(EnvarlyError::InvalidInput(
                "refusing to mirror LocalAppData paths into System PATH".into(),
            ));
        }
    }

    let requires_uac = !system_diffs.is_empty();

    Ok(ToolApplyPlan {
        plan_id,
        tool: installation.tool,
        requires_uac,
        warnings,
        limitation_notice:
            "Programs already running and IDEs with their own SDK settings will not pick up these changes until restarted."
                .into(),
        user_diffs,
        system_diffs,
        baseline,
        selected: installation.clone(),
        additional_selections: Vec::new(),
        records_selection: true,
        effective_after_user_only: effective_after_user,
    })
}

/// True when any variable the plan touches no longer has the value the plan was built from.
pub fn tool_plan_is_stale(plan: &ToolApplyPlan, backend: &dyn EnvBackend) -> Result<bool, EnvarlyError> {
    let current = crate::env_store::read_snapshot_with(backend)?;
    for diff in plan.user_diffs.iter().chain(plan.system_diffs.iter()) {
        let map = match diff.scope {
            VarScope::User => &current.user,
            VarScope::System => &current.system,
            VarScope::OtherUser => current.other_user.as_ref().unwrap_or(&current.user),
        };
        if get_var(map, &diff.name).map(|v| v.value.as_str()) != diff.before.as_deref() {
            return Ok(true);
        }
    }
    Ok(false)
}

fn find_system_shadow(
    system_path: &str,
    installation: &ToolInstallation,
    expand: &dyn Fn(&str) -> String,
) -> Option<String> {
    let selected_dirs: Vec<String> = path_dirs_for_tool(installation);
    for entry in path_entries(system_path) {
        let expanded = expand(&entry);
        if !dir_exists(&expanded) {
            continue;
        }
        for sel in &selected_dirs {
            if entry.eq_ignore_ascii_case(sel) {
                continue;
            }
            if would_shadow(&expanded, sel, installation.tool) {
                return Some(entry);
            }
        }
    }
    None
}

fn would_shadow(system_dir: &str, selected_dir: &str, tool: ToolKind) -> bool {
    let cmd = crate::whichcraft::tools::command_name(tool);
    let hit = path_manage::check_command_with(
        cmd,
        selected_dir,
        system_dir,
        ".EXE;.CMD;.BAT",
        // Both folders are already expanded.
        |s: &str| s.to_string(),
        dir_exists,
    );
    !hit.hits.is_empty()
}

fn remove_path_entry(path: &str, entry: &str) -> String {
    path_entries(path)
        .into_iter()
        .filter(|e| !e.eq_ignore_ascii_case(entry))
        .collect::<Vec<_>>()
        .join(";")
}

fn is_local_appdata_path(dir: &str) -> bool {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return dir
            .trim_end_matches(['\\', '/'])
            .eq_ignore_ascii_case(local.trim_end_matches(['\\', '/']));
    }
    false
}

pub fn diff_to_env_value(diff: &PlanVariableDiff) -> EnvValue {
    EnvValue::typed(diff.after.clone(), diff.value_kind)
}

/// Each diff with the PATH entries it adds and removes (empty for other variables).
pub fn plan_to_mutations(
    plan: &ToolApplyPlan,
) -> Vec<(PlanVariableDiff, (Vec<String>, Vec<String>))> {
    plan.user_diffs
        .iter()
        .chain(plan.system_diffs.iter())
        .map(|diff| {
            let entries = if diff.name.eq_ignore_ascii_case("path") {
                path_entry_diff(diff.before.as_deref().unwrap_or(""), &diff.after)
            } else {
                (Vec::new(), Vec::new())
            };
            (diff.clone(), entries)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;

    fn leak(s: String) -> &'static str {
        Box::leak(s.into_boxed_str())
    }

    #[test]
    fn a_system_java_home_bin_entry_follows_the_new_java_home_and_is_not_removed() {
        let dir = tempfile::tempdir().unwrap();
        for jdk in ["jdk17", "jdk21"] {
            std::fs::create_dir_all(dir.path().join(jdk).join("bin")).unwrap();
            std::fs::write(dir.path().join(jdk).join("bin").join("java.exe"), b"").unwrap();
        }
        let jdk17 = leak(dir.path().join("jdk17").to_string_lossy().into_owned());
        let backend = MemBackend::new()
            .with_user([("Path", r"C:\u")])
            .with_system([("Path", r"%JAVA_HOME%\bin"), ("JAVA_HOME", jdk17), ("PATHEXT", ".EXE;.CMD;.BAT")]);
        let jdk21 = ToolInstallation {
            tool: ToolKind::Java,
            vendor: "Eclipse Adoptium".into(),
            version: "21.0.12".into(),
            root: dir.path().join("jdk21"),
            managed: false,
        };
        let plan = build_tool_apply_plan(&backend, &jdk21, "p".into()).unwrap();
        assert!(plan.system_diffs.is_empty(), "{:?}", plan.system_diffs);
        assert!(!plan.requires_uac);
    }
}
