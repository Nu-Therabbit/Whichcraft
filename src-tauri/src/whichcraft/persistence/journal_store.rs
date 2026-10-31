use std::path::PathBuf;

use super::whichcraft_data_dir;
use crate::error::WhichcraftError;
use crate::whichcraft::domain::journal::{JournalStatus, WhichcraftJournal};

fn journal_path(id: &str) -> Result<PathBuf, WhichcraftError> {
    Ok(whichcraft_data_dir()?
        .join("journal")
        .join(format!("{id}.json")))
}

fn journal_dir() -> Result<PathBuf, WhichcraftError> {
    let dir = whichcraft_data_dir()?.join("journal");
    std::fs::create_dir_all(&dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot create journal dir: {e}")))?;
    Ok(dir)
}

pub fn save_journal(record: &WhichcraftJournal) -> Result<(), WhichcraftError> {
    let _ = journal_dir()?;
    let path = journal_path(&record.id)?;
    std::fs::write(
        &path,
        serde_json::to_string_pretty(record)
            .map_err(|e| WhichcraftError::Snapshot(format!("Cannot serialize journal: {e}")))?,
    )
    .map_err(|e| WhichcraftError::Snapshot(format!("Cannot write journal: {e}")))?;
    Ok(())
}

pub fn load_journal(id: &str) -> Result<WhichcraftJournal, WhichcraftError> {
    let path = journal_path(id)?;
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot read journal: {e}")))?;
    serde_json::from_str(&raw)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot parse journal: {e}")))
}

pub fn load_incomplete_journal() -> Result<Option<WhichcraftJournal>, WhichcraftError> {
    let dir = journal_dir()?;
    let mut pending = Vec::new();
    for entry in std::fs::read_dir(&dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot read journal dir: {e}")))?
    {
        let entry = entry.map_err(|e| WhichcraftError::Snapshot(format!("journal entry: {e}")))?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let path = entry.path();
        let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        let record: WhichcraftJournal = load_journal(id)?;
        if record.status == JournalStatus::Pending {
            pending.push(record);
        }
    }
    pending.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(pending.into_iter().next())
}

pub fn load_last_completed_apply() -> Result<Option<WhichcraftJournal>, WhichcraftError> {
    let dir = match journal_dir() {
        Ok(d) => d,
        Err(_) => return Ok(None),
    };
    let mut completed = Vec::new();
    for entry in std::fs::read_dir(&dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot read journal dir: {e}")))?
    {
        let entry = entry.map_err(|e| WhichcraftError::Snapshot(format!("journal entry: {e}")))?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let path = entry.path();
        let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        let record = load_journal(id)?;
        if record.status == JournalStatus::Completed {
            completed.push(record);
        }
    }
    completed.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(completed.into_iter().next())
}
