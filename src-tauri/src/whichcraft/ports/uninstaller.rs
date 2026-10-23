use std::path::Path;

use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;

/// How a vendor uninstaller ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunOutcome {
    Finished,
    /// The user closed or cancelled the uninstaller (MSI exit code 1602).
    Cancelled,
    Failed(i32),
}

/// The ways Whichcraft removes an installation.
pub trait Uninstaller: Send + Sync {
    /// Runs a vendor uninstaller with its normal UI and waits for it (Q18).
    fn run_uninstaller(&self, program: &str, args: &[String]) -> Result<RunOutcome, EnvarlyError>;
    /// Moves a folder to the Recycle Bin.
    fn recycle_folder(&self, folder: &Path) -> Result<(), EnvarlyError>;
    /// Removes a Whichcraft-managed installation with mise, in the store that holds it.
    fn uninstall_managed(&self, store: &Path, tool: ToolKind, mise_version: &str) -> Result<(), EnvarlyError>;
}
