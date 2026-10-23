mod journal_store;
mod selection_store;

pub use journal_store::{
    load_incomplete_journal, load_last_completed_apply, new_journal_id, save_journal,
    JournalStatus, MutationRecord, WhichcraftJournal,
};
pub use selection_store::{load_java_selection, save_java_selection, JavaSelection};

use std::path::PathBuf;

use crate::error::EnvarlyError;

pub fn whichcraft_data_dir() -> Result<PathBuf, EnvarlyError> {
    let dir = dirs_next::data_local_dir()
        .ok_or_else(|| EnvarlyError::InvalidInput("cannot resolve LOCALAPPDATA".into()))?
        .join("Whichcraft");
    std::fs::create_dir_all(&dir)
        .map_err(|e| EnvarlyError::Snapshot(format!("Cannot create Whichcraft data dir: {e}")))?;
    Ok(dir)
}
