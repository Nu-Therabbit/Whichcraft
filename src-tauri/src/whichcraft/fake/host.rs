//! Fakes for the smaller ports: UAC, the SDK locators and starting processes.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::error::EnvarlyError;
use crate::whichcraft::ports::elevator::{ElevatedOutcome, ElevatedRequest, Elevator};
use crate::whichcraft::ports::process::{ProcessRunner, ProcessSpec};
use crate::whichcraft::ports::sdk::SdkProbe;

/// A user who always declines UAC; for use cases that should never need it.
pub struct DeclinesUac;

impl Elevator for DeclinesUac {
    fn apply_system(&self, _request: &ElevatedRequest) -> Result<ElevatedOutcome, EnvarlyError> {
        Ok(ElevatedOutcome::Cancelled)
    }
}

/// No launcher, no Visual Studio, no Windows SDK.
pub struct NoSdks;

impl SdkProbe for NoSdks {
    fn py_launcher_list(&self) -> Option<String> {
        None
    }
    fn python_store_alias(&self) -> Option<PathBuf> {
        None
    }
    fn vswhere_json(&self) -> Option<String> {
        None
    }
    fn windows_kits_root(&self) -> Option<PathBuf> {
        None
    }
}

/// Records what would have been started or opened.
#[derive(Default)]
pub struct FakeProcessRunner {
    pub spawned: Mutex<Vec<ProcessSpec>>,
    pub opened: Mutex<Vec<PathBuf>>,
    pub environment: HashMap<String, String>,
}

impl ProcessRunner for Arc<FakeProcessRunner> {
    fn spawn(&self, spec: &ProcessSpec) -> Result<(), EnvarlyError> {
        self.spawned.lock().unwrap().push(spec.clone());
        Ok(())
    }
    fn output(&self, _spec: &ProcessSpec) -> Result<String, EnvarlyError> {
        Ok(String::new())
    }
    fn fresh_environment(&self) -> Result<HashMap<String, String>, EnvarlyError> {
        Ok(self.environment.clone())
    }
    fn open_folder(&self, folder: &Path) -> Result<(), EnvarlyError> {
        self.opened.lock().unwrap().push(folder.to_path_buf());
        Ok(())
    }
}

/// Removes from a `FakeMachine`: managed installs through the store layout, the rest by folder.
pub struct MachineUninstaller(pub Arc<super::FakeMachine>);

impl crate::whichcraft::ports::uninstaller::Uninstaller for MachineUninstaller {
    fn run_uninstaller(
        &self,
        _program: &str,
        _args: &[String],
    ) -> Result<crate::whichcraft::ports::uninstaller::RunOutcome, EnvarlyError> {
        Ok(crate::whichcraft::ports::uninstaller::RunOutcome::Finished)
    }
    fn recycle_folder(&self, folder: &Path) -> Result<(), EnvarlyError> {
        self.0.remove_tree(folder);
        Ok(())
    }
    fn uninstall_managed(
        &self,
        store: &Path,
        tool: crate::whichcraft::domain::ToolKind,
        version: &str,
    ) -> Result<(), EnvarlyError> {
        if let Some(dir) = crate::whichcraft::domain::store_layout::mise_installs_dir(store, tool) {
            self.0.remove_tree(&dir.join(version));
        }
        Ok(())
    }
}
