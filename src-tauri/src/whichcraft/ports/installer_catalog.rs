use std::path::PathBuf;


use crate::error::EnvarlyError;
use crate::whichcraft::domain::InstallerKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogEntry {
    pub install_root: PathBuf,
    pub kind: InstallerKind,
    pub display_name: String,
    pub uninstall_command: Option<String>,
}

pub trait InstallerCatalog: Send + Sync {
    fn entries_for_root(&self, root: &std::path::Path)
        -> Result<Vec<CatalogEntry>, EnvarlyError>;
}
