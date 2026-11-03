//! The `Store` port on JSON files in `%LOCALAPPDATA%\Whichcraft`.

use std::path::PathBuf;

use super::whichcraft_data_dir;
use crate::error::WhichcraftError;
use crate::whichcraft::domain::journal::WhichcraftJournal;
use crate::whichcraft::domain::profiles::ToolProfile;
use crate::whichcraft::domain::selection::ToolSelection;
use crate::whichcraft::domain::settings::WhichcraftSettings;
use crate::whichcraft::domain::uninstall::UninstallRecord;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::ports::store::Store;

pub struct FileStore;

impl Store for FileStore {
    fn settings(&self) -> Result<WhichcraftSettings, WhichcraftError> {
        super::load_settings()
    }
    fn save_settings(&self, settings: &WhichcraftSettings) -> Result<(), WhichcraftError> {
        super::save_settings(settings)
    }
    fn selection(&self, tool: ToolKind) -> Result<Option<ToolSelection>, WhichcraftError> {
        super::load_tool_selection(tool)
    }
    fn save_selection(&self, selection: &ToolSelection) -> Result<(), WhichcraftError> {
        super::save_tool_selection(selection)
    }
    fn clear_selection(&self, tool: ToolKind) -> Result<(), WhichcraftError> {
        super::clear_tool_selection(tool)
    }
    fn save_journal(&self, journal: &WhichcraftJournal) -> Result<(), WhichcraftError> {
        super::save_journal(journal)
    }
    fn journal(&self, id: &str) -> Result<WhichcraftJournal, WhichcraftError> {
        super::load_journal(id)
    }
    fn incomplete_journal(&self) -> Result<Option<WhichcraftJournal>, WhichcraftError> {
        super::load_incomplete_journal()
    }
    fn last_completed_apply(&self) -> Result<Option<WhichcraftJournal>, WhichcraftError> {
        super::load_last_completed_apply()
    }

    fn profiles(&self) -> Result<Vec<ToolProfile>, WhichcraftError> {
        let path = profiles_path()?;
        if !path.is_file() {
            return Ok(Vec::new());
        }
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| WhichcraftError::Snapshot(format!("read profiles: {e}")))?;
        serde_json::from_str(&raw)
            .map_err(|e| WhichcraftError::Snapshot(format!("parse profiles: {e}")))
    }
    fn save_profiles(&self, profiles: &[ToolProfile]) -> Result<(), WhichcraftError> {
        let text = serde_json::to_string_pretty(profiles)
            .map_err(|e| WhichcraftError::Snapshot(format!("serialize profiles: {e}")))?;
        std::fs::write(profiles_path()?, text)
            .map_err(|e| WhichcraftError::Snapshot(format!("write profiles: {e}")))
    }

    fn save_uninstall_record(&self, record: &UninstallRecord) -> Result<(), WhichcraftError> {
        let text = serde_json::to_string_pretty(record)
            .map_err(|e| WhichcraftError::Snapshot(format!("serialize uninstall record: {e}")))?;
        std::fs::write(uninstall_dir()?.join(format!("{}.json", record.id)), text)
            .map_err(|e| WhichcraftError::Snapshot(format!("write uninstall record: {e}")))
    }
    fn uninstall_records(&self) -> Result<Vec<UninstallRecord>, WhichcraftError> {
        let mut records: Vec<UninstallRecord> = std::fs::read_dir(uninstall_dir()?)
            .map_err(|e| WhichcraftError::Snapshot(format!("read uninstall journal: {e}")))?
            .flatten()
            .filter_map(|e| serde_json::from_str(&std::fs::read_to_string(e.path()).ok()?).ok())
            .collect();
        records.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        Ok(records)
    }
}

fn profiles_path() -> Result<PathBuf, WhichcraftError> {
    Ok(whichcraft_data_dir()?.join("profiles.json"))
}

/// Kept apart from the apply journals in `journal`, so Undo and recovery, which read every file
/// there as an apply, never take an uninstall for one.
fn uninstall_dir() -> Result<PathBuf, WhichcraftError> {
    let dir = whichcraft_data_dir()?.join("journal").join("uninstalls");
    std::fs::create_dir_all(&dir)
        .map_err(|e| WhichcraftError::Snapshot(format!("create uninstall journal dir: {e}")))?;
    Ok(dir)
}
