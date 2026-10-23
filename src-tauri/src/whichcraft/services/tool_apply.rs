use crate::env_store::{self, EnvBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvChange, VarScope};
use crate::whichcraft::persistence::{
    new_journal_id, save_journal, save_tool_selection, JournalStatus, MutationRecord,
    ToolSelection, WhichcraftJournal,
};
use crate::whichcraft::ports::elevator::{ElevatedOutcome, ElevatedRequest, Elevator, ExpectedChange};
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::services::get_var;
use crate::whichcraft::services::tool_plan::PlanVariableDiff;
use crate::whichcraft::services::tool_plan::{
    build_tool_apply_plan, diff_to_env_value, plan_to_mutations, tool_plan_is_stale, ToolApplyPlan,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyToolResult {
    pub plan_id: String,
    pub stale: bool,
    pub needs_elevation: bool,
}

pub fn create_tool_plan<B: EnvBackend>(
    backend: &B,
    installation: &ToolInstallation,
) -> Result<ToolApplyPlan, EnvarlyError> {
    build_tool_apply_plan(backend, installation, new_journal_id())
}

/// Applies a plan in this process. A plan that touches System needs this process to be elevated.
pub fn apply_tool_plan<B: EnvBackend>(
    backend: &B,
    plan: &ToolApplyPlan,
) -> Result<ApplyToolResult, EnvarlyError> {
    apply_tool_plan_with(backend, None, plan)
}

/// Applies a plan, writing the System part through a UAC-elevated helper when needed.
pub fn apply_tool_plan_elevated<B: EnvBackend>(
    backend: &B,
    elevator: &dyn Elevator,
    plan: &ToolApplyPlan,
) -> Result<ApplyToolResult, EnvarlyError> {
    apply_tool_plan_with(backend, Some(elevator), plan)
}

fn apply_tool_plan_with<B: EnvBackend>(
    backend: &B,
    elevator: Option<&dyn Elevator>,
    plan: &ToolApplyPlan,
) -> Result<ApplyToolResult, EnvarlyError> {
    let result = |stale, needs_elevation| ApplyToolResult {
        plan_id: plan.plan_id.clone(),
        stale,
        needs_elevation,
    };
    if tool_plan_is_stale(plan, backend)? {
        return Ok(result(true, false));
    }
    let via_helper = !plan.system_diffs.is_empty() && !backend.is_elevated();
    if via_helper && elevator.is_none() {
        return Ok(result(false, true));
    }

    let mut mutations = Vec::new();
    let mut in_process = Vec::new();
    for (diff, (path_added, path_removed)) in plan_to_mutations(plan) {
        let map = match diff.scope {
            VarScope::User => backend.read_user()?,
            VarScope::System => backend.read_system()?,
            VarScope::OtherUser => backend
                .read_other_user()?
                .ok_or_else(|| EnvarlyError::InvalidInput("no other-user account selected".into()))?,
        };
        mutations.push(MutationRecord {
            name: diff.name.clone(),
            scope: diff.scope.clone(),
            before: get_var(&map, &diff.name).cloned(),
            after: Some(diff_to_env_value(&diff)),
            path_added,
            path_removed,
        });
        if !(via_helper && diff.scope == VarScope::System) {
            in_process.push(set_change(&diff));
        }
    }

    // Journal every mutation, System included, before anything is written.
    let mut journal = WhichcraftJournal {
        id: plan.plan_id.clone(),
        status: JournalStatus::Pending,
        kind: if plan.records_selection {
            format!("{}_apply", tool_slug(plan.selected.tool))
        } else {
            "path_cleanup".into()
        },
        created_at: chrono::Utc::now().to_rfc3339(),
        baseline: plan.baseline.clone(),
        mutations,
        selections: std::iter::once(&plan.selected)
            .chain(&plan.additional_selections)
            .filter(|_| plan.records_selection)
            .map(|i| ToolSelection {
                tool: i.tool,
                root: i.root.clone(),
                vendor: i.vendor.clone(),
                version: i.version.clone(),
            })
            .collect(),
    };
    save_journal(&journal)?;
    let fail = |journal: &mut WhichcraftJournal| {
        journal.status = JournalStatus::Failed;
        let _ = save_journal(journal);
    };

    // System first: if UAC is declined or the plan went stale, nothing has been written yet.
    let helper = elevator.filter(|_| via_helper);
    if let Some(elevator) = helper {
        let request = ElevatedRequest {
            changes: plan
                .system_diffs
                .iter()
                .map(|d| ExpectedChange {
                    expected_before: d.before.clone(),
                    change: set_change(d),
                })
                .collect(),
        };
        match elevator.apply_system(&request) {
            Ok(ElevatedOutcome::Applied) => {}
            Ok(ElevatedOutcome::Stale) => {
                fail(&mut journal);
                return Ok(result(true, false));
            }
            Ok(ElevatedOutcome::Cancelled) => {
                fail(&mut journal);
                return Err(EnvarlyError::InvalidInput(
                    "UAC was cancelled; nothing was written".into(),
                ));
            }
            Ok(ElevatedOutcome::Failed(msg)) => {
                fail(&mut journal);
                return Err(EnvarlyError::InvalidInput(format!("System write failed: {msg}")));
            }
            Err(e) => {
                fail(&mut journal);
                return Err(e);
            }
        }
    }

    if let Err(err) = env_store::apply_changes_with(backend, &in_process, |_, _, _, _| {}) {
        // Envarly rolled back the in-process writes; undo the System part the helper wrote.
        let mut message = err.to_string();
        if let Some(elevator) = helper {
            let revert = ElevatedRequest {
                changes: plan.system_diffs.iter().map(revert_change).collect(),
            };
            if !matches!(elevator.apply_system(&revert), Ok(ElevatedOutcome::Applied)) {
                message.push_str(&format!(
                    "; System changes could not be reverted, journal {} records them",
                    journal.id
                ));
            }
        }
        fail(&mut journal);
        return Err(EnvarlyError::InvalidInput(message));
    }

    for selection in &journal.selections {
        save_tool_selection(selection)?;
    }

    journal.status = JournalStatus::Completed;
    save_journal(&journal)?;
    Ok(result(false, false))
}

fn set_change(diff: &PlanVariableDiff) -> EnvChange {
    EnvChange::Set {
        name: diff.name.clone(),
        value: diff.after.clone(),
        value_kind: diff.value_kind,
        scope: diff.scope.clone(),
    }
}

fn revert_change(diff: &PlanVariableDiff) -> ExpectedChange {
    ExpectedChange {
        expected_before: Some(diff.after.clone()),
        change: match &diff.before {
            Some(before) => EnvChange::Set {
                name: diff.name.clone(),
                value: before.clone(),
                value_kind: diff.value_kind,
                scope: diff.scope.clone(),
            },
            None => EnvChange::Delete {
                name: diff.name.clone(),
                scope: diff.scope.clone(),
            },
        },
    }
}

fn tool_slug(tool: crate::whichcraft::api::ToolKind) -> &'static str {
    match tool {
        crate::whichcraft::api::ToolKind::Java => "java",
        crate::whichcraft::api::ToolKind::Node => "node",
        crate::whichcraft::api::ToolKind::Python => "python",
        crate::whichcraft::api::ToolKind::Go => "go",
        crate::whichcraft::api::ToolKind::Flutter => "flutter",
        crate::whichcraft::api::ToolKind::Git => "git",
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use crate::env_store::{EnvBackend, MemBackend};
    use crate::error::EnvarlyError;
    use crate::model::EnvValue;
    use crate::whichcraft::ports::elevator::{ElevatedOutcome, ElevatedRequest, Elevator};
    use crate::whichcraft::services::elevation::{encode_request, run_elevated_request};

    /// The System hive as the elevated helper sees it: same maps, but allowed to write.
    struct ElevatedView<'a>(&'a MemBackend);

    impl EnvBackend for ElevatedView<'_> {
        fn read_user(&self) -> Result<HashMap<String, EnvValue>, EnvarlyError> {
            self.0.read_user()
        }
        fn read_system(&self) -> Result<HashMap<String, EnvValue>, EnvarlyError> {
            self.0.read_system()
        }
        fn write_user(&self, name: &str, value: &EnvValue) -> Result<(), EnvarlyError> {
            self.0.write_user(name, value)
        }
        fn write_system(&self, name: &str, value: &EnvValue) -> Result<(), EnvarlyError> {
            self.0.system.lock().unwrap().insert(name.into(), value.clone());
            Ok(())
        }
        fn delete_user(&self, name: &str) -> Result<(), EnvarlyError> {
            self.0.delete_user(name)
        }
        fn delete_system(&self, name: &str) -> Result<(), EnvarlyError> {
            self.0.system.lock().unwrap().remove(name);
            Ok(())
        }
        fn is_elevated(&self) -> bool {
            true
        }
    }

    pub enum Script {
        /// Run the real helper logic against the backend's System hive.
        Helper,
        Cancel,
        /// Something edits System PATH between planning and the helper running.
        ChangeSystemPathFirst(&'static str),
    }

    pub struct FakeElevator<'a> {
        pub backend: &'a MemBackend,
        pub script: Mutex<Vec<Script>>,
        pub requests: Mutex<Vec<ElevatedRequest>>,
    }

    impl<'a> FakeElevator<'a> {
        pub fn new(backend: &'a MemBackend, script: Vec<Script>) -> Self {
            Self { backend, script: Mutex::new(script), requests: Mutex::new(Vec::new()) }
        }
    }

    impl Elevator for FakeElevator<'_> {
        fn apply_system(&self, request: &ElevatedRequest) -> Result<ElevatedOutcome, EnvarlyError> {
            self.requests.lock().unwrap().push(request.clone());
            let step = {
                let mut script = self.script.lock().unwrap();
                if script.is_empty() { Script::Helper } else { script.remove(0) }
            };
            if let Script::Cancel = step {
                return Ok(ElevatedOutcome::Cancelled);
            }
            if let Script::ChangeSystemPathFirst(value) = step {
                ElevatedView(self.backend)
                    .write_system("Path", &EnvValue::typed(value.into(), crate::model::EnvValueKind::ExpandString))?;
            }
            let (bytes, hash) = encode_request(request)?;
            Ok(run_elevated_request(&ElevatedView(self.backend), &bytes, &hash))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{FakeElevator, Script};
    use super::*;
    use crate::env_store::MemBackend;
    use crate::model::EnvValueKind;
    use crate::whichcraft::api::ToolKind;
    use crate::whichcraft::persistence::{load_last_completed_apply, use_test_data_dir};

    /// A plan that adds C:\node22 to User PATH and removes C:\Program Files\nodejs\ from System PATH.
    fn shadowed_node_plan(backend: &MemBackend) -> ToolApplyPlan {
        let snapshot = env_store::read_snapshot_with(backend).unwrap();
        ToolApplyPlan {
            plan_id: new_journal_id(),
            tool: ToolKind::Node,
            requires_uac: true,
            warnings: vec![],
            limitation_notice: String::new(),
            user_diffs: vec![PlanVariableDiff {
                name: "Path".into(),
                scope: VarScope::User,
                before: Some("C:\\u".into()),
                after: "C:\\node22;C:\\u".into(),
                value_kind: EnvValueKind::ExpandString,
            }],
            system_diffs: vec![PlanVariableDiff {
                name: "Path".into(),
                scope: VarScope::System,
                before: Some("C:\\Windows;C:\\Program Files\\nodejs\\".into()),
                after: "C:\\Windows".into(),
                value_kind: EnvValueKind::ExpandString,
            }],
            baseline: snapshot,
            selected: ToolInstallation {
                tool: ToolKind::Node,
                vendor: "Node.js".into(),
                version: "22.23.4".into(),
                root: "C:\\node22".into(),
                managed: true,
            },
            additional_selections: vec![],
            records_selection: true,
            effective_after_user_only: false,
        }
    }

    #[test]
    fn java_plan_sets_java_home_and_prepends_bin_and_remembers_the_jdk() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let jdk = dir.path().join("jdk");
        std::fs::create_dir_all(jdk.join("bin")).unwrap();
        std::fs::write(jdk.join("release"), "IMPLEMENTOR=\"V\"\nJAVA_VERSION=\"21.0.1\"\n").unwrap();
        std::fs::write(jdk.join("bin").join("java.exe"), b"").unwrap();
        let installation = ToolInstallation {
            tool: ToolKind::Java,
            vendor: "V".into(),
            version: "21.0.1".into(),
            root: jdk.clone(),
            managed: false,
        };
        let b = MemBackend::new().with_user([("Path", "C:\\old")]);

        let plan = create_tool_plan(&b, &installation).unwrap();
        assert!(!apply_tool_plan(&b, &plan).unwrap().stale);

        let user = b.read_user().unwrap();
        assert_eq!(user["JAVA_HOME"].value, jdk.to_string_lossy());
        assert!(user["Path"].value.starts_with(&*jdk.join("bin").to_string_lossy()));
        let selected = crate::whichcraft::persistence::load_tool_selection(ToolKind::Java).unwrap().unwrap();
        assert_eq!(selected.root, jdk);
    }

    #[test]
    fn java_selection_is_none_when_only_other_tools_were_selected() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        save_tool_selection(&ToolSelection {
            tool: ToolKind::Node,
            root: "C:\\node22".into(),
            vendor: "Node.js".into(),
            version: "22.23.4".into(),
        })
        .unwrap();
        assert!(crate::whichcraft::persistence::load_tool_selection(ToolKind::Java).unwrap().is_none());
    }

    #[test]
    fn applying_a_path_cleanup_leaves_selections_alone() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let keep = dir.path().join("keep");
        std::fs::create_dir_all(&keep).unwrap();
        let path = leak_str(format!("{0};C:\\gone-for-good;{0}", keep.display()));
        let b = MemBackend::new().with_user([("Path", path)]);

        let cleanup = crate::whichcraft::services::path_cleanup::build_path_cleanup_plan(&b).unwrap();
        apply_tool_plan(&b, &cleanup.inner).unwrap();

        assert_eq!(b.read_user().unwrap()["Path"].value, keep.to_string_lossy());
        assert!(crate::whichcraft::persistence::load_tool_selection(ToolKind::Node).unwrap().is_none());
        assert_eq!(load_last_completed_apply().unwrap().unwrap().kind, "path_cleanup");
    }

    fn leak_str(s: String) -> &'static str {
        Box::leak(s.into_boxed_str())
    }

    fn backend() -> MemBackend {
        MemBackend::new()
            .with_user([("Path", "C:\\u")])
            .with_system([("Path", "C:\\Windows;C:\\Program Files\\nodejs\\")])
            .with_elevated(false)
    }

    fn path(map: &std::collections::HashMap<String, crate::model::EnvValue>) -> String {
        map["Path"].value.clone()
    }

    #[test]
    fn writes_system_through_the_helper_then_user_and_journals_both() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = backend();
        let elevator = FakeElevator::new(&b, vec![]);
        let result = apply_tool_plan_elevated(&b, &elevator, &shadowed_node_plan(&b)).unwrap();
        assert!(!result.stale && !result.needs_elevation);
        assert_eq!(path(&b.read_system().unwrap()), "C:\\Windows");
        assert_eq!(path(&b.read_user().unwrap()), "C:\\node22;C:\\u");
        let journal = load_last_completed_apply().unwrap().expect("completed journal");
        assert!(journal.mutations.iter().any(|m| m.scope == VarScope::System));
        assert!(journal.mutations.iter().any(|m| m.scope == VarScope::User));
    }

    #[test]
    fn cancelled_uac_writes_nothing_at_all() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = backend();
        let elevator = FakeElevator::new(&b, vec![Script::Cancel]);
        assert!(apply_tool_plan_elevated(&b, &elevator, &shadowed_node_plan(&b)).is_err());
        assert_eq!(path(&b.read_user().unwrap()), "C:\\u");
        assert_eq!(path(&b.read_system().unwrap()), "C:\\Windows;C:\\Program Files\\nodejs\\");
        assert!(load_last_completed_apply().unwrap().is_none());
    }

    #[test]
    fn plan_gone_stale_while_waiting_for_uac_writes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = backend();
        let plan = shadowed_node_plan(&b);
        let moved = "C:\\Windows;C:\\Program Files\\nodejs\\;C:\\new";
        let elevator = FakeElevator::new(&b, vec![Script::ChangeSystemPathFirst(moved)]);
        let result = apply_tool_plan_elevated(&b, &elevator, &plan).unwrap();
        assert!(result.stale);
        assert_eq!(path(&b.read_system().unwrap()), moved);
        assert_eq!(path(&b.read_user().unwrap()), "C:\\u");
    }

    #[test]
    fn helper_only_ever_receives_system_scope() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = backend();
        let elevator = FakeElevator::new(&b, vec![]);
        apply_tool_plan_elevated(&b, &elevator, &shadowed_node_plan(&b)).unwrap();
        let requests = elevator.requests.lock().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(requests[0].changes.iter().all(|c| matches!(
            &c.change,
            EnvChange::Set { scope: VarScope::System, .. }
        )));
    }

    /// Lets System through to the inner backend but refuses every User write.
    struct UserWritesFail<'a>(&'a MemBackend);

    impl crate::env_store::EnvBackend for UserWritesFail<'_> {
        fn read_user(&self) -> Result<std::collections::HashMap<String, crate::model::EnvValue>, EnvarlyError> {
            self.0.read_user()
        }
        fn read_system(&self) -> Result<std::collections::HashMap<String, crate::model::EnvValue>, EnvarlyError> {
            self.0.read_system()
        }
        fn write_user(&self, _: &str, _: &crate::model::EnvValue) -> Result<(), EnvarlyError> {
            Err(EnvarlyError::InvalidInput("user hive locked".into()))
        }
        fn write_system(&self, name: &str, value: &crate::model::EnvValue) -> Result<(), EnvarlyError> {
            self.0.write_system(name, value)
        }
        fn delete_user(&self, _: &str) -> Result<(), EnvarlyError> {
            Err(EnvarlyError::InvalidInput("user hive locked".into()))
        }
        fn delete_system(&self, name: &str) -> Result<(), EnvarlyError> {
            self.0.delete_system(name)
        }
        fn is_elevated(&self) -> bool {
            false
        }
    }

    #[test]
    fn a_failed_user_write_reverts_what_the_helper_wrote_to_system() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let inner = backend();
        let b = UserWritesFail(&inner);
        let elevator = FakeElevator::new(&inner, vec![]);
        assert!(apply_tool_plan_elevated(&b, &elevator, &shadowed_node_plan(&inner)).is_err());
        assert_eq!(path(&inner.read_system().unwrap()), "C:\\Windows;C:\\Program Files\\nodejs\\");
        assert_eq!(path(&inner.read_user().unwrap()), "C:\\u");
        // One request to apply, one to revert.
        assert_eq!(elevator.requests.lock().unwrap().len(), 2);
        assert!(load_last_completed_apply().unwrap().is_none());
    }

    #[test]
    fn without_an_elevator_a_system_plan_asks_for_elevation() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = backend();
        let result = apply_tool_plan(&b, &shadowed_node_plan(&b)).unwrap();
        assert!(result.needs_elevation);
        assert_eq!(path(&b.read_user().unwrap()), "C:\\u");
    }
}
