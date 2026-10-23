//! In-memory stand-ins for ports, for core tests.

mod host;
mod installer_catalog;
mod machine;
mod store;
mod tool_manager;
mod uninstaller;
mod usage_probe;

pub use host::{DeclinesUac, FakeProcessRunner, MachineUninstaller, NoSdks};
pub use installer_catalog::{FakeInstallerCatalog, NoInstallerEntries};
pub use machine::FakeMachine;
pub use store::MemStore;
pub use tool_manager::{FakeToolManagers, FakeTools};
pub use uninstaller::FakeUninstaller;
pub use usage_probe::FakeUsageProbe;
