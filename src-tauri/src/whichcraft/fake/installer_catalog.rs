use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::installer_catalog::{CatalogEntry, InstallerCatalog};

/// Knows only the entries a test gives it; anything else is a plain folder.
#[derive(Default)]
pub struct FakeInstallerCatalog {
    pub entries: Vec<CatalogEntry>,
}

impl InstallerCatalog for FakeInstallerCatalog {
    fn entries_for_root(&self, root: &Path) -> Result<Vec<CatalogEntry>, EnvarlyError> {
        Ok(self.entries.iter().filter(|e| e.install_root == root).cloned().collect())
    }
}

/// A catalog source with no uninstall entries: every installation is a plain folder.
pub struct NoInstallerEntries;

impl crate::whichcraft::ports::installer_catalog::InstallerCatalogSource for NoInstallerEntries {
    fn load(&self) -> Result<Box<dyn InstallerCatalog>, EnvarlyError> {
        Ok(Box::new(FakeInstallerCatalog::default()))
    }
}

/// No uninstall entries, and counts how often the App asks for a fresh read.
#[derive(Default)]
pub struct CountingCatalogs {
    pub invalidations: std::sync::atomic::AtomicUsize,
}

impl crate::whichcraft::ports::installer_catalog::InstallerCatalogSource for std::sync::Arc<CountingCatalogs> {
    fn load(&self) -> Result<Box<dyn InstallerCatalog>, EnvarlyError> {
        Ok(Box::new(FakeInstallerCatalog::default()))
    }

    fn invalidate(&self) {
        self.invalidations.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }
}
