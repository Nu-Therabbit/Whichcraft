use crate::env_store::{self, EnvBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvChange, EnvValueKind, VarScope};
use crate::whichcraft::domain::env::get_var;
use crate::whichcraft::domain::journal::{JournalStatus, WhichcraftJournal};
use crate::whichcraft::ports::elevator::{
    ElevatedOutcome, ElevatedRequest, Elevator, ExpectedChange,
};
use crate::whichcraft::ports::store::Store;

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UndoConflict {
    pub name: String,
    pub scope: VarScope,
    pub message: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoResult {
    pub conflicts: Vec<UndoConflict>,
    pub restored: usize,
}

/// Takes out the entries the app added and puts back the ones it removed, keeping everything
/// else that is in the current value, including entries other programs added since.
fn restore_path_value(current: &str, added: &[String], removed: &[String], before: &str) -> String {
    // Keep untouched raw segments, including empty entries and original spacing.
    let raw_entries = |value: &str| -> Vec<String> {
        if value.is_empty() {
            Vec::new()
        } else {
            value.split(';').map(str::to_string).collect()
        }
    };
    let mut entries = raw_entries(current);
    for a in added {
        entries.retain(|e| !e.trim().eq_ignore_ascii_case(a.trim()));
    }
    let before_entries = raw_entries(before);
    for r in removed {
        if entries
            .iter()
            .any(|e| e.trim().eq_ignore_ascii_case(r.trim()))
        {
            continue;
        }
        if let Some(pos) = before_entries
            .iter()
            .position(|e| e.trim().eq_ignore_ascii_case(r.trim()))
        {
            let insert_at = pos.min(entries.len());
            entries.insert(insert_at, r.clone());
        } else {
            entries.push(r.clone());
        }
    }
    entries.join(";")
}

/// Undoes the most recent completed apply. System changes go through `elevator` unless this
/// process can write HKLM itself.
pub fn undo_last_apply<B: EnvBackend>(
    backend: &B,
    store: &dyn Store,
    elevator: Option<&dyn Elevator>,
) -> Result<UndoResult, EnvarlyError> {
    match store.last_completed_apply()? {
        Some(journal) => revert_journal(backend, store, elevator, journal),
        None => Ok(UndoResult {
            conflicts: vec![],
            restored: 0,
        }),
    }
}

/// Puts back what `journal` changed and marks it undone. A mutation that was never written
/// (or already reverted) is skipped, so this also rolls back an interrupted apply.
pub fn revert_journal<B: EnvBackend>(
    backend: &B,
    store: &dyn Store,
    elevator: Option<&dyn Elevator>,
    mut journal: WhichcraftJournal,
) -> Result<UndoResult, EnvarlyError> {
    let mut conflicts = Vec::new();
    // (change, value the variable has right now) per mutation, newest first.
    let mut planned: Vec<(EnvChange, Option<String>)> = Vec::new();

    for mutation in journal.mutations.iter().rev() {
        let map = match mutation.scope {
            VarScope::User => backend.read_user()?,
            VarScope::System => backend.read_system()?,
            VarScope::OtherUser => backend.read_other_user()?.ok_or_else(|| {
                EnvarlyError::InvalidInput("no other-user account selected".into())
            })?,
        };
        let current = get_var(&map, &mutation.name);
        let current_value = current.map(|v| v.value.clone());
        // Write back under the name the registry already uses (PATH vs Path).
        let name = map
            .keys()
            .find(|k| k.eq_ignore_ascii_case(&mutation.name))
            .cloned()
            .unwrap_or_else(|| mutation.name.clone());

        if mutation.name.eq_ignore_ascii_case("path") {
            let current_val = current_value.as_deref().unwrap_or("");
            let before_val = mutation
                .before
                .as_ref()
                .map(|v| v.value.as_str())
                .unwrap_or("");
            let untouched_since = mutation
                .after
                .as_ref()
                .is_some_and(|a| a.value == current_val);
            // Still exactly what Whichcraft wrote: put the old value back verbatim (empty
            // segments and spelling included). Otherwise PATH is a list: undo entry by entry,
            // so entries added by others survive.
            let restored = if untouched_since && mutation.before.is_some() {
                before_val.to_string()
            } else {
                restore_path_value(
                    current_val,
                    &mutation.path_added,
                    &mutation.path_removed,
                    before_val,
                )
            };
            if restored == current_val {
                continue;
            }
            let kind = current
                .and_then(|v| v.kind)
                .or_else(|| mutation.before.as_ref().and_then(|v| v.kind))
                .unwrap_or(EnvValueKind::ExpandString);
            planned.push((
                EnvChange::Set {
                    name: name.clone(),
                    value: restored,
                    value_kind: kind,
                    scope: mutation.scope.clone(),
                },
                current_value,
            ));
            continue;
        }

        if current == mutation.before.as_ref() {
            continue; // never written, or already back to its old value
        }
        if let Some(after) = &mutation.after {
            if current != Some(after) {
                conflicts.push(UndoConflict {
                    name: mutation.name.clone(),
                    scope: mutation.scope.clone(),
                    message: "value differs from what Whichcraft wrote".into(),
                });
                continue;
            }
        }

        let change = match &mutation.before {
            Some(before) => EnvChange::Set {
                name: name.clone(),
                value: before.value.clone(),
                value_kind: before.kind.unwrap_or(EnvValueKind::String),
                scope: mutation.scope.clone(),
            },
            None => EnvChange::Delete {
                name,
                scope: mutation.scope.clone(),
            },
        };
        planned.push((change, current_value));
    }

    let restored = planned.len();
    write_changes(backend, elevator, planned)?;

    // Mark it undone so the next Undo does not pick the same apply again.
    journal.status = JournalStatus::Undone;
    store.save_journal(&journal)?;

    Ok(UndoResult {
        conflicts,
        restored,
    })
}

/// Writes `(change, value it expects to replace)` pairs: System ones through the elevated helper
/// unless this process can write HKLM, the rest in process. System goes first so a declined UAC
/// leaves everything untouched.
pub(crate) fn write_changes<B: EnvBackend>(
    backend: &B,
    elevator: Option<&dyn Elevator>,
    planned: Vec<(EnvChange, Option<String>)>,
) -> Result<(), EnvarlyError> {
    let (system, in_process): (Vec<_>, Vec<_>) = planned
        .into_iter()
        .partition(|(c, _)| scope_of(c) == &VarScope::System && !backend.is_elevated());

    if !system.is_empty() {
        let Some(elevator) = elevator else {
            return Err(EnvarlyError::InvalidInput(
                "changing System variables needs elevation".into(),
            ));
        };
        let request = ElevatedRequest {
            changes: system
                .into_iter()
                .map(|(change, current)| ExpectedChange {
                    expected_before: current,
                    change,
                })
                .collect(),
        };
        match elevator.apply_system(&request)? {
            ElevatedOutcome::Applied => {}
            ElevatedOutcome::Cancelled => {
                return Err(EnvarlyError::InvalidInput(
                    "UAC was cancelled; nothing was written".into(),
                ))
            }
            ElevatedOutcome::Stale => {
                return Err(EnvarlyError::InvalidInput(
                    "System environment changed meanwhile; try again".into(),
                ))
            }
            ElevatedOutcome::Failed(msg) => {
                return Err(EnvarlyError::InvalidInput(format!(
                    "System write failed: {msg}"
                )))
            }
        }
    }

    let changes: Vec<EnvChange> = in_process.into_iter().map(|(c, _)| c).collect();
    if !changes.is_empty() {
        env_store::apply_changes_with(backend, &changes, |_, _, _, _| {})?;
    }
    Ok(())
}

fn scope_of(change: &EnvChange) -> &VarScope {
    match change {
        EnvChange::Set { scope, .. } | EnvChange::Delete { scope, .. } => scope,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    use crate::model::EnvValue;
    use crate::whichcraft::application::tool_apply::test_support::FakeElevator;
    use crate::whichcraft::domain::journal::{MutationRecord, WhichcraftJournal};
    use crate::whichcraft::domain::path::{compute_prepend, path_entry_diff};
    use crate::whichcraft::persistence::save_journal;
    use crate::whichcraft::persistence::use_test_data_dir;
    use crate::whichcraft::persistence::FileStore;

    fn leak(s: String) -> &'static str {
        Box::leak(s.into_boxed_str())
    }

    fn save_completed(mutations: Vec<MutationRecord>, backend: &MemBackend) {
        save_journal(&WhichcraftJournal {
            id: "test-undo".into(),
            status: JournalStatus::Completed,
            kind: "java_apply".into(),
            created_at: "now".into(),
            baseline: crate::env_store::read_snapshot_with(backend).unwrap(),
            mutations,
            selections: vec![],
        })
        .unwrap();
    }

    fn path_mutation(scope: VarScope, before: &str, after: &str) -> MutationRecord {
        let (added, removed) = path_entry_diff(before, after);
        MutationRecord {
            name: "Path".into(),
            scope,
            before: Some(EnvValue::typed(before.into(), EnvValueKind::ExpandString)),
            after: Some(EnvValue::typed(after.into(), EnvValueKind::ExpandString)),
            path_added: added,
            path_removed: removed,
        }
    }

    #[test]
    fn undo_restores_path_entries_added_by_app() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let after = compute_prepend("C:\\old", "C:\\jdk\\bin").unwrap();
        let backend = MemBackend::new().with_user([("Path", leak(after.clone()))]);
        save_completed(
            vec![path_mutation(VarScope::User, "C:\\old", &after)],
            &backend,
        );

        let result = undo_last_apply(&backend, &FileStore, None).expect("undo");
        assert!(result.conflicts.is_empty());
        assert_eq!(backend.read_user().unwrap()["Path"].value, "C:\\old");
    }

    #[test]
    fn undo_puts_an_untouched_path_back_exactly_including_empty_segments() {
        // U-1: found on a real machine whose User Path held ";;" — Undo dropped the empty entry.
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let before = "C:\\old;;C:\\other;";
        let after = compute_prepend(before, "C:\\jdk\\bin").unwrap();
        let backend = MemBackend::new().with_user([("Path", leak(after.clone()))]);
        save_completed(
            vec![path_mutation(VarScope::User, before, &after)],
            &backend,
        );

        let result = undo_last_apply(&backend, &FileStore, None).expect("undo");
        assert!(result.conflicts.is_empty());
        assert_eq!(backend.read_user().unwrap()["Path"].value, before);
    }

    #[test]
    fn undo_keeps_path_entries_other_programs_added_after_apply() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let after = "C:\\jdk\\bin;C:\\old";
        // An installer appended its own entry after Whichcraft applied.
        let backend = MemBackend::new().with_user([("Path", "C:\\jdk\\bin;C:\\old;C:\\installer")]);
        save_completed(
            vec![path_mutation(VarScope::User, "C:\\old", after)],
            &backend,
        );

        let result = undo_last_apply(&backend, &FileStore, None).expect("undo");
        assert!(result.conflicts.is_empty());
        assert_eq!(
            backend.read_user().unwrap()["Path"].value,
            "C:\\old;C:\\installer"
        );
    }

    #[test]
    fn undo_preserves_raw_path_segments_when_an_installer_appended_an_entry() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let before = r"C:\old;; C:\other";
        let after = compute_prepend(before, r"C:\jdk\bin").unwrap();
        let current = format!(r"{after};C:\installer;");
        let backend = MemBackend::new().with_user([("Path", leak(current))]);
        save_completed(
            vec![path_mutation(VarScope::User, before, &after)],
            &backend,
        );

        let result = undo_last_apply(&backend, &FileStore, None).unwrap();
        assert!(result.conflicts.is_empty());
        assert_eq!(
            backend.read_user().unwrap()["Path"].value,
            format!(r"{before};C:\installer;")
        );
    }

    #[test]
    fn undo_reports_a_conflict_for_a_single_value_changed_since() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let backend = MemBackend::new().with_user([("JAVA_HOME", "C:\\jdk21-by-installer")]);
        save_completed(
            vec![MutationRecord {
                name: "JAVA_HOME".into(),
                scope: VarScope::User,
                before: Some(EnvValue::typed("C:\\jdk11".into(), EnvValueKind::String)),
                after: Some(EnvValue::typed("C:\\jdk17".into(), EnvValueKind::String)),
                path_added: vec![],
                path_removed: vec![],
            }],
            &backend,
        );

        let result = undo_last_apply(&backend, &FileStore, None).expect("undo");
        assert_eq!(result.conflicts.len(), 1);
        assert_eq!(
            backend.read_user().unwrap()["JAVA_HOME"].value,
            "C:\\jdk21-by-installer"
        );
    }

    #[test]
    fn a_second_undo_does_not_replay_the_same_apply() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let backend = MemBackend::new().with_user([("Path", "C:\\jdk\\bin;C:\\old")]);
        save_completed(
            vec![path_mutation(
                VarScope::User,
                "C:\\old",
                "C:\\jdk\\bin;C:\\old",
            )],
            &backend,
        );

        assert_eq!(
            undo_last_apply(&backend, &FileStore, None)
                .unwrap()
                .restored,
            1
        );
        // The user re-adds the JDK by hand; a second Undo must not remove it again.
        backend
            .write_user(
                "Path",
                &EnvValue::typed("C:\\jdk\\bin;C:\\old".into(), EnvValueKind::ExpandString),
            )
            .unwrap();
        assert_eq!(
            undo_last_apply(&backend, &FileStore, None)
                .unwrap()
                .restored,
            0
        );
        assert_eq!(
            backend.read_user().unwrap()["Path"].value,
            "C:\\jdk\\bin;C:\\old"
        );
    }

    #[test]
    fn undo_puts_back_a_system_entry_through_the_helper() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let backend = MemBackend::new()
            .with_system([("Path", "C:\\Windows")])
            .with_elevated(false);
        save_completed(
            vec![path_mutation(
                VarScope::System,
                "C:\\Windows;C:\\Program Files\\nodejs\\",
                "C:\\Windows",
            )],
            &backend,
        );
        let elevator = FakeElevator::new(&backend, vec![]);

        undo_last_apply(&backend, &FileStore, Some(&elevator)).expect("undo");
        assert_eq!(
            backend.read_system().unwrap()["Path"].value,
            "C:\\Windows;C:\\Program Files\\nodejs\\"
        );
        assert_eq!(elevator.requests.lock().unwrap().len(), 1);
    }

    #[test]
    fn undo_finds_variables_whatever_their_case_in_the_registry() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let backend = MemBackend::new().with_user([("PATH", "C:\\jdk\\bin;C:\\old")]);
        save_completed(
            vec![path_mutation(
                VarScope::User,
                "C:\\old",
                "C:\\jdk\\bin;C:\\old",
            )],
            &backend,
        );

        undo_last_apply(&backend, &FileStore, None).expect("undo");
        let user = backend.read_user().unwrap();
        assert_eq!(get_var(&user, "Path").unwrap().value, "C:\\old");
    }
}
