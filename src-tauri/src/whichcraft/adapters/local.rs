//! The `Machine` port on this computer's file system, the tool probes and this process's environment.

use std::path::{Path, PathBuf};

use crate::whichcraft::domain::{ToolInstallation, ToolKind};
use crate::whichcraft::ports::machine::Machine;

pub struct LocalMachine;

impl Machine for LocalMachine {
    fn probe(&self, tool: ToolKind, root: &Path, managed: bool) -> Option<ToolInstallation> {
        crate::whichcraft::tools::probe_tool_root(tool, root, managed)
    }
    fn dir_exists(&self, path: &str) -> bool {
        crate::commands::path::dir_exists(path)
    }
    fn is_dir(&self, path: &Path) -> bool {
        path.is_dir()
    }
    fn is_file(&self, path: &Path) -> bool {
        path.is_file()
    }
    fn entries(&self, dir: &Path) -> Vec<PathBuf> {
        std::fs::read_dir(dir).map(|read| read.flatten().map(|e| e.path()).collect()).unwrap_or_default()
    }
    fn read_text(&self, path: &Path) -> Option<String> {
        std::fs::read_to_string(path).ok()
    }
    fn is_reparse_point(&self, path: &Path) -> bool {
        crate::whichcraft::tools::fs_util::is_reparse_point(path)
    }
    fn env_var(&self, name: &str) -> Option<String> {
        std::env::var(name).ok()
    }
}
