use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::crypto;
use crate::error::WhichcraftError;
use crate::model::EnvSnapshot;

/// Snapshot file format version. Increment when the serialized shape changes.
/// Version history:
///   0 – legacy plaintext JSON (.json), no version field (pre-encryption era)
///   1 – DPAPI-encrypted JSON blob (.snap), version field present
///   2 – environment values include their registry type
pub const SNAPSHOT_FORMAT_VERSION: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotMeta {
    /// Format version; absent in v0 files (defaults to 0 via serde default).
    /// When adding a migration, match on this field in `read_snap`.
    #[serde(default)]
    pub version: u32,
    pub id: String,
    pub created_at: String,
    pub label: String,
    pub snapshot: EnvSnapshot,
}

fn snapshots_dir() -> Result<PathBuf, WhichcraftError> {
    let base = dirs_next::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("Whichcraft").join("snapshots");
    adopt_legacy_snapshots(&base.join("Envarly").join("snapshots"), &dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot copy earlier snapshots: {e}")))?;
    fs::create_dir_all(&dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot create snapshots dir: {e}")))?;
    Ok(dir)
}

/// Earlier builds kept snapshots in the folder Envarly itself uses, so they are
/// copied rather than moved. Only runs while `dir` does not exist, so a snapshot
/// deleted later stays deleted; the staging folder lets an interrupted copy retry.
fn adopt_legacy_snapshots(legacy: &Path, dir: &Path) -> std::io::Result<()> {
    if dir.exists() || !legacy.is_dir() {
        return Ok(());
    }
    let staging = dir.with_extension("adopting");
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    fs::create_dir_all(&staging)?;
    for entry in fs::read_dir(legacy)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("snap") {
            fs::copy(&path, staging.join(entry.file_name()))?;
        }
    }
    fs::rename(&staging, dir)
}

fn write_snap(path: &Path, meta: &SnapshotMeta) -> Result<(), WhichcraftError> {
    let json = serde_json::to_vec(meta)?;
    let encrypted = crypto::protect(&json)?;
    fs::write(path, encrypted)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot write snapshot: {e}")))?;
    Ok(())
}

fn read_snap(path: &Path) -> Result<SnapshotMeta, WhichcraftError> {
    let encrypted = fs::read(path)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot read snapshot file: {e}")))?;
    let json = crypto::unprotect(&encrypted)?;
    match serde_json::from_slice(&json) {
        Ok(meta) => Ok(meta),
        Err(typed_error) => {
            let legacy: LegacySnapshotMeta = serde_json::from_slice(&json).map_err(|_| {
                WhichcraftError::Snapshot(format!("Cannot parse snapshot: {typed_error}"))
            })?;
            Ok(legacy.into())
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySnapshotMeta {
    #[serde(default)]
    version: u32,
    id: String,
    created_at: String,
    label: String,
    snapshot: LegacyEnvSnapshot,
}

#[derive(Deserialize)]
struct LegacyEnvSnapshot {
    user: std::collections::HashMap<String, String>,
    system: std::collections::HashMap<String, String>,
}

impl From<LegacySnapshotMeta> for SnapshotMeta {
    fn from(legacy: LegacySnapshotMeta) -> Self {
        let unresolved = |values: std::collections::HashMap<String, String>| {
            values
                .into_iter()
                .map(|(name, value)| (name, crate::model::EnvValue { value, kind: None }))
                .collect()
        };
        Self {
            version: legacy.version,
            id: legacy.id,
            created_at: legacy.created_at,
            label: legacy.label,
            snapshot: EnvSnapshot {
                user: unresolved(legacy.snapshot.user),
                system: unresolved(legacy.snapshot.system),
                other_user: None,
            },
        }
    }
}

pub fn save_snapshot(snapshot: EnvSnapshot, label: &str) -> Result<SnapshotMeta, WhichcraftError> {
    let now = Utc::now();
    let id = now.format("%Y%m%dT%H%M%SZ").to_string();
    let meta = SnapshotMeta {
        version: SNAPSHOT_FORMAT_VERSION,
        id: id.clone(),
        created_at: now.to_rfc3339(),
        label: label.to_string(),
        snapshot,
    };
    let path = snapshots_dir()?.join(format!("{id}.snap"));
    write_snap(&path, &meta)?;
    Ok(meta)
}

#[cfg(test)]
pub fn save_snapshot_to(
    snapshot: EnvSnapshot,
    label: &str,
    dir: &Path,
) -> Result<SnapshotMeta, WhichcraftError> {
    let now = Utc::now();
    let id = now.format("%Y%m%dT%H%M%SZ").to_string();
    let meta = SnapshotMeta {
        version: SNAPSHOT_FORMAT_VERSION,
        id: id.clone(),
        created_at: now.to_rfc3339(),
        label: label.to_string(),
        snapshot,
    };
    fs::create_dir_all(dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot create dir: {e}")))?;
    let path = dir.join(format!("{id}.snap"));
    write_snap(&path, &meta)?;
    Ok(meta)
}

pub fn list_snapshots() -> Result<Vec<SnapshotMeta>, WhichcraftError> {
    list_snapshots_from(&snapshots_dir()?)
}

pub fn list_snapshots_from(dir: &Path) -> Result<Vec<SnapshotMeta>, WhichcraftError> {
    let mut metas: Vec<SnapshotMeta> = Vec::new();
    for entry in fs::read_dir(dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot read snapshots dir: {e}")))?
    {
        let entry =
            entry.map_err(|e| WhichcraftError::Snapshot(format!("Read entry error: {e}")))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("snap") {
            continue;
        }
        if let Ok(meta) = read_snap(&path) {
            metas.push(meta);
        }
    }
    metas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(metas)
}

pub fn rename_snapshot(id: &str, label: &str) -> Result<SnapshotMeta, WhichcraftError> {
    rename_snapshot_in(id, label, &snapshots_dir()?)
}

fn rename_snapshot_in(id: &str, label: &str, dir: &Path) -> Result<SnapshotMeta, WhichcraftError> {
    let label = label.trim();
    if label.is_empty() {
        return Err(WhichcraftError::Snapshot(
            "Snapshot name cannot be empty".to_string(),
        ));
    }

    let path = dir.join(format!("{id}.snap"));
    let mut meta = read_snap(&path)?;
    meta.label = label.to_string();
    write_snap(&path, &meta)?;
    Ok(meta)
}

pub fn delete_snapshot(id: &str) -> Result<(), WhichcraftError> {
    let path = snapshots_dir()?.join(format!("{id}.snap"));
    fs::remove_file(&path)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot delete snapshot: {e}")))?;
    Ok(())
}

#[cfg(test)]
pub fn delete_snapshot_from(id: &str, dir: &Path) -> Result<(), WhichcraftError> {
    let path = dir.join(format!("{id}.snap"));
    fs::remove_file(&path)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot delete snapshot: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_snapshot() -> EnvSnapshot {
        EnvSnapshot {
            user: HashMap::from([(
                "MY_VAR".to_string(),
                crate::model::EnvValue::typed(
                    "hello".to_string(),
                    crate::model::EnvValueKind::String,
                ),
            )]),
            system: HashMap::new(),
            other_user: None,
        }
    }

    #[test]
    fn save_and_list_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_path_buf();

        let saved = save_snapshot_to(make_snapshot(), "test label", &path).unwrap();
        assert_eq!(saved.label, "test label");
        assert!(!saved.id.is_empty());

        let list = list_snapshots_from(&path).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, saved.id);
        assert_eq!(list[0].label, "test label");
        assert_eq!(
            list[0]
                .snapshot
                .user
                .get("MY_VAR")
                .map(|value| value.value.as_str()),
            Some("hello")
        );
    }

    #[test]
    fn list_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let list = list_snapshots_from(dir.path()).unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn delete_snapshot_removes_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_path_buf();

        let saved = save_snapshot_to(make_snapshot(), "to delete", &path).unwrap();
        let before = list_snapshots_from(&path).unwrap();
        assert_eq!(before.len(), 1);

        delete_snapshot_from(&saved.id, &path).unwrap();
        let after = list_snapshots_from(&path).unwrap();
        assert!(after.is_empty());
    }

    #[test]
    fn rename_snapshot_updates_only_the_label() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_path_buf();

        let saved = save_snapshot_to(make_snapshot(), "before", &path).unwrap();
        let renamed = rename_snapshot_in(&saved.id, "  after  ", &path).unwrap();

        assert_eq!(renamed.id, saved.id);
        assert_eq!(renamed.created_at, saved.created_at);
        assert_eq!(renamed.label, "after");
        assert_eq!(renamed.snapshot.user, saved.snapshot.user);

        let listed = list_snapshots_from(&path).unwrap();
        assert_eq!(listed[0].label, "after");
    }

    #[test]
    fn rename_snapshot_rejects_an_empty_label() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_path_buf();
        let saved = save_snapshot_to(make_snapshot(), "before", &path).unwrap();

        let result = rename_snapshot_in(&saved.id, "   ", &path);

        assert!(result.is_err());
        assert_eq!(list_snapshots_from(&path).unwrap()[0].label, "before");
    }

    #[test]
    fn list_sorted_newest_first() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_path_buf();

        save_snapshot_to(make_snapshot(), "first", &path).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));
        save_snapshot_to(make_snapshot(), "second", &path).unwrap();

        let list = list_snapshots_from(&path).unwrap();
        assert_eq!(list[0].label, "second");
        assert_eq!(list[1].label, "first");
    }

    #[test]
    fn adopting_copies_legacy_snapshots_and_keeps_the_originals() {
        let root = tempfile::tempdir().unwrap();
        let legacy = root.path().join("Envarly").join("snapshots");
        let dir = root.path().join("Whichcraft").join("snapshots");
        let saved = save_snapshot_to(make_snapshot(), "from envarly", &legacy).unwrap();
        fs::write(legacy.join("notes.txt"), "not a snapshot").unwrap();

        adopt_legacy_snapshots(&legacy, &dir).unwrap();

        let adopted = list_snapshots_from(&dir).unwrap();
        assert_eq!(adopted.len(), 1);
        assert_eq!(adopted[0].id, saved.id);
        assert!(!dir.join("notes.txt").exists());
        assert_eq!(list_snapshots_from(&legacy).unwrap().len(), 1);
    }

    #[test]
    fn adopting_does_not_restore_a_snapshot_deleted_later() {
        let root = tempfile::tempdir().unwrap();
        let legacy = root.path().join("legacy");
        let dir = root.path().join("snapshots");
        let saved = save_snapshot_to(make_snapshot(), "old", &legacy).unwrap();

        adopt_legacy_snapshots(&legacy, &dir).unwrap();
        delete_snapshot_from(&saved.id, &dir).unwrap();
        adopt_legacy_snapshots(&legacy, &dir).unwrap();

        assert!(list_snapshots_from(&dir).unwrap().is_empty());
    }

    #[test]
    fn adopting_retries_after_an_interrupted_copy() {
        let root = tempfile::tempdir().unwrap();
        let legacy = root.path().join("legacy");
        let dir = root.path().join("snapshots");
        save_snapshot_to(make_snapshot(), "old", &legacy).unwrap();
        fs::create_dir_all(dir.with_extension("adopting")).unwrap();
        fs::write(dir.with_extension("adopting").join("partial.snap"), "x").unwrap();

        adopt_legacy_snapshots(&legacy, &dir).unwrap();

        assert!(!dir.join("partial.snap").exists());
        assert_eq!(list_snapshots_from(&dir).unwrap().len(), 1);
    }

    #[test]
    fn adopting_without_a_legacy_folder_creates_nothing() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("snapshots");

        adopt_legacy_snapshots(&root.path().join("missing"), &dir).unwrap();

        assert!(!dir.exists());
    }

    #[test]
    fn delete_nonexistent_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let result = delete_snapshot_from("no-such-id", dir.path());
        assert!(result.is_err());
    }
}
