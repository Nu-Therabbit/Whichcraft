use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::installation_probe::{InstallationProbe, ToolInstallation};

#[derive(Default)]
pub struct FakeInstallationProbe;

impl InstallationProbe for FakeInstallationProbe {
    fn probe_root(
        &self,
        _tool: ToolKind,
        _root: &Path,
    ) -> Result<Option<ToolInstallation>, EnvarlyError> {
        Ok(None)
    }
}
