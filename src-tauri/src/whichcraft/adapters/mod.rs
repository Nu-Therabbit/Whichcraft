//! Windows adapter implementations and opt-in contract tests.

#[cfg(windows)]
pub mod local;
#[cfg(windows)]
pub mod win;

#[cfg(all(windows, test))]
mod contract;
