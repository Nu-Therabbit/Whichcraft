//! Where JDKs are found beyond PATH: JAVA_HOME, the folders installed programs registered, and
//! the folders JDK installers and IDEs use by default.

use std::collections::HashMap;
use std::path::PathBuf;

use crate::whichcraft::ports::machine::Machine;

/// JDK roots named by JAVA_HOME, by `java.exe` folders on PATH, by installed programs (any
/// vendor's JDK installer, or an IDE's bundled runtime one level down), and (optionally) in the
/// folders JDK installers and IDEs use by default. Callers probe each one; most are not JDKs.
pub(crate) fn discover_java_roots(
    machine: &dyn Machine,
    user_path: &str,
    system_path: &str,
    user_vars: &HashMap<String, crate::model::EnvValue>,
    system_vars: &HashMap<String, crate::model::EnvValue>,
    install_roots: &[PathBuf],
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
    for location in install_roots {
        if machine.is_file(&location.join("release")) {
            roots.push(location.clone());
        } else if machine.is_dir(location) {
            roots.extend(machine.entries(location));
        }
    }
    if include_standard_locations {
        for base in standard_java_dirs(machine) {
            roots.extend(machine.entries(&base));
        }
        roots.extend(ide_runtime_dirs(machine));
    }
    roots
}

/// Folders whose subfolders are JDKs, for installers that registered no folder.
fn standard_java_dirs(machine: &dyn Machine) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(prog) = machine.env_var("ProgramFiles") {
        let base = PathBuf::from(&prog);
        for vendor in [
            "Eclipse Adoptium",
            "Java",
            "Microsoft",
            "Zulu",
            "Amazon Corretto",
            "BellSoft",
            "Semeru",
        ] {
            dirs.push(base.join(vendor));
        }
        dirs.push(base.join("SapMachine").join("JDK"));
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
    // JDKs IntelliJ IDEA and Android Studio download.
    if let Some(home) = machine.env_var("USERPROFILE") {
        dirs.push(PathBuf::from(home).join(".jdks"));
    }
    dirs
}

/// The runtime Android Studio ships, where its default installs put it.
fn ide_runtime_dirs(machine: &dyn Machine) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(local) = machine.env_var("LOCALAPPDATA") {
        dirs.push(
            PathBuf::from(local)
                .join("Programs")
                .join("Android Studio")
                .join("jbr"),
        );
    }
    if let Some(prog) = machine.env_var("ProgramFiles") {
        dirs.push(
            PathBuf::from(prog)
                .join("Android")
                .join("Android Studio")
                .join("jbr"),
        );
    }
    dirs
}
