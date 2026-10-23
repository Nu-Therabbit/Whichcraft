use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::api::{CoreHealth, CorePortName};
use crate::whichcraft::fake::FakePorts;
use crate::whichcraft::ports::{
    EnvironmentResolver, InstallationProbe, InstallerCatalog, Journal, ShellProbe,
    TerminalLauncher, ToolManager, Uninstaller, UsageProbe,
};

pub struct WhichcraftCore<P> {
    ports: P,
}

impl WhichcraftCore<FakePorts> {
    pub fn with_fakes() -> Self {
        Self {
            ports: FakePorts::default(),
        }
    }
}

impl<P> WhichcraftCore<P> {
    pub fn health(&self) -> CoreHealth {
        CoreHealth {
            ready: true,
            ports: CorePortName::ALL.to_vec(),
        }
    }

    pub fn ports(&self) -> &P {
        &self.ports
    }
}

impl WhichcraftCore<FakePorts> {
    /// Smoke path: append a journal entry through the core API using in-memory ports.
    pub fn record_smoke_journal(&mut self) -> Result<(), EnvarlyError> {
        use crate::whichcraft::ports::journal::{JournalEntry, JournalEntryKind};
        self.ports.journal.append(JournalEntry {
            kind: JournalEntryKind::ApplyStarted,
            detail: "smoke".into(),
        })
    }
}

/// Generic bundle used when wiring real adapters (Windows) alongside fakes in tests.
pub struct PortBundle<E, ER, IP, IC, TM, UP, U, J, TL, SP> {
    pub env: E,
    pub environment_resolver: ER,
    pub installation_probe: IP,
    pub installer_catalog: IC,
    pub tool_manager: TM,
    pub usage_probe: UP,
    pub uninstaller: U,
    pub journal: J,
    pub terminal_launcher: TL,
    pub shell_probe: SP,
}

impl<E, ER, IP, IC, TM, UP, U, J, TL, SP> WhichcraftCore<PortBundle<E, ER, IP, IC, TM, UP, U, J, TL, SP>>
where
    E: EnvBackend,
    ER: EnvironmentResolver,
    IP: InstallationProbe,
    IC: InstallerCatalog,
    TM: ToolManager,
    UP: UsageProbe,
    U: Uninstaller,
    J: Journal,
    TL: TerminalLauncher,
    SP: ShellProbe,
{
    pub fn new(ports: PortBundle<E, ER, IP, IC, TM, UP, U, J, TL, SP>) -> Self {
        Self { ports }
    }
}
