use std::sync::Mutex;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::installer_lifecycle::{InstallerLifecycle, MiseStatus};

pub struct FakeInstallerLifecycle {
    pub status: Mutex<Result<MiseStatus, EnvarlyError>>,
    pub prepare: Mutex<Result<bool, EnvarlyError>>,
}

impl FakeInstallerLifecycle {
    pub fn ready(version: &str) -> Self {
        Self {
            status: Mutex::new(Ok(MiseStatus {
                version: version.into(),
                present: true,
                download_bytes: 0,
                old_versions: vec![],
                fetching: false,
            })),
            prepare: Mutex::new(Ok(false)),
        }
    }

    pub fn needs_download(version: &str, bytes: u64) -> Self {
        Self {
            status: Mutex::new(Ok(MiseStatus {
                version: version.into(),
                present: false,
                download_bytes: bytes,
                old_versions: vec![],
                fetching: false,
            })),
            prepare: Mutex::new(Ok(true)),
        }
    }

    pub fn offline(_version: &str) -> Self {
        Self {
            status: Mutex::new(Err(EnvarlyError::InvalidInput("offline".into()))),
            prepare: Mutex::new(Err(EnvarlyError::InvalidInput("offline".into()))),
        }
    }
}

impl InstallerLifecycle for FakeInstallerLifecycle {
    fn mise_status(&self) -> Result<MiseStatus, EnvarlyError> {
        match &*self.status.lock().unwrap() {
            Ok(s) => Ok(s.clone()),
            Err(e) => Err(EnvarlyError::InvalidInput(e.to_string())),
        }
    }

    fn prepare_mise(&self) -> Result<bool, EnvarlyError> {
        match &*self.prepare.lock().unwrap() {
            Ok(b) => Ok(*b),
            Err(e) => Err(EnvarlyError::InvalidInput(e.to_string())),
        }
    }
}
