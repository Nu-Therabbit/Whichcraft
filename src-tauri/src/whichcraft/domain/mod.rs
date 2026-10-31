//! Whichcraft's domain: types and rules with no I/O. Everything else depends on this module;
//! it depends on nothing in Whichcraft but itself (ADR-0005).

pub mod env;
pub mod installation;
pub mod journal;
pub mod path;
pub mod plan;
pub mod profiles;
pub mod selection;
pub mod settings;
pub mod store_layout;
pub mod tool;
pub mod uninstall;
pub mod versions;

pub use installation::{InstallerKind, ToolInstallation, ToolInstallationView};
pub use plan::{PlanVariableDiff, ToolApplyPlan};
pub use tool::ToolKind;

#[cfg(test)]
mod tests {
    /// The domain stays free of I/O and of the layers around it; only Envarly's value types
    /// (`model`, `error`) are allowed in from outside (ADR-0005).
    #[test]
    fn the_domain_depends_on_nothing_outside_it() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/whichcraft/domain");
        let forbidden = [
            "whichcraft::services",
            "whichcraft::ports",
            "whichcraft::adapters",
            "whichcraft::persistence",
            "whichcraft::mise",
            "whichcraft::tools",
            "crate::commands",
            "crate::env_store",
            "std::fs",
            "std::process",
            "std::env",
            "reqwest",
            "winreg",
            "windows_sys",
        ];
        for entry in std::fs::read_dir(&dir).unwrap().flatten() {
            let text = std::fs::read_to_string(entry.path()).unwrap();
            let code = text.split("#[cfg(test)]").next().unwrap();
            for word in forbidden {
                assert!(
                    !code.contains(word),
                    "{} uses {word}",
                    entry.path().display()
                );
            }
        }
    }
}
