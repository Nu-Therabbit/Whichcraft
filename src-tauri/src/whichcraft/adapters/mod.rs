//! Windows adapter implementations and opt-in contract tests.

pub mod operation_ids;

#[cfg(windows)]
pub mod local;
#[cfg(windows)]
pub mod win;

#[cfg(all(windows, test))]
mod contract;
