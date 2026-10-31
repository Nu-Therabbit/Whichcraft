//! Recovery after the app stopped in the middle of an apply (ticket 05, A-6).
//!
//! The journal is written before any registry change, so a journal still `Pending` at startup
//! means an apply did not finish. Each change is compared with the registry to say whether it
//! was written, and the user can finish the apply or roll it back.

use serde::Serialize;

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::model::{EnvChange, EnvValueKind, VarScope};
use crate::whichcraft::application::undo::{revert_journal, write_changes, UndoResult};
use crate::whichcraft::domain::env::get_var;
use crate::whichcraft::domain::journal::{JournalStatus, MutationRecord, WhichcraftJournal};
use crate::whichcraft::ports::elevator::Elevator;
use crate::whichcraft::ports::store::Store;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ChangeState {
    /// The registry holds the value the apply meant to write.
    Written,
    /// The registry still holds the value from before the apply.
    NotWritten,
    /// Neither: something else changed the variable meanwhile.
    ChangedElsewhere,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryItem {
    pub name: String,
    pub scope: VarScope,
    pub state: ChangeState,
    pub before: Option<String>,
    pub after: Option<String>,
    pub current: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryView {
    pub journal_id: String,
    pub kind: String,
    pub created_at: String,
    pub items: Vec<RecoveryItem>,
    /// Finishing is only offered when nothing changed elsewhere.
    pub can_resume: bool,
}

fn current_value<B: EnvBackend>(
    backend: &B,
    mutation: &MutationRecord,
) -> Result<Option<String>, EnvarlyError> {
    let map = match mutation.scope {
        VarScope::System => backend.read_system()?,
        VarScope::User => backend.read_user()?,
        VarScope::OtherUser => backend.read_other_user()?.unwrap_or_default(),
    };
    Ok(get_var(&map, &mutation.name).map(|v| v.value.clone()))
}

fn state_of(mutation: &MutationRecord, current: Option<&str>) -> ChangeState {
    let value = |v: &Option<crate::model::EnvValue>| v.as_ref().map(|v| v.value.clone());
    if current.map(str::to_string) == value(&mutation.after) {
        ChangeState::Written
    } else if current.map(str::to_string) == value(&mutation.before) {
        ChangeState::NotWritten
    } else {
        ChangeState::ChangedElsewhere
    }
}

fn view_of<B: EnvBackend>(
    backend: &B,
    journal: &WhichcraftJournal,
) -> Result<RecoveryView, EnvarlyError> {
    let mut items = Vec::new();
    for m in &journal.mutations {
        let current = current_value(backend, m)?;
        items.push(RecoveryItem {
            name: m.name.clone(),
            scope: m.scope.clone(),
            state: state_of(m, current.as_deref()),
            before: m.before.as_ref().map(|v| v.value.clone()),
            after: m.after.as_ref().map(|v| v.value.clone()),
            current,
        });
    }
    let can_resume = items
        .iter()
        .all(|i| i.state != ChangeState::ChangedElsewhere);
    Ok(RecoveryView {
        journal_id: journal.id.clone(),
        kind: journal.kind.clone(),
        created_at: journal.created_at.clone(),
        items,
        can_resume,
    })
}

/// The newest apply that never finished, with the real state of each of its changes.
pub fn inspect_pending<B: EnvBackend>(
    backend: &B,
    store: &dyn Store,
) -> Result<Option<RecoveryView>, EnvarlyError> {
    match store.incomplete_journal()? {
        Some(journal) => Ok(Some(view_of(backend, &journal)?)),
        None => Ok(None),
    }
}

fn load_pending(store: &dyn Store, journal_id: &str) -> Result<WhichcraftJournal, EnvarlyError> {
    let journal = store.journal(journal_id)?;
    if journal.status != JournalStatus::Pending {
        return Err(EnvarlyError::InvalidInput(format!(
            "journal {journal_id} is not an unfinished apply"
        )));
    }
    Ok(journal)
}

/// Writes the changes the interrupted apply had not written yet, then records its selections.
pub fn resume_pending<B: EnvBackend>(
    backend: &B,
    store: &dyn Store,
    elevator: Option<&dyn Elevator>,
    journal_id: &str,
) -> Result<(), EnvarlyError> {
    let mut journal = load_pending(store, journal_id)?;
    let view = view_of(backend, &journal)?;
    if !view.can_resume {
        return Err(EnvarlyError::InvalidInput(
            "some variables changed since the apply stopped; roll it back instead".into(),
        ));
    }
    let planned: Vec<(EnvChange, Option<String>)> = journal
        .mutations
        .iter()
        .zip(&view.items)
        .filter(|(_, item)| item.state == ChangeState::NotWritten)
        .map(|(m, item)| {
            let change = match &m.after {
                Some(after) => EnvChange::Set {
                    name: m.name.clone(),
                    value: after.value.clone(),
                    value_kind: after.kind.unwrap_or(EnvValueKind::String),
                    scope: m.scope.clone(),
                },
                None => EnvChange::Delete {
                    name: m.name.clone(),
                    scope: m.scope.clone(),
                },
            };
            (change, item.current.clone())
        })
        .collect();
    write_changes(backend, elevator, planned)?;
    for selection in &journal.selections {
        store.save_selection(selection)?;
    }
    journal.status = JournalStatus::Completed;
    store.save_journal(&journal)
}

/// Puts back whatever the interrupted apply had written, with the same rules as Undo.
pub fn roll_back_pending<B: EnvBackend>(
    backend: &B,
    store: &dyn Store,
    elevator: Option<&dyn Elevator>,
    journal_id: &str,
) -> Result<UndoResult, EnvarlyError> {
    revert_journal(backend, store, elevator, load_pending(store, journal_id)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    use crate::model::EnvValue;
    use crate::whichcraft::application::tool_apply::test_support::FakeElevator;
    use crate::whichcraft::domain::path::path_entry_diff;
    use crate::whichcraft::domain::selection::ToolSelection;
    use crate::whichcraft::domain::ToolKind;
    use crate::whichcraft::persistence::save_journal;
    use crate::whichcraft::persistence::FileStore;
    use crate::whichcraft::persistence::{
        load_incomplete_journal, load_last_completed_apply, load_tool_selection, use_test_data_dir,
    };

    fn ev(v: &str, kind: EnvValueKind) -> Option<EnvValue> {
        Some(EnvValue::typed(v.into(), kind))
    }

    /// The journal a Java apply leaves before writing: JAVA_HOME, then User PATH.
    fn pending_java_apply(backend: &MemBackend) -> WhichcraftJournal {
        let (added, removed) = path_entry_diff("C:\\u", "C:\\jdk17\\bin;C:\\u");
        let journal = WhichcraftJournal {
            id: "apply-interrupted".into(),
            status: JournalStatus::Pending,
            kind: "java_apply".into(),
            created_at: "2026-10-23T09:00:00Z".into(),
            baseline: crate::env_store::read_snapshot_with(backend).unwrap(),
            mutations: vec![
                MutationRecord {
                    name: "JAVA_HOME".into(),
                    scope: VarScope::User,
                    before: ev("C:\\jdk11", EnvValueKind::String),
                    after: ev("C:\\jdk17", EnvValueKind::String),
                    path_added: vec![],
                    path_removed: vec![],
                },
                MutationRecord {
                    name: "Path".into(),
                    scope: VarScope::User,
                    before: ev("C:\\u", EnvValueKind::ExpandString),
                    after: ev("C:\\jdk17\\bin;C:\\u", EnvValueKind::ExpandString),
                    path_added: added,
                    path_removed: removed,
                },
            ],
            selections: vec![ToolSelection {
                tool: ToolKind::Java,
                root: "C:\\jdk17".into(),
                vendor: "Eclipse Adoptium".into(),
                version: "17.0.20.1".into(),
            }],
        };
        save_journal(&journal).unwrap();
        journal
    }

    /// The app was killed after writing JAVA_HOME but before PATH.
    fn half_written() -> MemBackend {
        MemBackend::new().with_user([("JAVA_HOME", "C:\\jdk17"), ("Path", "C:\\u")])
    }

    #[test]
    fn an_interrupted_apply_shows_what_was_and_was_not_written() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = half_written();
        pending_java_apply(&b);

        let view = inspect_pending(&b, &FileStore)
            .unwrap()
            .expect("pending apply found");
        assert_eq!(view.journal_id, "apply-interrupted");
        assert_eq!(view.items[0].state, ChangeState::Written);
        assert_eq!(view.items[1].state, ChangeState::NotWritten);
        assert!(view.can_resume);
    }

    #[test]
    fn resuming_writes_the_rest_and_records_the_selection() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = half_written();
        pending_java_apply(&b);

        resume_pending(&b, &FileStore, None, "apply-interrupted").unwrap();
        let user = b.read_user().unwrap();
        assert_eq!(user["JAVA_HOME"].value, "C:\\jdk17");
        assert_eq!(user["Path"].value, "C:\\jdk17\\bin;C:\\u");
        assert_eq!(
            load_tool_selection(ToolKind::Java).unwrap().unwrap().root,
            std::path::PathBuf::from("C:\\jdk17")
        );
        assert!(load_incomplete_journal().unwrap().is_none());
        assert_eq!(
            load_last_completed_apply().unwrap().unwrap().id,
            "apply-interrupted"
        );
    }

    #[test]
    fn rolling_back_restores_only_what_was_written() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = half_written();
        pending_java_apply(&b);

        let result = roll_back_pending(&b, &FileStore, None, "apply-interrupted").unwrap();
        assert!(result.conflicts.is_empty());
        let user = b.read_user().unwrap();
        assert_eq!(user["JAVA_HOME"].value, "C:\\jdk11");
        assert_eq!(user["Path"].value, "C:\\u");
        assert!(load_incomplete_journal().unwrap().is_none());
        assert!(load_tool_selection(ToolKind::Java).unwrap().is_none());
    }

    #[test]
    fn a_variable_changed_elsewhere_blocks_resume_but_not_roll_back() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        // An installer rewrote PATH while the app was down.
        let b = MemBackend::new()
            .with_user([("JAVA_HOME", "C:\\jdk17"), ("Path", "C:\\u;C:\\installer")]);
        pending_java_apply(&b);

        let view = inspect_pending(&b, &FileStore).unwrap().unwrap();
        assert_eq!(view.items[1].state, ChangeState::ChangedElsewhere);
        assert!(!view.can_resume);
        assert!(resume_pending(&b, &FileStore, None, "apply-interrupted").is_err());

        roll_back_pending(&b, &FileStore, None, "apply-interrupted").unwrap();
        let user = b.read_user().unwrap();
        assert_eq!(user["JAVA_HOME"].value, "C:\\jdk11");
        assert_eq!(user["Path"].value, "C:\\u;C:\\installer");
    }

    #[test]
    fn resuming_a_system_change_goes_through_the_helper() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = MemBackend::new()
            .with_system([("Path", "C:\\Windows;C:\\Program Files\\nodejs\\")])
            .with_elevated(false);
        let (added, removed) =
            path_entry_diff("C:\\Windows;C:\\Program Files\\nodejs\\", "C:\\Windows");
        save_journal(&WhichcraftJournal {
            id: "apply-system".into(),
            status: JournalStatus::Pending,
            kind: "node_apply".into(),
            created_at: "2026-10-23T09:00:00Z".into(),
            baseline: crate::env_store::read_snapshot_with(&b).unwrap(),
            mutations: vec![MutationRecord {
                name: "Path".into(),
                scope: VarScope::System,
                before: ev(
                    "C:\\Windows;C:\\Program Files\\nodejs\\",
                    EnvValueKind::ExpandString,
                ),
                after: ev("C:\\Windows", EnvValueKind::ExpandString),
                path_added: added,
                path_removed: removed,
            }],
            selections: vec![],
        })
        .unwrap();
        let elevator = FakeElevator::new(&b, vec![]);

        resume_pending(&b, &FileStore, Some(&elevator), "apply-system").unwrap();
        assert_eq!(b.read_system().unwrap()["Path"].value, "C:\\Windows");
        assert_eq!(elevator.requests.lock().unwrap().len(), 1);
    }

    #[test]
    fn a_finished_journal_cannot_be_resumed_or_rolled_back() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let b = half_written();
        let mut journal = pending_java_apply(&b);
        journal.status = JournalStatus::Completed;
        save_journal(&journal).unwrap();
        assert!(resume_pending(&b, &FileStore, None, "apply-interrupted").is_err());
        assert!(roll_back_pending(&b, &FileStore, None, "apply-interrupted").is_err());
        assert!(inspect_pending(&b, &FileStore).unwrap().is_none());
    }
}
