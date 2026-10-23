use serde::{Deserialize, Serialize};

use crate::whichcraft::ports::machine::Machine;
use crate::whichcraft::application::registry_expander;
use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::model::VarScope;
use crate::whichcraft::ports::operation_ids::OperationIds;
use crate::whichcraft::domain::PlanVariableDiff;
use crate::whichcraft::domain::path::path_entries;
use crate::whichcraft::domain::ToolApplyPlan;
use crate::whichcraft::ToolKind;
use crate::whichcraft::domain::ToolInstallation;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathCleanupPlan {
    #[serde(flatten)]
    pub inner: ToolApplyPlan,
    pub removed_duplicates: Vec<String>,
    pub removed_missing: Vec<String>,
}

pub fn build_path_cleanup_plan<B: EnvBackend>(
    backend: &B,
    machine: &dyn Machine,
    ids: &dyn OperationIds,
) -> Result<PathCleanupPlan, EnvarlyError> {
    let user = backend.read_user()?;
    let system = backend.read_system()?;
    let before = user.get("Path").map(|v| v.value.clone()).unwrap_or_default();
    let (after, removed_duplicates, removed_missing) = cleanup_path(&before, registry_expander(&user, &system, machine), machine);

    let baseline = crate::env_store::read_snapshot_with(backend)?;
    let kind = user
        .get("Path")
        .and_then(|v| v.kind)
        .unwrap_or(crate::model::EnvValueKind::ExpandString);

    let user_diffs = if after == before {
        vec![]
    } else {
        vec![PlanVariableDiff {
            name: "Path".into(),
            scope: VarScope::User,
            before: Some(before),
            after,
            value_kind: kind,
        }]
    };

    Ok(PathCleanupPlan {
        inner: ToolApplyPlan {
            plan_id: ids.new_apply_id(),
            tool: ToolKind::Node,
            requires_uac: false,
            warnings: Vec::new(),
            limitation_notice: "PATH cleanup only adjusts User PATH entries.".into(),
            user_diffs,
            system_diffs: Vec::new(),
            baseline,
            selected: ToolInstallation {
                tool: ToolKind::Node,
                vendor: "Whichcraft".into(),
                version: "path-cleanup".into(),
                root: std::path::PathBuf::from("."),
                managed: true,
            },
            additional_selections: Vec::new(),
            records_selection: false,
            effective_after_user_only: true,
        },
        removed_duplicates,
        removed_missing,
    })
}

/// Drops entries that repeat an earlier one (compared after expanding, ignoring case and a
/// trailing separator) and entries whose folder does not exist. An entry with a variable that
/// cannot be expanded is kept: there is no telling what it will mean (C-2).
fn cleanup_path(raw: &str, expand: impl Fn(&str) -> String, machine: &dyn Machine) -> (String, Vec<String>, Vec<String>) {
    let mut seen: Vec<String> = Vec::new();
    let mut kept = Vec::new();
    let mut removed_duplicates = Vec::new();
    let mut removed_missing = Vec::new();

    for entry in path_entries(raw) {
        let expanded = expand(&entry);
        let unresolved = expanded.matches('%').count() >= 2;
        if !unresolved && !machine.dir_exists(&expanded) {
            removed_missing.push(entry.clone());
            continue;
        }
        let key = expanded.trim_end_matches(['\\', '/']).to_ascii_lowercase();
        if seen.contains(&key) {
            removed_duplicates.push(entry.clone());
            continue;
        }
        seen.push(key);
        kept.push(entry);
    }
    (kept.join(";"), removed_duplicates, removed_missing)
}

#[cfg(test)]
mod tests {
    use crate::whichcraft::adapters::local::LocalMachine;
    use crate::whichcraft::adapters::operation_ids::SystemOperationIds;
    use super::*;

