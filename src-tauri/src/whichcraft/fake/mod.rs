//! In-memory stand-ins for ports, for core tests.

mod installer_catalog;
mod store;
mod uninstaller;
mod usage_probe;

pub use installer_catalog::FakeInstallerCatalog;
pub use store::MemStore;
pub use uninstaller::FakeUninstaller;
pub use usage_probe::FakeUsageProbe;
