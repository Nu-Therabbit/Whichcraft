use serde::{Deserialize, Serialize};

use crate::commands::path::{dir_exists, expand_env_vars};
use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::model::VarScope;
use crate::whichcraft::persistence::new_journal_id;
use crate::whichcraft::services::java_plan::PlanVariableDiff;
use crate::whichcraft::services::path_plan::path_entries;
use crate::whichcraft::services::tool_plan::ToolApplyPlan;
use crate::whichcraft::ToolKind;
use crate::whichcraft::ports::installation_probe::ToolInstallation;

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
) -> Result<PathCleanupPlan, EnvarlyError> {
    let user = backend.read_user()?;
    let before = user.get("Path").map(|v| v.value.clone()).unwrap_or_default();
    let (after, removed_duplicates, removed_missing) = cleanup_path(&before);

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
            plan_id: new_journal_id(),
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
            effective_after_user_only: true,
        },
        removed_duplicates,
        removed_missing,
    })
}

fn cleanup_path(raw: &str) -> (String, Vec<String>, Vec<String>) {
    let mut seen = Vec::new();
    let mut kept = Vec::new();
    let mut removed_duplicates = Vec::new();
    let mut removed_missing = Vec::new();

    for entry in path_entries(raw) {
        let expanded = expand_env_vars(&entry);
        if !dir_exists(&expanded) {
            removed_missing.push(entry.clone());
            continue;
        }
        if seen.iter().any(|s: &String| s.eq_ignore_ascii_case(&entry)) {
            removed_duplicates.push(entry.clone());
            continue;
        }
        seen.push(entry.clone());
        kept.push(entry);
    }
    (kept.join(";"), removed_duplicates, removed_missing)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_duplicate_entries() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a");
        let b = dir.path().join("b");
        std::fs::create_dir_all(&a).unwrap();
        std::fs::create_dir_all(&b).unwrap();
        let raw = format!("{};{};{}", a.display(), b.display(), a.display());
        let (after, dupes, missing) = cleanup_path(&raw);
        assert_eq!(dupes.len(), 1);
        assert!(missing.is_empty());
        assert!(after.contains(&a.to_string_lossy().to_string()));
        assert!(after.contains(&b.to_string_lossy().to_string()));
    }
}
