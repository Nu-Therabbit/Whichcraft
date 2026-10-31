use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::error::WhichcraftError;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::ports::uninstaller::{RunOutcome, Uninstaller};

/// Records what it was asked to do. Removing really deletes the folder (tests use temp dirs) so
/// the rescan after an uninstall sees the result, unless `leaves_folder` is set.
pub struct FakeUninstaller {
    pub outcome: RunOutcome,
    pub leaves_folder: bool,
    pub ran: Mutex<Vec<String>>,
    pub recycled: Mutex<Vec<PathBuf>>,
    pub managed: Mutex<Vec<(PathBuf, ToolKind, String)>>,
    /// The folder a vendor uninstaller removes when it finishes.
    pub removes: Mutex<Option<PathBuf>>,
}

impl Default for FakeUninstaller {
    fn default() -> Self {
        Self {
            outcome: RunOutcome::Finished,
            leaves_folder: false,
            ran: Mutex::new(Vec::new()),
            recycled: Mutex::new(Vec::new()),
            managed: Mutex::new(Vec::new()),
            removes: Mutex::new(None),
        }
    }
}

impl FakeUninstaller {
    fn remove(&self, folder: &Path) {
        if !self.leaves_folder {
            let _ = std::fs::remove_dir_all(folder);
        }
    }
}

impl Uninstaller for FakeUninstaller {
    fn run_uninstaller(
        &self,
        program: &str,
        args: &[String],
    ) -> Result<RunOutcome, WhichcraftError> {
        self.ran.lock().unwrap().push(
            std::iter::once(program.to_string())
                .chain(args.iter().cloned())
                .collect::<Vec<_>>()
                .join(" "),
        );
        if self.outcome == RunOutcome::Finished {
            if let Some(folder) = self.removes.lock().unwrap().as_ref() {
                self.remove(folder);
            }
        }
        Ok(self.outcome.clone())
    }

    fn recycle_folder(&self, folder: &Path) -> Result<(), WhichcraftError> {
        self.recycled.lock().unwrap().push(folder.to_path_buf());
        self.remove(folder);
        Ok(())
    }

    fn uninstall_managed(
        &self,
        store: &Path,
        tool: ToolKind,
        mise_version: &str,
    ) -> Result<(), WhichcraftError> {
        self.managed
            .lock()
            .unwrap()
            .push((store.to_path_buf(), tool, mise_version.to_string()));
        if let Some(folder) = self.removes.lock().unwrap().as_ref() {
            self.remove(folder);
        }
        Ok(())
    }
}
