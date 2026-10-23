use crate::env_store::{self, EnvBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvChange, EnvValue, VarScope};
use crate::whichcraft::persistence::{
    load_incomplete_journal, new_journal_id, save_java_selection, save_journal, JavaSelection,
    JournalStatus, MutationRecord, WhichcraftJournal,
};
use crate::whichcraft::services::java_plan::{
    build_java_apply_plan, diff_to_env_value, plan_is_stale, plan_to_mutations, JavaApplyPlan,
};
use crate::whichcraft::java::JavaInstallation;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyJavaResult {
    pub plan_id: String,
    pub stale: bool,
}

pub fn create_java_plan<B: EnvBackend>(
    backend: &B,
    installation: &JavaInstallation,
) -> Result<JavaApplyPlan, EnvarlyError> {
    build_java_apply_plan(backend, installation, new_journal_id())
}

pub fn apply_java_plan<B: EnvBackend>(
    backend: &B,
    plan: &JavaApplyPlan,
) -> Result<ApplyJavaResult, EnvarlyError> {
    if plan_is_stale(plan, backend)? {
        return Ok(ApplyJavaResult {
            plan_id: plan.plan_id.clone(),
            stale: true,
        });
    }

    let mut mutations = Vec::new();
    let mut changes = Vec::new();

    for (diff, (path_added, path_removed)) in plan_to_mutations(plan) {
        let map = match diff.scope {
            VarScope::User => backend.read_user()?,
            VarScope::System => backend.read_system()?,
            VarScope::OtherUser => backend
                .read_other_user()?
                .ok_or_else(|| EnvarlyError::InvalidInput("no other-user account selected".into()))?,
        };
        let before = map.get(&diff.name).cloned();
        let after_value = diff_to_env_value(&diff);
        mutations.push(MutationRecord {
            name: diff.name.clone(),
            scope: diff.scope.clone(),
            before: before.clone(),
            after: Some(after_value.clone()),
            path_added,
            path_removed,
        });
        changes.push(EnvChange::Set {
            name: diff.name,
            value: diff.after,
            value_kind: diff.value_kind,
            scope: diff.scope,
        });
    }

    let journal = WhichcraftJournal {
        id: plan.plan_id.clone(),
        status: JournalStatus::Pending,
        kind: "java_apply".into(),
        created_at: chrono::Utc::now().to_rfc3339(),
        baseline: plan.baseline.clone(),
        mutations: mutations.clone(),
    };
    save_journal(&journal)?;

    if let Err(err) = env_store::apply_changes_with(backend, &changes, |_, _, _, _| {}) {
        let mut failed = journal;
        failed.status = JournalStatus::Failed;
        let _ = save_journal(&failed);
        return Err(err);
    }

    save_java_selection(&JavaSelection {
        root: plan.selected.root.clone(),
        vendor: plan.selected.vendor.clone(),
        version: plan.selected.version.clone(),
    })?;

    let mut completed = journal;
    completed.status = JournalStatus::Completed;
    save_journal(&completed)?;

    Ok(ApplyJavaResult {
        plan_id: plan.plan_id.clone(),
        stale: false,
    })
}

pub fn incomplete_apply_journal() -> Result<Option<WhichcraftJournal>, EnvarlyError> {
    load_incomplete_journal()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;

    #[test]
    fn apply_java_plan_writes_java_home_and_prepends_path() {
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("LOCALAPPDATA", dir.path());

        let jdk = dir.path().join("jdk");
        std::fs::create_dir_all(jdk.join("bin")).unwrap();
        std::fs::write(
            jdk.join("release"),
            "IMPLEMENTOR=\"V\"\nJAVA_VERSION=\"21.0.1\"\n",
        )
        .unwrap();
        std::fs::write(jdk.join("bin").join("java.exe"), b"").unwrap();

        let installation = JavaInstallation {
            vendor: "V".into(),
            version: "21.0.1".into(),
            root: jdk.clone(),
            managed: false,
        };
        let backend = MemBackend::new().with_user([("Path", "C:\\old")]).with_system([]);
        let plan = create_java_plan(&backend, &installation).expect("plan");
        let result = apply_java_plan(&backend, &plan).expect("apply");
        assert!(!result.stale);

        let user = backend.read_user().unwrap();
        assert_eq!(
            user.get("JAVA_HOME").map(|v| v.value.as_str()),
            Some(jdk.to_string_lossy().as_ref())
        );
        assert!(user
            .get("Path")
            .map(|v| v.value.as_str())
            .unwrap()
            .starts_with(&jdk.join("bin").to_string_lossy().to_string()));
    }
}
