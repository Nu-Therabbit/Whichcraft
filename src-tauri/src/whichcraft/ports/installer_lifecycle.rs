use crate::error::EnvarlyError;

/// Whether the pinned mise is already on disk, and what the first install would download.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MiseStatus {
    pub version: String,
    pub present: bool,
    pub download_bytes: u64,
    /// Versions an earlier Whichcraft pinned that are still on disk, newest first.
    pub old_versions: Vec<String>,
    /// The pinned mise is being downloaded in the background; installs wait for it.
    pub fetching: bool,
}

/// Status and background preparation of the pinned mise bundled with Whichcraft.
pub trait InstallerLifecycle: Send + Sync {
    fn mise_status(&self) -> Result<MiseStatus, EnvarlyError>;
    /// Fetches a newly pinned mise when an older one remains; returns whether anything was fetched.
    fn prepare_mise(&self) -> Result<bool, EnvarlyError>;
}
