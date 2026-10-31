use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use super::FakeMachine;
use crate::error::WhichcraftError;
use crate::whichcraft::domain::store_layout::mise_installs_dir;
use crate::whichcraft::domain::versions::RemoteVersion;
use crate::whichcraft::domain::{ToolInstallation, ToolKind};
use crate::whichcraft::ports::tool_manager::{ToolManager, ToolManagers};

/// An installer that "downloads" into a `FakeMachine`, so what it installs is found afterwards.
#[derive(Default)]
pub struct FakeTools {
    pub machine: Arc<FakeMachine>,
    pub remote: Mutex<HashMap<ToolKind, Vec<String>>>,
    pub download_bytes: Mutex<HashMap<String, u64>>,
    /// (store, tool, version) of every install.
    pub installed: Mutex<Vec<(PathBuf, ToolKind, String)>>,
}

impl FakeTools {
    pub fn with_machine(machine: Arc<FakeMachine>) -> Arc<Self> {
        Arc::new(Self {
            machine,
            ..Default::default()
        })
    }

    pub fn offer(&self, tool: ToolKind, versions: &[&str]) {
        self.remote
            .lock()
            .unwrap()
            .insert(tool, versions.iter().map(|v| v.to_string()).collect());
    }
}

pub struct FakeToolManagers(pub Arc<FakeTools>);

impl ToolManagers for FakeToolManagers {
    fn for_store(&self, install_store: &Path) -> Box<dyn ToolManager> {
        Box::new(FakeToolManager {
            tools: self.0.clone(),
            store: install_store.to_path_buf(),
        })
    }
}

struct FakeToolManager {
    tools: Arc<FakeTools>,
    store: PathBuf,
}

fn vendor(tool: ToolKind) -> &'static str {
    match tool {
        ToolKind::Java => "Eclipse Adoptium",
        ToolKind::Node => "Node.js",
        ToolKind::Python => "Python",
        ToolKind::Go => "Go",
        ToolKind::Flutter => "Flutter",
        ToolKind::Git => "Git",
    }
}

impl ToolManager for FakeToolManager {
    fn list_remote(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, WhichcraftError> {
        Ok(self
            .tools
            .remote
            .lock()
            .unwrap()
            .get(&tool)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|version| RemoteVersion {
                version,
                download_bytes: None,
                install_bytes: None,
            })
            .collect())
    }

    fn install(&self, tool: ToolKind, version: &str) -> Result<PathBuf, WhichcraftError> {
        let dir = mise_installs_dir(&self.store, tool).ok_or_else(|| {
            WhichcraftError::InvalidInput(format!("{tool:?} cannot be installed"))
        })?;
        let root = dir.join(version);
        let display = version
            .split('+')
            .next()
            .unwrap_or(version)
            .trim_end_matches("-stable")
            .to_string();
        self.tools.machine.add_install(ToolInstallation {
            tool,
            vendor: vendor(tool).into(),
            version: display,
            root: root.clone(),
            managed: true,
        });
        self.tools
            .installed
            .lock()
            .unwrap()
            .push((self.store.clone(), tool, version.into()));
        Ok(root)
    }

    fn uninstall(&self, tool: ToolKind, version: &str) -> Result<(), WhichcraftError> {
        if let Some(dir) = mise_installs_dir(&self.store, tool) {
            self.tools.machine.remove_tree(&dir.join(version));
        }
        Ok(())
    }

    fn download_size(
        &self,
        _tool: ToolKind,
        version: &str,
    ) -> Result<Option<u64>, WhichcraftError> {
        Ok(self
            .tools
            .download_bytes
            .lock()
            .unwrap()
            .get(version)
            .copied())
    }
}
