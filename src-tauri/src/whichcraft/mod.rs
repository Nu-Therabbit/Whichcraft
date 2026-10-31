//! Whichcraft: discovering, switching, installing and removing developer tools.

pub mod application;
pub mod domain;
#[cfg(test)]
pub mod fake;
pub mod java;
pub mod mise;
pub mod persistence;
pub mod ports;
pub mod tools;

#[cfg(windows)]
pub mod adapters;
#[cfg(windows)]
pub mod compose;

pub use domain::ToolKind;
