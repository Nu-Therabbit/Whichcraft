use std::path::Path;

use crate::error::EnvarlyError;

pub trait Uninstaller: Send + Sync {
    fn uninstall_managed(&self, install_root: &Path) -> Result<(), EnvarlyError>;
}
