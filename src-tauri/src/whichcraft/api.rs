use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolKind {
    Java,
    Node,
    Python,
    Go,
    Flutter,
    Git,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CorePortName {
    EnvBackend,
    EnvironmentResolver,
    InstallationProbe,
    InstallerCatalog,
    ToolManager,
    UsageProbe,
    Uninstaller,
    Journal,
    TerminalLauncher,
    ShellProbe,
}

impl CorePortName {
    pub const ALL: [CorePortName; 10] = [
        Self::EnvBackend,
        Self::EnvironmentResolver,
        Self::InstallationProbe,
        Self::InstallerCatalog,
        Self::ToolManager,
        Self::UsageProbe,
        Self::Uninstaller,
        Self::Journal,
        Self::TerminalLauncher,
        Self::ShellProbe,
    ];
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoreHealth {
    pub ready: bool,
    pub ports: Vec<CorePortName>,
}
