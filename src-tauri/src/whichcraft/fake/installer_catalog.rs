use std::path::Path;

use crate::error::WhichcraftError;
use crate::whichcraft::ports::installer_catalog::{CatalogEntry, InstallerCatalog};

/// Knows only the entries a test gives it; anything else is a plain folder.
#[derive(Default)]
pub struct FakeInstallerCatalog {
    pub entries: Vec<CatalogEntry>,
}

impl InstallerCatalog for FakeInstallerCatalog {
    fn entries_for_root(&self, root: &Path) -> Result<Vec<CatalogEntry>, WhichcraftError> {
        Ok(self
            .entries
            .iter()
            .filter(|e| root.starts_with(&e.install_root))
            .cloned()
            .collect())
    }
    fn install_roots(&self) -> Vec<std::path::PathBuf> {
        self.entries
            .iter()
            .map(|e| e.install_root.clone())
            .collect()
    }
}

/// A catalog source with no uninstall entries: every installation is a plain folder.
pub struct NoInstallerEntries;

impl crate::whichcraft::ports::installer_catalog::InstallerCatalogSource for NoInstallerEntries {
    fn load(&self) -> Result<Box<dyn InstallerCatalog>, WhichcraftError> {
        Ok(Box::new(FakeInstallerCatalog::default()))
    }
}

/// No uninstall entries, and counts how often the App asks for a fresh read.
#[derive(Default)]
pub struct CountingCatalogs {
    pub invalidations: std::sync::atomic::AtomicUsize,
}

impl crate::whichcraft::ports::installer_catalog::InstallerCatalogSource
    for std::sync::Arc<CountingCatalogs>
{
    fn load(&self) -> Result<Box<dyn InstallerCatalog>, WhichcraftError> {
        Ok(Box::new(FakeInstallerCatalog::default()))
    }

    fn invalidate(&self) {
        self.invalidations
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }
}
