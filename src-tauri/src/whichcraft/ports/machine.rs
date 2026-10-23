use std::path::{Path, PathBuf};

use crate::whichcraft::domain::{ToolInstallation, ToolKind};

/// This computer as discovery and planning see it: what is installed where, which folders exist,
/// and this process's own environment (for the folders installers use by default).
pub trait Machine: Send + Sync {
    /// The installation of `tool` rooted at `root`, if there is one (it may run its version command).
    fn probe(&self, tool: ToolKind, root: &Path, managed: bool) -> Option<ToolInstallation>;
    /// Whether a PATH folder exists. An access-denied folder counts as existing.
    fn dir_exists(&self, path: &str) -> bool;
    fn is_dir(&self, path: &Path) -> bool;
    fn is_file(&self, path: &Path) -> bool;
    /// Everything directly inside `dir`; empty when it cannot be read.
    fn entries(&self, dir: &Path) -> Vec<PathBuf>;
    /// A small text file's contents, or `None` when it cannot be read.
    fn read_text(&self, path: &Path) -> Option<String>;
    /// Junctions and symbolic links, which are never treated as installations or removed.
    fn is_reparse_point(&self, path: &Path) -> bool;
    /// A variable of this process's environment, such as ProgramFiles or LOCALAPPDATA.
    fn env_var(&self, name: &str) -> Option<String>;
}
