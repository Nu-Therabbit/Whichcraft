//! Opt-in real Registry checks with deterministic failure injection at the backend boundary.
//! These do not simulate UAC or claim installed-GUI failure presentation.
use super::*;
use crate::error::EnvarlyError;
use crate::model::EnvChange;
use crate::whichcraft::domain::journal::JournalStatus;
use std::sync::{mpsc, Mutex};
use std::time::Duration;

const FIRST: &str = "WHICHCRAFT_TEST_FAILURE_FIRST";
const SECOND: &str = "WHICHCRAFT_TEST_FAILURE_SECOND";
const SYSTEM: &str = "WHICHCRAFT_TEST_FAILURE_SYSTEM";

fn owned(name: &str) {
    assert!(
        [FIRST, SECOND, SYSTEM].contains(&name),
        "refusing non-fixture write: {name}"
    );
}

/// Deletes only fixtures whose absence was verified before creating this guard.
struct Fixtures;
impl Fixtures {
    fn new() -> Self {
        for map in [
            WinregBackend.read_user().unwrap(),
            WinregBackend.read_system().unwrap(),
        ] {
            assert!(
                [FIRST, SECOND, SYSTEM]
                    .iter()
                    .all(|n| !map.contains_key(*n)),
                "fixture already exists"
            );
        }
        Self
    }
}
impl Drop for Fixtures {
    fn drop(&mut self) {
        for name in [FIRST, SECOND] {
            let _ = WinregBackend.delete_user(name);
        }
        let _ = WinregBackend.delete_system(SYSTEM);
        WinregBackend.broadcast_changes();
    }
}

fn typed(value: &str, kind: EnvValueKind) -> EnvValue {
    EnvValue::typed(value.into(), kind)
}

/// A real writable Registry backend that refuses exactly one owned mutation.
/// Optional channels synchronize an independent writer before rollback starts.
struct FailWrite {
    name: &'static str,
    value: &'static str,
    writer: Option<(mpsc::Sender<()>, Mutex<mpsc::Receiver<()>>)>,
}
impl FailWrite {
    fn check(&self, name: &str, value: &EnvValue) -> Result<(), EnvarlyError> {
        owned(name);
        if name == self.name && value.value == self.value {
            if let Some((start, done)) = &self.writer {
                start.send(()).unwrap();
                done.lock()
                    .unwrap()
                    .recv_timeout(Duration::from_secs(10))
                    .unwrap();
            }
            return Err(EnvarlyError::Registry(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "owned-fixture injected write failure",
            )));
        }
        Ok(())
    }
}
impl EnvBackend for FailWrite {
    fn read_user(&self) -> Result<HashMap<String, EnvValue>, EnvarlyError> {
        WinregBackend.read_user()
    }
    fn read_system(&self) -> Result<HashMap<String, EnvValue>, EnvarlyError> {
        WinregBackend.read_system()
    }
    fn write_user(&self, name: &str, value: &EnvValue) -> Result<(), EnvarlyError> {
        self.check(name, value)?;
        WinregBackend.write_user(name, value)
    }
    fn write_system(&self, name: &str, value: &EnvValue) -> Result<(), EnvarlyError> {
        self.check(name, value)?;
        Err(EnvarlyError::InvalidInput(
            "System writes are forbidden by this fixture backend".into(),
        ))
    }
    fn delete_user(&self, name: &str) -> Result<(), EnvarlyError> {
        owned(name);
        WinregBackend.delete_user(name)
    }
    fn delete_system(&self, name: &str) -> Result<(), EnvarlyError> {
        owned(name);
        WinregBackend.delete_system(name)
    }
    // Exercise the in-process failure path without requesting UAC. write_system never writes.
    fn is_elevated(&self) -> bool {
        true
    }
    fn broadcast_changes(&self) {
        WinregBackend.broadcast_changes();
    }
}

fn assert_snapshot_restored(before: &crate::model::EnvSnapshot) {
    assert!(same_values(
        &WinregBackend.read_user().unwrap(),
        &before.user
    ));
    assert!(same_values(
        &WinregBackend.read_system().unwrap(),
        &before.system
    ));
}

