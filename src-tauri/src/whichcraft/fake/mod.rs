mod environment_resolver;
mod installation_probe;
mod installer_catalog;
mod journal;
mod shell_probe;
mod terminal_launcher;
mod tool_manager;
mod uninstaller;
mod usage_probe;

pub use environment_resolver::FakeEnvironmentResolver;
pub use installation_probe::FakeInstallationProbe;
pub use installer_catalog::FakeInstallerCatalog;
pub use journal::FakeJournal;
pub use shell_probe::FakeShellProbe;
pub use terminal_launcher::FakeTerminalLauncher;
pub use tool_manager::FakeToolManager;
pub use uninstaller::FakeUninstaller;
pub use usage_probe::FakeUsageProbe;

use crate::env_store::MemBackend;

/// In-memory stand-ins for every Whichcraft port (including `MemBackend` for env).
pub struct FakePorts {
    pub env: MemBackend,
    pub environment_resolver: FakeEnvironmentResolver,
    pub installation_probe: FakeInstallationProbe,
    pub installer_catalog: FakeInstallerCatalog,
    pub tool_manager: FakeToolManager,
    pub usage_probe: FakeUsageProbe,
    pub uninstaller: FakeUninstaller,
    pub journal: FakeJournal,
    pub terminal_launcher: FakeTerminalLauncher,
    pub shell_probe: FakeShellProbe,
}

impl Default for FakePorts {
    fn default() -> Self {
        Self {
            env: MemBackend::new(),
            environment_resolver: FakeEnvironmentResolver::default(),
            installation_probe: FakeInstallationProbe::default(),
            installer_catalog: FakeInstallerCatalog,
            tool_manager: FakeToolManager,
            usage_probe: FakeUsageProbe,
            uninstaller: FakeUninstaller,
            journal: FakeJournal::default(),
            terminal_launcher: FakeTerminalLauncher,
            shell_probe: FakeShellProbe,
        }
    }
}

impl FakePorts {
    pub fn env_backend(&self) -> &MemBackend {
        &self.env
    }
}