    #[test]
    fn removes_duplicate_entries() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a");
        let b = dir.path().join("b");
        std::fs::create_dir_all(&a).unwrap();
        std::fs::create_dir_all(&b).unwrap();
        let raw = format!("{};{};{}", a.display(), b.display(), a.display());
        let (after, dupes, missing) = cleanup_path(&raw, |s| s.to_string(), &LocalMachine);
        assert_eq!(dupes.len(), 1);
        assert!(missing.is_empty());
        assert!(after.contains(&a.to_string_lossy().to_string()));
        assert!(after.contains(&b.to_string_lossy().to_string()));
    }

    fn vars(pairs: &[(&str, String)]) -> std::collections::HashMap<String, crate::model::EnvValue> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), crate::model::EnvValue::typed(v.clone(), crate::model::EnvValueKind::ExpandString)))
            .collect()
    }

    #[test]
    fn repeated_go_bin_and_a_vanished_folder_are_proposed_not_removed() {
        // C-1: go\bin three times (one with a trailing slash, one through a variable) and a dead Ollama path.
        let dir = tempfile::tempdir().unwrap();
        let go_bin = dir.path().join("go").join("bin");
        std::fs::create_dir_all(&go_bin).unwrap();
        let ollama = dir.path().join("Programs").join("Ollama");
        let user_vars = vars(&[("HOMEDIR", dir.path().to_string_lossy().into_owned())]);
        let raw = format!("{0};{0}\\;%HOMEDIR%\\go\\bin;{1}", go_bin.display(), ollama.display());
        let backend = crate::env_store::MemBackend::new();
        backend.user.lock().unwrap().extend(vars(&[("Path", raw.clone())]));
        backend.user.lock().unwrap().extend(user_vars);

        let plan = build_path_cleanup_plan(&backend, &LocalMachine, &SystemOperationIds).unwrap();
        assert_eq!(plan.removed_duplicates.len(), 2);
        assert_eq!(plan.removed_missing, vec![ollama.to_string_lossy().into_owned()]);
        assert_eq!(plan.inner.user_diffs[0].after, go_bin.to_string_lossy());
        assert_eq!(backend.read_user().unwrap()["Path"].value, raw, "planning writes nothing");
    }

    /// Plans (never applies) a cleanup of this machine's User PATH. `cargo test contract_path_cleanup -- --ignored --nocapture`
    #[test]
    #[ignore = "contract: reads the real registry"]
    fn contract_path_cleanup_on_this_machine() {
        let plan =
            build_path_cleanup_plan(&crate::env_backend::WinregBackend, &LocalMachine, &SystemOperationIds).unwrap();
        println!("duplicates: {:?}\nmissing: {:?}", plan.removed_duplicates, plan.removed_missing);
        assert!(
            plan.removed_duplicates.iter().any(|d| d.to_ascii_lowercase().ends_with("go\\bin")),
            "the survey machine repeats go\\bin"
        );
        assert!(plan.removed_missing.iter().any(|m| m.to_ascii_lowercase().contains("ollama")));
        assert!(!plan.removed_missing.iter().any(|m| m.contains('%')), "variables that resolve are kept");
    }

    #[test]
    fn variables_are_expanded_from_the_registry_before_judging() {
        // C-2: %JAVA_HOME%\bin stays when the registry's JAVA_HOME exists, whatever this process holds.
        let dir = tempfile::tempdir().unwrap();
        let jdk_bin = dir.path().join("jdk21").join("bin");
        std::fs::create_dir_all(&jdk_bin).unwrap();
        let user = vars(&[("JAVA_HOME", dir.path().join("jdk21").to_string_lossy().into_owned())]);
        let system = vars(&[]);
        let raw = "%JAVA_HOME%\\bin;%WHICHCRAFT_UNSET_VAR_42%\\bin";
        let (after, dupes, missing) = cleanup_path(raw, registry_expander(&user, &system, &LocalMachine), &LocalMachine);
        assert_eq!(after, raw);
        assert!(dupes.is_empty() && missing.is_empty());

        let gone = vars(&[("JAVA_HOME", dir.path().join("jdk17-removed").to_string_lossy().into_owned())]);
        let (_, _, missing) = cleanup_path("%JAVA_HOME%\\bin", registry_expander(&gone, &system, &LocalMachine), &LocalMachine);
        assert_eq!(missing, vec!["%JAVA_HOME%\\bin"]);
    }
}
