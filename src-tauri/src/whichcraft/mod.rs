//! Whichcraft domain core — Windows-free; uses injected ports.

mod api;
// The port bundle, fakes and Windows adapters below are scaffolding for tickets 05-15
// (journal recovery, terminal, usage probe, uninstall). Drop these allows as each gets wired in.
#[allow(dead_code)]
mod core;
#[allow(dead_code)]
pub mod fake;
pub mod java;
pub mod mise;
pub mod tools;
pub mod persistence;
#[allow(dead_code)]
pub mod ports;
pub mod services;

#[cfg(windows)]
#[allow(dead_code)]
pub mod adapters;

pub use api::{CoreHealth, ToolKind};
pub use core::WhichcraftCore;

#[cfg(test)]
mod tests;
