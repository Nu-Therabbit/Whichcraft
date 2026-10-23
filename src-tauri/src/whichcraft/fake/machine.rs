use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::whichcraft::domain::plan::path_dirs_for_tool;
use crate::whichcraft::domain::{ToolInstallation, ToolKind};
use crate::whichcraft::ports::machine::Machine;
use crate::whichcraft::tools::command_name;

/// A computer that exists only in memory: installations, folders, files and environment
/// variables a test puts there. Paths compare the way Windows does (case, trailing separator).
#[derive(Default)]
pub struct FakeMachine {
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    installs: Vec<ToolInstallation>,
    dirs: Vec<PathBuf>,
    files: Vec<PathBuf>,
    vars: HashMap<String, String>,
}

fn key(p: &Path) -> String {
    p.to_string_lossy().trim_end_matches(['\\', '/']).to_ascii_lowercase()
}

fn same(a: &Path, b: &Path) -> bool {
    key(a) == key(b)
}

impl FakeMachine {
    /// An installation with the folders and executable PATH would find it by.
    pub fn add_install(&self, installation: ToolInstallation) {
        let tool = installation.tool;
        let mut s = self.state.lock().unwrap();
        s.dirs.push(installation.root.clone());
        for dir in path_dirs_for_tool(&installation) {
            let ext = if tool == ToolKind::Flutter { "bat" } else { "exe" };
            s.dirs.push(PathBuf::from(&dir));
            s.files.push(PathBuf::from(dir).join(format!("{}.{ext}", command_name(tool))));
        }
        s.installs.push(installation);
    }

    /// Takes an installation and everything under its root away, as an uninstaller would.
    pub fn remove_tree(&self, root: &Path) {
        let mut s = self.state.lock().unwrap();
        let under = |p: &Path| key(p) == key(root) || key(p).starts_with(&format!("{}\\", key(root)));
        s.installs.retain(|i| !under(&i.root));
        s.dirs.retain(|d| !under(d));
        s.files.retain(|f| !under(f));
    }

    pub fn set_var(&self, name: &str, value: &str) {
        self.state.lock().unwrap().vars.insert(name.into(), value.into());
    }
}

impl Machine for FakeMachine {
    fn probe(&self, tool: ToolKind, root: &Path, managed: bool) -> Option<ToolInstallation> {
        let s = self.state.lock().unwrap();
        s.installs
            .iter()
            .find(|i| i.tool == tool && same(&i.root, root))
            .map(|i| ToolInstallation { managed, ..i.clone() })
    }
    fn dir_exists(&self, path: &str) -> bool {
        let p = Path::new(path);
        self.is_dir(p) || self.is_file(p)
    }
    fn is_dir(&self, path: &Path) -> bool {
        let s = self.state.lock().unwrap();
        let k = key(path);
        s.dirs.iter().any(|d| key(d) == k) || s.files.iter().chain(&s.dirs).any(|f| key(f).starts_with(&format!("{k}\\")))
    }
    fn is_file(&self, path: &Path) -> bool {
        self.state.lock().unwrap().files.iter().any(|f| same(f, path))
    }
    fn entries(&self, dir: &Path) -> Vec<PathBuf> {
        let s = self.state.lock().unwrap();
        let prefix = format!("{}\\", key(dir));
        let mut out: Vec<PathBuf> = Vec::new();
        for p in s.dirs.iter().chain(&s.files) {
            let k = key(p);
            if let Some(rest) = k.strip_prefix(&prefix) {
                let first = rest.split('\\').next().unwrap_or_default();
                let child = dir.join(first);
                if !first.is_empty() && !out.iter().any(|o| same(o, &child)) {
                    out.push(child);
                }
            }
        }
        out
    }
    fn read_text(&self, _path: &Path) -> Option<String> {
        None
    }
    fn is_reparse_point(&self, _path: &Path) -> bool {
        false
    }
    fn env_var(&self, name: &str) -> Option<String> {
        self.state.lock().unwrap().vars.get(name).cloned()
    }
}

/// Shared, so a test keeps a handle on the machine it gave to the app.
impl Machine for Arc<FakeMachine> {
    fn probe(&self, tool: ToolKind, root: &Path, managed: bool) -> Option<ToolInstallation> {
        (**self).probe(tool, root, managed)
    }
    fn dir_exists(&self, path: &str) -> bool {
        (**self).dir_exists(path)
    }
    fn is_dir(&self, path: &Path) -> bool {
        (**self).is_dir(path)
    }
    fn is_file(&self, path: &Path) -> bool {
        (**self).is_file(path)
    }
    fn entries(&self, dir: &Path) -> Vec<PathBuf> {
        (**self).entries(dir)
    }
    fn read_text(&self, path: &Path) -> Option<String> {
        (**self).read_text(path)
    }
    fn is_reparse_point(&self, path: &Path) -> bool {
        (**self).is_reparse_point(path)
    }
    fn env_var(&self, name: &str) -> Option<String> {
        (**self).env_var(name)
    }
}
