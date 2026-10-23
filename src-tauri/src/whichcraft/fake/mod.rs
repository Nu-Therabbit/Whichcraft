//! In-memory stand-ins for ports, for core tests.

mod uninstaller;
mod usage_probe;

pub use uninstaller::FakeUninstaller;
pub use usage_probe::FakeUsageProbe;
