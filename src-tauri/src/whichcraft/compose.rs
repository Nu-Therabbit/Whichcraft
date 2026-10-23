//! The composition root: the one place that knows which adapter implements each port.

use crate::env_backend::WinregBackend;
use crate::whichcraft::adapters::local::LocalMachine;
use crate::whichcraft::adapters::operation_ids::SystemOperationIds;
use crate::whichcraft::adapters::win::elevation::WinElevator;
use crate::whichcraft::adapters::win::installer_catalog::WinInstallerCatalogs;
use crate::whichcraft::adapters::win::process::WinProcessRunner;
use crate::whichcraft::adapters::win::sdk::WinSdkProbe;
use crate::whichcraft::adapters::win::uninstall::{WinUninstaller, WinUsageProbe};
use crate::whichcraft::application::app::App;
use crate::whichcraft::mise::manager::MiseToolManagers;
use crate::whichcraft::persistence::FileStore;

/// Whichcraft on this Windows machine. Every adapter is stateless, so building it is cheap.
pub fn windows_app() -> App<WinregBackend> {
    App {
        env: WinregBackend,
        store: Box::new(FileStore),
        machine: Box::new(LocalMachine),
        catalogs: Box::new(WinInstallerCatalogs),
        tools: Box::new(MiseToolManagers),
        elevator: Box::new(WinElevator),
        usage: Box::new(WinUsageProbe),
        uninstaller: Box::new(WinUninstaller),
        sdk: Box::new(WinSdkProbe),
        processes: Box::new(WinProcessRunner),
        ids: Box::new(SystemOperationIds),
    }
}
