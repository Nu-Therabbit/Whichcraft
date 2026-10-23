use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::installer_catalog::{CatalogEntry, InstallerCatalog};

pub struct FakeInstallerCatalog;

impl InstallerCatalog for FakeInstallerCatalog {
    fn entries_for_root(&self, _root: &Path) -> Result<Vec<CatalogEntry>, EnvarlyError> {
        Ok(Vec::new())
    }
}
