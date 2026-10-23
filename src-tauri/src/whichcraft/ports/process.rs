use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::error::EnvarlyError;

/// A process to start: program, arguments, the complete environment it gets, and its folder.
#[derive(Debug, Clone, PartialEq)]
pub struct ProcessSpec {
    pub program: String,
    pub args: Vec<String>,
    /// The whole environment; nothing is inherited from this app.
    pub env: HashMap<String, String>,
    pub cwd: PathBuf,
}

pub trait ProcessRunner: Send + Sync {
    /// Starts a visible process and returns without waiting.
    fn spawn(&self, spec: &ProcessSpec) -> Result<(), EnvarlyError>;
    /// Runs a hidden process to completion and returns its stdout.
    fn output(&self, spec: &ProcessSpec) -> Result<String, EnvarlyError>;
    /// The environment Windows builds from the registry for a process started now; the app's own
    /// copy goes stale after an apply.
    fn fresh_environment(&self) -> Result<HashMap<String, String>, EnvarlyError>;
    /// Shows a folder in Explorer.
    fn open_folder(&self, folder: &Path) -> Result<(), EnvarlyError>;
}
