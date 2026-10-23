use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::commands::path::{dir_exists, expand_env_vars};
use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::path_manage::{self, FullPathStatus};
use crate::whichcraft::java::{probe_java_root, JavaInstallation};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstallationView {
    #[serde(flatten)]
    pub installation: JavaInstallation,
    pub effective: bool,
    pub selected: bool,
    pub mismatch_reason: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub struct JavaDiscoveryOptions {
    pub include_standard_locations: bool,
}

impl Default for JavaDiscoveryOptions {
    fn default() -> Self {
        Self {
            include_standard_locations: true,
        }
    }
}

pub fn list_java_installations<B: EnvBackend>(
    backend: &B,
    selected_root: Option<&Path>,
) -> Result<Vec<JavaInstallationView>, EnvarlyError> {
    list_java_installations_with_options(backend, selected_root, JavaDiscoveryOptions::default())
}

pub fn list_java_installations_with_options<B: EnvBackend>(
    backend: &B,
    selected_root: Option<&Path>,
    options: JavaDiscoveryOptions,
) -> Result<Vec<JavaInstallationView>, EnvarlyError> {
    let user = backend.read_user()?;
    let system = backend.read_system()?;
    let user_path = user.get("Path").map(|v| v.value.as_str()).unwrap_or("");
    let system_path = system
        .get("Path")
        .map(|v| v.value.as_str())
        .unwrap_or("");
    let pathext = user
        .get("PATHEXT")
        .or_else(|| system.get("PATHEXT"))
        .map(|v| v.value.as_str())
        .unwrap_or("");

    let effective = path_manage::check_command_with(
        "java",
        user_path,
        system_path,
        pathext,
        expand_env_vars,
        dir_exists,
    );
    let effective_root = effective
        .hits
        .first()
        .map(|hit| java_home_from_bin_dir(&hit.directory));

    let mut by_root: HashMap<PathBuf, JavaInstallation> = HashMap::new();
    for root in discover_java_roots(
        user_path,
        system_path,
        &user,
        &system,
        options.include_standard_locations,
    ) {
        if let Some(inst) = probe_java_root(&root, false) {
            by_root.entry(inst.root.clone()).or_insert(inst);
        }
    }

    let mut views: Vec<JavaInstallationView> = by_root
        .into_values()
        .map(|installation| {
            let effective_match = effective_root
                .as_ref()
                .is_some_and(|r| paths_equal(r, &installation.root));
            let selected = selected_root.is_some_and(|sel| paths_equal(sel, &installation.root));
            let mismatch_reason = if selected && !effective_match {
                shadow_reason_for_selection(
                    &installation,
                    user_path,
                    system_path,
                    pathext,
                )
            } else {
                None
            };
            JavaInstallationView {
                installation,
                effective: effective_match,
                selected,
                mismatch_reason,
            }
        })
        .collect();

    views.sort_by(|a, b| {
        a.installation
            .vendor
            .cmp(&b.installation.vendor)
            .then_with(|| a.installation.version.cmp(&b.installation.version))
            .then_with(|| a.installation.root.cmp(&b.installation.root))
    });
    Ok(views)
}

fn shadow_reason_for_selection(
    installation: &JavaInstallation,
    user_path: &str,
    system_path: &str,
    pathext: &str,
) -> Option<String> {
    let java_exe = installation
        .root
        .join("bin")
        .join("java.exe")
        .to_string_lossy()
        .into_owned();
    let check = path_manage::check_command_with(
        &java_exe,
        user_path,
        system_path,
        pathext,
        expand_env_vars,
        dir_exists,
    );
    match check.full_path_status {
        Some(FullPathStatus::Shadowed { shadowed_by }) => Some(format!(
            "shadowed_by_system_path:{}",
            shadowed_by.directory
        )),
        Some(FullPathStatus::NotOnEffectivePath) => Some("not_on_effective_path".into()),
        Some(FullPathStatus::Active) => None,
        None => Some("not_effective".into()),
    }
}

fn java_home_from_bin_dir(bin_dir: &str) -> PathBuf {
    PathBuf::from(bin_dir.trim_end_matches(['\\', '/']))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(bin_dir))
}

