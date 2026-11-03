mod config_store;
mod file_store;
mod journal_store;
mod selection_store;

pub use config_store::{load_settings, save_settings};
pub use file_store::FileStore;
pub use journal_store::{
    load_incomplete_journal, load_journal, load_last_completed_apply, save_journal,
};
pub use selection_store::{clear_tool_selection, load_tool_selection, save_tool_selection};

use std::path::PathBuf;

use crate::error::WhichcraftError;

// dirs_next resolves LOCALAPPDATA through the known-folder API on Windows, so setting the
// environment variable in a test does not redirect it. Tests use a per-thread override.
#[cfg(test)]
thread_local! {
    static TEST_DATA_DIR: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) };
}

/// Points this test thread's Whichcraft data dir at a temporary folder.
#[cfg(test)]
pub fn use_test_data_dir(dir: &std::path::Path) {
    TEST_DATA_DIR.with(|d| *d.borrow_mut() = Some(dir.to_path_buf()));
}

pub fn whichcraft_data_dir() -> Result<PathBuf, WhichcraftError> {
    #[cfg(test)]
    let base = TEST_DATA_DIR.with(|d| d.borrow().clone()).ok_or_else(|| {
        WhichcraftError::InvalidInput("test touched the data dir without use_test_data_dir".into())
    })?;
    #[cfg(not(test))]
    let base = dirs_next::data_local_dir()
        .ok_or_else(|| WhichcraftError::InvalidInput("cannot resolve LOCALAPPDATA".into()))?;
    let dir = base.join("Whichcraft");
    std::fs::create_dir_all(&dir).map_err(|e| {
        WhichcraftError::Snapshot(format!("Cannot create Whichcraft data dir: {e}"))
    })?;
    Ok(dir)
}
