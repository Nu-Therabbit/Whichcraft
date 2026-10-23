use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::uninstaller::Uninstaller;

pub struct FakeUninstaller;

impl Uninstaller for FakeUninstaller {
    fn uninstall_managed(&self, _install_root: &Path) -> Result<(), EnvarlyError> {
        Ok(())
    }
}