fn discover_java_roots(
    user_path: &str,
    system_path: &str,
    user_vars: &HashMap<String, crate::model::EnvValue>,
    system_vars: &HashMap<String, crate::model::EnvValue>,
    include_standard_locations: bool,
) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = user_vars
        .get("JAVA_HOME")
        .or_else(|| system_vars.get("JAVA_HOME"))
    {
        roots.push(PathBuf::from(expand_env_vars(&home.value)));
    }
    for segment in system_path
        .split(';')
        .chain(user_path.split(';'))
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let expanded = expand_env_vars(segment);
        let path = PathBuf::from(&expanded);
        if path.join("java.exe").is_file() {
            if let Some(root) = path.parent() {
                roots.push(root.to_path_buf());
            }
        }
    }
    if include_standard_locations {
        for base in standard_java_dirs() {
            if let Ok(read) = std::fs::read_dir(&base) {
                for entry in read.flatten() {
                    roots.push(entry.path());
                }
            }
        }
    }
    roots
}

fn standard_java_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(prog) = std::env::var_os("ProgramFiles") {
        let base = PathBuf::from(&prog);
        dirs.push(base.join("Eclipse Adoptium"));
        dirs.push(base.join("Java"));
    }
    if let Some(prog86) = std::env::var_os("ProgramFiles(x86)") {
        dirs.push(PathBuf::from(prog86).join("Java"));
    }
    dirs
}

#[cfg(test)]
fn leak_str(s: &str) -> &'static str {
    Box::leak(s.to_owned().into_boxed_str())
}

fn paths_equal(a: &Path, b: &Path) -> bool {
    a.canonicalize()
        .ok()
        .zip(b.canonicalize().ok())
        .is_some_and(|(x, y)| x == y)
        || a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    #[test]
    fn lists_probe_from_java_home_and_marks_effective() {
        let dir = tempfile::tempdir().unwrap();
        let jdk = dir.path().join("jdk-21");
        std::fs::create_dir_all(jdk.join("bin")).unwrap();
        std::fs::write(
            jdk.join("release"),
            "IMPLEMENTOR=\"Eclipse Adoptium\"\nJAVA_VERSION=\"21.0.1\"\n",
        )
        .unwrap();
        std::fs::write(jdk.join("bin").join("java.exe"), b"").unwrap();

        let bin = jdk.join("bin").to_string_lossy().into_owned();
        let backend = MemBackend::new().with_user([("Path", leak_str(&bin))]).with_system([]);

        let views = list_java_installations_with_options(
            &backend,
            None,
            JavaDiscoveryOptions {
                include_standard_locations: false,
            },
        )
        .expect("list");
        assert_eq!(views.len(), 1);
        assert!(views[0].effective);
        assert_eq!(views[0].installation.version, "21.0.1");
    }

    #[test]
    fn system_path_wins_over_user_for_effective() {
        let dir = tempfile::tempdir().unwrap();
        let user_jdk = dir.path().join("user");
        let sys_jdk = dir.path().join("system");
        for (jdk, ver) in [(&user_jdk, "22.0.0"), (&sys_jdk, "21.0.0")] {
            std::fs::create_dir_all(jdk.join("bin")).unwrap();
            std::fs::write(
                jdk.join("release"),
                format!("IMPLEMENTOR=\"V\"\nJAVA_VERSION=\"{ver}\"\n"),
            )
            .unwrap();
            std::fs::write(jdk.join("bin").join("java.exe"), b"").unwrap();
        }

        let user_bin = user_jdk.join("bin").to_string_lossy().into_owned();
        let sys_bin = sys_jdk.join("bin").to_string_lossy().into_owned();
        let backend = MemBackend::new()
            .with_user([("Path", leak_str(&user_bin))])
            .with_system([("Path", leak_str(&sys_bin))]);

        let views = list_java_installations_with_options(
            &backend,
            Some(&user_jdk),
            JavaDiscoveryOptions {
                include_standard_locations: false,
            },
        )
        .expect("list");
        let effective = views.iter().find(|v| v.effective).expect("effective");
        assert_eq!(effective.installation.version, "21.0.0");
        let user_view = views.iter().find(|v| v.installation.root == user_jdk).unwrap();
        assert!(!user_view.effective);
        assert!(user_view.selected);
        assert!(user_view.mismatch_reason.as_ref().is_some_and(|r| r.starts_with("shadowed_by_system_path")));
    }
}
