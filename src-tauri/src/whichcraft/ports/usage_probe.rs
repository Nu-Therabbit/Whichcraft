use std::path::Path;

use crate::error::EnvarlyError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UsageReport {
    pub blocking_processes: Vec<String>,
}

pub trait UsageProbe: Send + Sync {
    fn probe(&self, install_root: &Path) -> Result<UsageReport, EnvarlyError>;
}
