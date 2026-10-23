use crate::env_store::{self, EnvBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvChange, EnvValue, EnvValueKind, VarScope};
use crate::whichcraft::persistence::{load_last_completed_apply, save_journal, JournalStatus};
use crate::whichcraft::services::path_plan::path_entries;

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

fn restore_path_value(
    current: &str,
    added: &[String],
    removed: &[String],
    before: &str,
) -> String {
    let mut entries = path_entries(current);
    for a in added {
        entries.retain(|e| !e.eq_ignore_ascii_case(a));
    }
    let before_entries = path_entries(before);
    for r in removed {
        if entries.iter().any(|e| e.eq_ignore_ascii_case(r)) {
            continue;
        }
        if let Some(pos) = before_entries.iter().position(|e| e.eq_ignore_ascii_case(r)) {
            let insert_at = pos.min(entries.len());
            entries.insert(insert_at, r.clone());
        } else {
            entries.push(r.clone());
        }
    }
    entries.join(";")
}

pub fn undo_last_apply<B: EnvBackend>(backend: &B) -> Result<UndoResult, EnvarlyError> {
    let Some(journal) = load_last_completed_apply()? else {
        return Ok(UndoResult {
            conflicts: vec![],
            restored: 0,
        });
    };

    let mut conflicts = Vec::new();
    let mut changes = Vec::new();

    for mutation in journal.mutations.iter().rev() {
        let map = match mutation.scope {
            VarScope::User => backend.read_user()?,
            VarScope::System => backend.read_system()?,
            VarScope::OtherUser => backend
                .read_other_user()?
                .ok_or_else(|| EnvarlyError::InvalidInput("no other-user account selected".into()))?,
        };
        let current = map.get(&mutation.name);

        if mutation.name.eq_ignore_ascii_case("path") {
            let current_val = current.map(|v| v.value.as_str()).unwrap_or("");
            let expected_after = mutation.after.as_ref().map(|v| v.value.as_str()).unwrap_or("");
            if current_val != expected_after {
                conflicts.push(UndoConflict {
                    name: mutation.name.clone(),
                    scope: mutation.scope.clone(),
                    message: "PATH was modified outside Whichcraft since apply".into(),
                });
                continue;
            }
            let before_val = mutation.before.as_ref().map(|v| v.value.as_str()).unwrap_or("");
            let restored = restore_path_value(
                current_val,
                &mutation.path_added,
                &mutation.path_removed,
                before_val,
            );
            let kind = current
                .and_then(|v| v.kind)
                .or_else(|| mutation.before.as_ref().and_then(|v| v.kind))
                .unwrap_or(EnvValueKind::ExpandString);
            changes.push(EnvChange::Set {
                name: mutation.name.clone(),
                value: restored,
                value_kind: kind,
                scope: mutation.scope.clone(),
            });
            continue;
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

        match &mutation.before {
            Some(before) => changes.push(EnvChange::Set {
                name: mutation.name.clone(),
                value: before.value.clone(),
                value_kind: before.kind.unwrap_or(EnvValueKind::String),
                scope: mutation.scope.clone(),
            }),
            None => changes.push(EnvChange::Delete {
                name: mutation.name.clone(),
                scope: mutation.scope.clone(),
            }),
        }
    }

    let restored = changes.len();
    if !changes.is_empty() {
        env_store::apply_changes_with(backend, &changes, |_, _, _, _| {})?;
    }

    let mut undone = journal;
    undone.status = JournalStatus::Completed;
    save_journal(&undone)?;

    Ok(UndoResult {
        conflicts,
        restored,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    use crate::whichcraft::persistence::{save_journal, MutationRecord, WhichcraftJournal};
    use crate::whichcraft::services::path_plan::compute_prepend;

    #[test]
    fn undo_restores_path_entries_added_by_app() {
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("LOCALAPPDATA", dir.path());

        let before = "C:\\old".to_string();
        let bin = "C:\\jdk\\bin";
        let after = compute_prepend(&before, bin).unwrap();
        let after_leak: &'static str = Box::leak(after.clone().into_boxed_str());
        let backend = MemBackend::new().with_user([
            ("Path", after_leak),
            ("JAVA_HOME", "C:\\jdk"),
        ]);

        let (added, removed) = crate::whichcraft::services::path_plan::path_entry_diff(&before, &after);
        let journal = WhichcraftJournal {
            id: "test-undo".into(),
            status: JournalStatus::Completed,
            kind: "java_apply".into(),
            created_at: "now".into(),
            baseline: crate::env_store::read_snapshot_with(&backend).unwrap(),
            mutations: vec![MutationRecord {
                name: "Path".into(),
                scope: VarScope::User,
                before: Some(EnvValue::typed(before.clone(), EnvValueKind::ExpandString)),
                after: Some(EnvValue::typed(after, EnvValueKind::ExpandString)),
                path_added: added,
                path_removed: removed,
            }],
        };
        save_journal(&journal).unwrap();

        let result = undo_last_apply(&backend).expect("undo");
        assert!(result.conflicts.is_empty());
        let user = backend.read_user().unwrap();
        assert_eq!(user.get("Path").map(|v| v.value.as_str()), Some(before.as_str()));
    }
}
