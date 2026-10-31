//! System-scope writes through a UAC-elevated copy of the app.
//!
//! The request travels through a file in the user's (writable) data dir, so the elevated side
//! only trusts it after matching its SHA-256 against the hash passed on the command line, which
//! the non-elevated app chose. It also refuses anything but System scope (HKCU of an elevated
//! process can belong to a different account) and any change whose current value no longer
//! matches what the plan saw.

use sha2::{Digest, Sha256};

use crate::env_store::{self, EnvBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvChange, VarScope};
use crate::whichcraft::domain::env::get_var;
use crate::whichcraft::ports::elevator::{ElevatedOutcome, ElevatedRequest};

pub const EXIT_APPLIED: i32 = 0;
pub const EXIT_FAILED: i32 = 1;
pub const EXIT_STALE: i32 = 3;

pub fn encode_request(request: &ElevatedRequest) -> Result<(Vec<u8>, String), EnvarlyError> {
    let bytes = serde_json::to_vec(request)
        .map_err(|e| EnvarlyError::Snapshot(format!("serialize elevation request: {e}")))?;
    let hash = sha256_hex(&bytes);
    Ok((bytes, hash))
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// What the elevated process does with a request it has read.
pub fn run_elevated_request<B: EnvBackend>(
    backend: &B,
    bytes: &[u8],
    expected_hash: &str,
) -> ElevatedOutcome {
    if !sha256_hex(bytes).eq_ignore_ascii_case(expected_hash) {
        return ElevatedOutcome::Failed("elevation request does not match its hash".into());
    }
    let request: ElevatedRequest = match serde_json::from_slice(bytes) {
        Ok(r) => r,
        Err(e) => return ElevatedOutcome::Failed(format!("parse elevation request: {e}")),
    };
    if let Some(bad) = request
        .changes
        .iter()
        .find(|c| change_scope(&c.change) != &VarScope::System)
    {
        return ElevatedOutcome::Failed(format!(
            "elevated helper only writes System scope, got {:?}",
            change_scope(&bad.change)
        ));
    }
    let system = match backend.read_system() {
        Ok(s) => s,
        Err(e) => return ElevatedOutcome::Failed(e.to_string()),
    };
    let stale = request.changes.iter().any(|c| {
        get_var(&system, change_name(&c.change)).map(|v| v.value.as_str())
            != c.expected_before.as_deref()
    });
    if stale {
        return ElevatedOutcome::Stale;
    }
    let changes: Vec<EnvChange> = request.changes.into_iter().map(|c| c.change).collect();
    match env_store::apply_changes_with(backend, &changes, |_, _, _, _| {}) {
        Ok(()) => ElevatedOutcome::Applied,
        Err(e) => ElevatedOutcome::Failed(e.to_string()),
    }
}

fn change_scope(change: &EnvChange) -> &VarScope {
    match change {
        EnvChange::Set { scope, .. } | EnvChange::Delete { scope, .. } => scope,
    }
}

fn change_name(change: &EnvChange) -> &str {
    match change {
        EnvChange::Set { name, .. } | EnvChange::Delete { name, .. } => name,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    use crate::model::EnvValueKind;
    use crate::whichcraft::ports::elevator::ExpectedChange;

    fn set_system_path(expected_before: &str, value: &str) -> ElevatedRequest {
        ElevatedRequest {
            changes: vec![ExpectedChange {
                expected_before: Some(expected_before.into()),
                change: EnvChange::Set {
                    name: "Path".into(),
                    value: value.into(),
                    value_kind: EnvValueKind::ExpandString,
                    scope: VarScope::System,
                },
            }],
        }
    }

    fn system_path(b: &MemBackend) -> String {
        b.read_system().unwrap()["Path"].value.clone()
    }

    #[test]
    fn applies_a_request_that_matches_its_hash() {
        let b = MemBackend::new().with_system([("Path", "C:\\a;C:\\node")]);
        let (bytes, hash) = encode_request(&set_system_path("C:\\a;C:\\node", "C:\\a")).unwrap();
        assert_eq!(
            run_elevated_request(&b, &bytes, &hash),
            ElevatedOutcome::Applied
        );
        assert_eq!(system_path(&b), "C:\\a");
    }

    #[test]
    fn rejects_a_request_tampered_after_hashing() {
        let b = MemBackend::new().with_system([("Path", "C:\\a;C:\\node")]);
        let (_, hash) = encode_request(&set_system_path("C:\\a;C:\\node", "C:\\a")).unwrap();
        let (tampered, _) = encode_request(&set_system_path("C:\\a;C:\\node", "C:\\evil")).unwrap();
        assert!(matches!(
            run_elevated_request(&b, &tampered, &hash),
            ElevatedOutcome::Failed(_)
        ));
        assert_eq!(system_path(&b), "C:\\a;C:\\node");
    }

    #[test]
    fn refuses_user_scope_changes() {
        let b = MemBackend::new().with_user([("JAVA_HOME", "C:\\old")]);
        let request = ElevatedRequest {
            changes: vec![ExpectedChange {
                expected_before: Some("C:\\old".into()),
                change: EnvChange::Set {
                    name: "JAVA_HOME".into(),
                    value: "C:\\new".into(),
                    value_kind: EnvValueKind::String,
                    scope: VarScope::User,
                },
            }],
        };
        let (bytes, hash) = encode_request(&request).unwrap();
        assert!(matches!(
            run_elevated_request(&b, &bytes, &hash),
            ElevatedOutcome::Failed(_)
        ));
        assert_eq!(b.read_user().unwrap()["JAVA_HOME"].value, "C:\\old");
    }

    #[test]
    fn reports_stale_when_system_changed_after_planning() {
        let b = MemBackend::new().with_system([("Path", "C:\\a;C:\\node;C:\\added-meanwhile")]);
        let (bytes, hash) = encode_request(&set_system_path("C:\\a;C:\\node", "C:\\a")).unwrap();
        assert_eq!(
            run_elevated_request(&b, &bytes, &hash),
            ElevatedOutcome::Stale
        );
        assert_eq!(system_path(&b), "C:\\a;C:\\node;C:\\added-meanwhile");
    }
}
