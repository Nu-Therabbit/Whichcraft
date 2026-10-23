//! In-memory stand-ins for ports, for core tests.

mod store;
mod uninstaller;
mod usage_probe;

pub use store::MemStore;
pub use uninstaller::FakeUninstaller;
pub use usage_probe::FakeUsageProbe;
