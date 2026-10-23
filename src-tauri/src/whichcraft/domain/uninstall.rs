//! How an installation is removed, how that ended, and reading registered uninstall commands.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
pub enum UninstallMethod {
    /// `mise uninstall` in the store that holds the installation.
    Managed { store: PathBuf, mise_version: String },
    /// The registered uninstaller, run with its normal UI.
    Uninstaller { program: String, args: Vec<String> },
    /// Move the folder to the Recycle Bin.
    RecycleFolder,
    /// Not offered, with the reason shown to the user.
    Refused { reason: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum UninstallOutcome {
    Removed,
    /// The user cancelled the uninstaller; any switch already applied stays (R-13).
    Cancelled,
    /// The uninstaller finished but the folder is still there (R-5).
    Incomplete { remaining: PathBuf },
    Blocked { reason: String },
    Failed { code: i32 },
}

/// Splits a registered command line into program and arguments, honouring double quotes.
pub fn split_command_line(command: &str) -> Option<(String, Vec<String>)> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for ch in command.chars() {
        match ch {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !current.is_empty() {
                    parts.push(std::mem::take(&mut current));
                }
            }
            c => current.push(c),
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }
    let mut iter = parts.into_iter();
    let program = iter.next()?;
    Some((program, iter.collect()))
}

pub fn product_code(command: &str) -> Option<String> {
    let start = command.find('{')?;
    let end = start + command[start..].find('}')?;
    Some(command[start..=end].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registered_command_lines_keep_their_quoted_parts() {
        assert_eq!(
            split_command_line("\"C:\\Program Files\\Git\\unins001.exe\""),
            Some(("C:\\Program Files\\Git\\unins001.exe".into(), vec![]))
        );
        assert_eq!(
            split_command_line("\"C:\\x\\pymanager.exe\" uninstall --yes --by-id \"pythoncore-3.14-64\""),
            Some(("C:\\x\\pymanager.exe".into(), vec!["uninstall".into(), "--yes".into(), "--by-id".into(), "pythoncore-3.14-64".into()]))
        );
    }
}
