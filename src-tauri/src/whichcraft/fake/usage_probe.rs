use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::usage_probe::{UsageProbe, UsageReport};

/// Reports the same usage for every installation; nothing is in use by default.
#[derive(Default)]
pub struct FakeUsageProbe {
    pub report: UsageReport,
}

impl UsageProbe for FakeUsageProbe {
    fn probe(&self, _tool: ToolKind, _install_root: &Path) -> Result<UsageReport, EnvarlyError> {
        Ok(self.report.clone())
    }
}
