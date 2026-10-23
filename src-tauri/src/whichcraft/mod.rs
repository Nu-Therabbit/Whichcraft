//! Whichcraft: discovering, switching, installing and removing developer tools.

pub mod domain;
#[cfg(test)]
pub mod fake;
pub mod java;
pub mod mise;
pub mod tools;
pub mod persistence;
pub mod ports;
pub mod services;

#[cfg(windows)]
pub mod adapters;

pub use domain::ToolKind;
