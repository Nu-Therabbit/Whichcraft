pub mod installer_catalog;
pub mod terminal_launcher;

pub use installer_catalog::{
    catalog_for_root, installer_kind_for_root, WinInstallerCatalog,
};
pub use terminal_launcher::WinTerminalLauncher;
