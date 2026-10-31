use crate::env_store;
use crate::error::WhichcraftError;
use crate::snapshot::{self, SnapshotMeta};

#[tauri::command]
pub fn create_snapshot(label: String) -> Result<SnapshotMeta, WhichcraftError> {
    let snap = env_store::read_snapshot()?;
    snapshot::save_snapshot(snap, &label)
}

#[tauri::command]
pub fn list_snapshots() -> Result<Vec<SnapshotMeta>, WhichcraftError> {
    snapshot::list_snapshots()
}

#[tauri::command]
pub fn rename_snapshot(id: String, label: String) -> Result<SnapshotMeta, WhichcraftError> {
    snapshot::rename_snapshot(&id, &label)
}

#[tauri::command]
pub fn delete_snapshot(id: String) -> Result<(), WhichcraftError> {
    snapshot::delete_snapshot(&id)
}
