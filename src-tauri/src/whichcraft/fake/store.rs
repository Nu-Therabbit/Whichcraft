use std::collections::HashMap;
use std::sync::Mutex;

use crate::error::WhichcraftError;
use crate::whichcraft::domain::journal::{JournalStatus, WhichcraftJournal};
use crate::whichcraft::domain::profiles::ToolProfile;
use crate::whichcraft::domain::selection::ToolSelection;
use crate::whichcraft::domain::settings::WhichcraftSettings;
use crate::whichcraft::domain::uninstall::UninstallRecord;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::ports::store::Store;

/// Keeps everything in memory, as the file store would on disk.
#[derive(Default)]
pub struct MemStore {
    pub settings: Mutex<WhichcraftSettings>,
    pub selections: Mutex<HashMap<ToolKind, ToolSelection>>,
    pub journals: Mutex<Vec<WhichcraftJournal>>,
    pub profiles: Mutex<Vec<ToolProfile>>,
    pub uninstalls: Mutex<Vec<UninstallRecord>>,
}

impl Store for MemStore {
    fn settings(&self) -> Result<WhichcraftSettings, WhichcraftError> {
        Ok(self.settings.lock().unwrap().clone())
    }
    fn save_settings(&self, settings: &WhichcraftSettings) -> Result<(), WhichcraftError> {
        *self.settings.lock().unwrap() = settings.clone();
        Ok(())
    }
    fn selection(&self, tool: ToolKind) -> Result<Option<ToolSelection>, WhichcraftError> {
        Ok(self.selections.lock().unwrap().get(&tool).cloned())
    }
    fn save_selection(&self, selection: &ToolSelection) -> Result<(), WhichcraftError> {
        self.selections
            .lock()
            .unwrap()
            .insert(selection.tool, selection.clone());
        Ok(())
    }
    fn save_journal(&self, journal: &WhichcraftJournal) -> Result<(), WhichcraftError> {
        let mut all = self.journals.lock().unwrap();
        all.retain(|j| j.id != journal.id);
        all.push(journal.clone());
        Ok(())
    }
    fn journal(&self, id: &str) -> Result<WhichcraftJournal, WhichcraftError> {
        self.journals
            .lock()
            .unwrap()
            .iter()
            .find(|j| j.id == id)
            .cloned()
            .ok_or_else(|| WhichcraftError::Snapshot(format!("no journal {id}")))
    }
    fn incomplete_journal(&self) -> Result<Option<WhichcraftJournal>, WhichcraftError> {
        Ok(newest(
            &self.journals.lock().unwrap(),
            JournalStatus::Pending,
        ))
    }
    fn last_completed_apply(&self) -> Result<Option<WhichcraftJournal>, WhichcraftError> {
        Ok(newest(
            &self.journals.lock().unwrap(),
            JournalStatus::Completed,
        ))
    }
    fn profiles(&self) -> Result<Vec<ToolProfile>, WhichcraftError> {
        Ok(self.profiles.lock().unwrap().clone())
    }
    fn save_profiles(&self, profiles: &[ToolProfile]) -> Result<(), WhichcraftError> {
        *self.profiles.lock().unwrap() = profiles.to_vec();
        Ok(())
    }
    fn save_uninstall_record(&self, record: &UninstallRecord) -> Result<(), WhichcraftError> {
        let mut all = self.uninstalls.lock().unwrap();
        all.retain(|r| r.id != record.id);
        all.push(record.clone());
        Ok(())
    }
    fn uninstall_records(&self) -> Result<Vec<UninstallRecord>, WhichcraftError> {
        let mut all = self.uninstalls.lock().unwrap().clone();
        all.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        Ok(all)
    }
}

fn newest(journals: &[WhichcraftJournal], status: JournalStatus) -> Option<WhichcraftJournal> {
    journals
        .iter()
        .filter(|j| j.status == status)
        .max_by(|a, b| a.created_at.cmp(&b.created_at))
        .cloned()
}
