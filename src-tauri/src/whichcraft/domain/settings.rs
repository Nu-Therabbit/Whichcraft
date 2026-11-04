//! What the user set: where installs go, extra folders to scan, which terminal to open.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WhichcraftSettings {
    /// Empty until the store adapter fills in its default location.
    #[serde(default)]
    pub install_store: PathBuf,
    /// Stores used before the current one. Their installations stay listed and uninstallable
    /// until they are empty (Q28).
    #[serde(default)]
    pub previous_install_stores: Vec<PathBuf>,
    /// Whether the user has confirmed the install folder; the first install asks until then (I-5).
    #[serde(default)]
    pub install_store_confirmed: bool,
    #[serde(default)]
    pub scan_roots: Vec<PathBuf>,
    #[serde(default)]
    pub recent_repositories: Vec<String>,
    #[serde(default)]
    pub terminal: TerminalKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TerminalKind {
    #[default]
    WindowsTerminal,
    PowerShell,
    Cmd,
}

impl Default for WhichcraftSettings {
    fn default() -> Self {
        Self {
            install_store: PathBuf::new(),
            previous_install_stores: Vec::new(),
            install_store_confirmed: false,
            scan_roots: Vec::new(),
            recent_repositories: Vec::new(),
            terminal: TerminalKind::WindowsTerminal,
        }
    }
}

impl WhichcraftSettings {
    /// The current store first, then every earlier one.
    pub fn all_install_stores(&self) -> Vec<PathBuf> {
        let mut stores = vec![self.install_store.clone()];
        for s in &self.previous_install_stores {
            if !stores.contains(s) {
                stores.push(s.clone());
            }
        }
        stores
    }

    /// Switches to `store` for new installations and keeps the old one listed.
    pub fn switch_install_store(&mut self, store: PathBuf) {
        if store == self.install_store {
            return;
        }
        let old = std::mem::replace(&mut self.install_store, store);
        self.previous_install_stores
            .retain(|s| *s != self.install_store && *s != old);
        self.previous_install_stores.insert(0, old);
    }
}
