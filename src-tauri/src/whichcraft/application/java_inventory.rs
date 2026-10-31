//! Where JDKs are found beyond PATH: JAVA_HOME and the folders JDK installers use by default.

use std::collections::HashMap;
use std::path::PathBuf;

use crate::whichcraft::ports::machine::Machine;

/// JDK roots named by JAVA_HOME, by `java.exe` folders on PATH, and (optionally) in the folders
/// JDK installers use by default.
pub(crate) fn discover_java_roots(
    machine: &dyn Machine,
    user_path: &str,
    system_path: &str,
    user_vars: &HashMap<String, crate::model::EnvValue>,
    system_vars: &HashMap<String, crate::model::EnvValue>,
    include_standard_locations: bool,
) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let expand = crate::whichcraft::application::registry_expander(user_vars, system_vars, machine);
    for vars in [user_vars, system_vars] {
        if let Some(home) = crate::whichcraft::domain::env::get_var(vars, "JAVA_HOME") {
            roots.push(PathBuf::from(expand(&home.value)));
        }
    }
    for segment in system_path
        .split(';')
        .chain(user_path.split(';'))
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let expanded = expand(segment);
        let path = PathBuf::from(&expanded);
        if machine.is_file(&path.join("java.exe")) {
            if let Some(root) = path.parent() {
                roots.push(root.to_path_buf());
            }
        }
    }
    if include_standard_locations {
        for base in standard_java_dirs(machine) {
            roots.extend(machine.entries(&base));
        }
    }
    roots
}

fn standard_java_dirs(machine: &dyn Machine) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(prog) = machine.env_var("ProgramFiles") {
        let base = PathBuf::from(&prog);
        dirs.push(base.join("Eclipse Adoptium"));
        dirs.push(base.join("Java"));
    }
    if let Some(prog86) = machine.env_var("ProgramFiles(x86)") {
        dirs.push(PathBuf::from(prog86).join("Java"));
    }
    // Per-user Temurin MSI installs land here (21.0.11 on the survey machine).
    if let Some(local) = machine.env_var("LOCALAPPDATA") {
        dirs.push(
            PathBuf::from(local)
                .join("Programs")
                .join("Eclipse Adoptium"),
        );
    }
    dirs
}
