//! Whichcraft domain core — Windows-free; uses injected ports.

mod api;
mod core;
pub mod fake;
pub mod java;
pub mod mise;
pub mod tools;
pub mod persistence;
pub mod ports;
pub mod services;

#[cfg(windows)]
pub mod adapters;

pub use api::{CoreHealth, ToolKind};
pub use core::WhichcraftCore;

#[cfg(test)]
mod tests;