#[test]
#[ignore = "contract: writes an owned User fixture and injects a refused System write without touching HKLM"]
fn contract_system_failure_rolls_back_real_user_writes_and_preserves_kinds() {
    let original = read_snapshot_with(&WinregBackend).unwrap();
    let cleanup = Fixtures::new();
    WinregBackend
        .write_user(
            FIRST,
            &typed("%USERPROFILE%\\before", EnvValueKind::ExpandString),
        )
        .unwrap();
    let before = read_snapshot_with(&WinregBackend).unwrap();
    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let mut plan = set_variable_plan(VarScope::User, FIRST, "changed");
    plan.system_diffs = set_variable_plan(VarScope::System, SYSTEM, "denied").system_diffs;
    plan.requires_uac = true;
    let backend = FailWrite {
        name: SYSTEM,
        value: "denied",
        writer: None,
    };
    let error = apply_tool_plan(&backend, &FileStore, &SystemOperationIds, &plan).unwrap_err();
    assert!(error.to_string().contains("injected write failure"));
    assert_snapshot_restored(&before);
    assert_eq!(
        crate::whichcraft::persistence::load_journal(&plan.plan_id)
            .unwrap()
            .status,
        JournalStatus::Failed
    );
    drop(cleanup);
    assert_snapshot_restored(&original);
}

#[test]
#[ignore = "contract: writes two owned User variables and fails Undo after one real restore"]
fn contract_partial_undo_failure_rolls_back_and_can_be_retried() {
    let original = read_snapshot_with(&WinregBackend).unwrap();
    let cleanup = Fixtures::new();
    WinregBackend
        .write_user(FIRST, &typed("before-first", EnvValueKind::ExpandString))
        .unwrap();
    WinregBackend
        .write_user(SECOND, &typed("before-second", EnvValueKind::String))
        .unwrap();
    let before = read_snapshot_with(&WinregBackend).unwrap();
    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let mut plan = set_variable_plan(VarScope::User, FIRST, "after-first");
    plan.user_diffs
        .extend(set_variable_plan(VarScope::User, SECOND, "after-second").user_diffs);
    apply_tool_plan(&WinregBackend, &FileStore, &SystemOperationIds, &plan).unwrap();
    let applied = read_snapshot_with(&WinregBackend).unwrap();
    // Undo restores newest-first, so SECOND is really restored before FIRST is refused.
    let backend = FailWrite {
        name: FIRST,
        value: "before-first",
        writer: None,
    };
    let error = undo_last_apply(&backend, &FileStore, None).unwrap_err();
    assert!(error.to_string().contains("injected write failure"));
    assert_snapshot_restored(&applied);
    assert_eq!(
        crate::whichcraft::persistence::load_journal(&plan.plan_id)
            .unwrap()
            .status,
        JournalStatus::Completed
    );
    let result = undo_last_apply(&WinregBackend, &FileStore, None).unwrap();
    assert_eq!(result.restored, 2);
    assert!(result.conflicts.is_empty());
    assert_snapshot_restored(&before);
    assert_eq!(
        crate::whichcraft::persistence::load_journal(&plan.plan_id)
            .unwrap()
            .status,
        JournalStatus::Undone
    );
    drop(cleanup);
    assert_snapshot_restored(&original);
}

#[test]
#[ignore = "contract: synchronizes a real concurrent Registry writer before an owned failure and rollback"]
fn contract_rollback_preserves_a_real_concurrent_writer() {
    let original = read_snapshot_with(&WinregBackend).unwrap();
    let cleanup = Fixtures::new();
    WinregBackend
        .write_user(FIRST, &typed("before-first", EnvValueKind::ExpandString))
        .unwrap();
    WinregBackend
        .write_user(SECOND, &typed("before-second", EnvValueKind::String))
        .unwrap();
    let (start, wait_start) = mpsc::channel();
    let (done, wait_done) = mpsc::channel();
    let writer = std::thread::spawn(move || {
        wait_start.recv_timeout(Duration::from_secs(10)).unwrap();
        WinregBackend
            .write_user(FIRST, &typed("external-writer", EnvValueKind::String))
            .unwrap();
        done.send(()).unwrap();
    });
    let backend = FailWrite {
        name: SECOND,
        value: "denied",
        writer: Some((start, Mutex::new(wait_done))),
    };
    let changes = [
        EnvChange::Set {
            name: FIRST.into(),
            value: "app-write".into(),
            value_kind: EnvValueKind::String,
            scope: VarScope::User,
        },
        EnvChange::Set {
            name: SECOND.into(),
            value: "denied".into(),
            value_kind: EnvValueKind::String,
            scope: VarScope::User,
        },
    ];
    let error =
        crate::env_store::apply_changes_with(&backend, &changes, |_, _, _, _| {}).unwrap_err();
    writer.join().unwrap();
    assert!(error.to_string().contains("rollback conflict"));
    let user = WinregBackend.read_user().unwrap();
    assert_eq!(user[FIRST], typed("external-writer", EnvValueKind::String));
    assert_eq!(user[SECOND], typed("before-second", EnvValueKind::String));
    drop(cleanup);
    assert_snapshot_restored(&original);
}
