use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::usage_probe::{UsageProbe, UsageReport};

pub struct FakeUsageProbe;

impl UsageProbe for FakeUsageProbe {
    fn probe(&self, _install_root: &Path) -> Result<UsageReport, EnvarlyError> {
        Ok(UsageReport {
            blocking_processes: Vec::new(),
        })
    }
}
