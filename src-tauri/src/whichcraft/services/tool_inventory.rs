use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::commands::path::dir_exists;
use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::path_manage;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::persistence::load_settings;
use crate::whichcraft::ports::installer_catalog::InstallerKind;
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::tools::{
    command_name, command_search_dirs, infer_root_from_command_dir, paths_equal, probe_tool_root,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolInstallationView {
    #[serde(flatten)]
    pub installation: ToolInstallation,
    pub effective: bool,
    pub selected: bool,
    pub available: bool,
    pub installer_kind: InstallerKind,
    pub mismatch_reason: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub struct ToolDiscoveryOptions {
    pub include_standard_locations: bool,
}

impl Default for ToolDiscoveryOptions {
    fn default() -> Self {
        Self {
            include_standard_locations: true,
        }
    }
}

pub fn list_tool_installations<B: EnvBackend>(
    backend: &B,
    tool: ToolKind,
    selected_root: Option<&Path>,
) -> Result<Vec<ToolInstallationView>, EnvarlyError> {
    list_tool_installations_with_options(backend, tool, selected_root, ToolDiscoveryOptions::default())
}

pub fn list_tool_installations_with_options<B: EnvBackend>(
    backend: &B,
    tool: ToolKind,
    selected_root: Option<&Path>,
    options: ToolDiscoveryOptions,
) -> Result<Vec<ToolInstallationView>, EnvarlyError> {
    let settings = load_settings()?;
    let user = backend.read_user()?;
    let system = backend.read_system()?;
    let user_path = user.get("Path").map(|v| v.value.as_str()).unwrap_or("");
    let system_path = system.get("Path").map(|v| v.value.as_str()).unwrap_or("");
    let pathext = user
        .get("PATHEXT")
        .or_else(|| system.get("PATHEXT"))
        .map(|v| v.value.as_str())
        .unwrap_or("");

    let cmd = command_name(tool);
    let expand = crate::whichcraft::services::registry_expander(&user, &system);
    let effective = path_manage::check_command_with(
        cmd,
        user_path,
        system_path,
        pathext,
        &expand,
        dir_exists,
    );
    let effective_root = effective
        .hits
        .first()
        .and_then(|hit| infer_root_from_command_dir(tool, Path::new(&hit.directory)));

    let mut roots: HashSet<PathBuf> = HashSet::new();
    for dir in path_dirs(user_path, &expand).chain(path_dirs(system_path, &expand)) {
        for sub in command_search_dirs(tool) {
            let candidate = if *sub == "." {
                dir.clone()
            } else {
                dir.join(sub)
            };
            if let Some(root) = infer_root_from_command_dir(tool, &candidate) {
                roots.insert(root);
            }
        }
    }

    if tool == ToolKind::Java {
        roots.extend(crate::whichcraft::services::java_inventory::discover_java_roots(
            user_path,
            system_path,
            &user,
            &system,
            options.include_standard_locations,
        ));
    }

    for scan in &settings.scan_roots {
        if scan.is_dir() {
            walk_scan_root(tool, scan, 4, &mut roots);
        }
    }

    if options.include_standard_locations {
        append_standard_roots(tool, &mut roots);
    }

    let stores = settings.all_install_stores();
    for store in &stores {
        append_managed_roots(tool, store, &mut roots);
    }

    let mut by_root: HashMap<PathBuf, ToolInstallation> = HashMap::new();
    for root in roots {
        let managed = stores.iter().any(|s| root.starts_with(s));
        if let Some(inst) = probe_tool_root(tool, &root, managed) {
            by_root.entry(inst.root.clone()).or_insert(inst);
        }
    }

    // Read the uninstall entries once per listing, not once per installation.
    let installer_kind_for = installer_kinds();
    let mut views: Vec<ToolInstallationView> = by_root
        .into_values()
        .map(|installation| {
            let available = installation.root.is_dir()
                && probe_tool_root(tool, &installation.root, installation.managed)
                    .is_some();
            let effective_match = effective_root
                .as_ref()
                .is_some_and(|r| paths_equal(r, &installation.root));
            let selected =
                selected_root.is_some_and(|sel| paths_equal(sel, &installation.root));
            let installer_kind = if installation.managed {
                InstallerKind::ManagedByWhichcraft
            } else {
                installer_kind_for(&installation.root)
            };
            let mismatch_reason = if selected && !effective_match {
                Some(format!(
                    "system_path_may_shadow: effective {cmd} is not this installation"
                ))
            } else {
                None
            };
            ToolInstallationView {
                installation,
                effective: effective_match,
                selected,
                available,
                installer_kind,
                mismatch_reason,
            }
        })
        .collect();

    views.sort_by(|a, b| {
        a.installation
            .version
            .cmp(&b.installation.version)
            .then_with(|| a.installation.root.cmp(&b.installation.root))
    });
    Ok(views)
}

/// A lookup from installation root to how it was installed, backed by one catalog read.
/// Tests skip the registry and treat every external install as a plain folder.
pub(crate) fn installer_kinds() -> Box<dyn Fn(&Path) -> InstallerKind> {
    #[cfg(all(windows, not(test)))]
    if let Ok(catalog) = crate::whichcraft::adapters::win::installer_catalog::WinInstallerCatalog::load() {
        return Box::new(move |root| catalog.kind_for_root(root));
    }
    Box::new(|_| InstallerKind::FolderOnly)
}

/// Keeps a remembered selection visible after its folder disappeared, marked unavailable (D-5)
/// rather than silently dropped as if it had been uninstalled.
pub fn with_missing_selection(
    mut views: Vec<ToolInstallationView>,
    selection: Option<&crate::whichcraft::persistence::ToolSelection>,
) -> Vec<ToolInstallationView> {
    let Some(sel) = selection else {
        return views;
    };
    if views.iter().any(|v| paths_equal(&v.installation.root, &sel.root)) {
        return views;
    }
    views.push(ToolInstallationView {
        installation: ToolInstallation {
            tool: sel.tool,
            vendor: sel.vendor.clone(),
            version: sel.version.clone(),
            root: sel.root.clone(),
            managed: false,
        },
        effective: false,
        selected: true,
        available: false,
        installer_kind: InstallerKind::FolderOnly,
        mismatch_reason: Some("unavailable: the selected installation's folder is missing".into()),
    });
    views
}

/// PATH entries as folders: variables expanded, trailing separators dropped (`nodejs\` = `nodejs`).
fn path_dirs<'a>(path: &'a str, expand: &'a dyn Fn(&str) -> String) -> impl Iterator<Item = PathBuf> + 'a {
    path.split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(move |s| PathBuf::from(expand(s).trim_end_matches(['\\', '/'])))
}

fn walk_scan_root(tool: ToolKind, dir: &Path, depth: u8, out: &mut HashSet<PathBuf>) {
    if depth == 0 {
        return;
    }
    if let Some(inst) = probe_tool_root(tool, dir, false) {
        out.insert(inst.root);
        return;
    }
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in read.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_scan_root(tool, &path, depth - 1, out);
        }
    }
}

fn append_standard_roots(tool: ToolKind, out: &mut HashSet<PathBuf>) {
    let pf = std::env::var("ProgramFiles").ok().map(PathBuf::from);
    let local = std::env::var("LOCALAPPDATA").ok().map(PathBuf::from);
    match tool {
        ToolKind::Node => {
            if let Some(p) = pf {
                out.insert(p.join("nodejs"));
            }
        }
        ToolKind::Go => {
            if let Some(p) = pf {
                out.insert(p.join("Go"));
            }
        }
        ToolKind::Git => {
            if let Some(p) = pf {
                out.insert(p.join("Git"));
            }
        }
        ToolKind::Python => {
            if let Some(local) = local {
                // python.org installers: %LOCALAPPDATA%\Programs\Python\Python313 and siblings.
                if let Ok(read) = std::fs::read_dir(local.join("Programs").join("Python")) {
                    out.extend(read.flatten().map(|e| e.path()));
                }
                out.extend(crate::whichcraft::tools::python_manager_roots(&local));
            }
        }
        _ => {}
    }
}

/// Version folders mise installed in `store`. Its alias junctions (`latest`, `22`, …) are
/// left to `probe_tool_root`, which rejects reparse points.
fn append_managed_roots(tool: ToolKind, store: &Path, out: &mut HashSet<PathBuf>) {
    let Some(tool_dir) = crate::whichcraft::mise::manager::mise_installs_dir(store, tool) else {
        return;
    };
    if !tool_dir.is_dir() {
        return;
    }
    let Ok(read) = std::fs::read_dir(&tool_dir) else {
        return;
    };
    for entry in read.flatten() {
        let path = entry.path();
        if path.is_dir() {
            out.insert(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;

    fn leak(s: &str) -> &'static str {
        Box::leak(s.to_string().into_boxed_str())
    }

    fn fake_jdk(dir: &Path, name: &str, version: &str) -> PathBuf {
        let jdk = dir.join(name);
        std::fs::create_dir_all(jdk.join("bin")).unwrap();
        std::fs::write(jdk.join("release"), format!("IMPLEMENTOR=\"Eclipse Adoptium\"\nJAVA_VERSION=\"{version}\"\n")).unwrap();
        std::fs::write(jdk.join("bin").join("java.exe"), b"").unwrap();
        jdk
    }

    fn java_views(backend: &MemBackend, selected: Option<&Path>) -> Vec<ToolInstallationView> {
        list_tool_installations_with_options(backend, ToolKind::Java, selected, ToolDiscoveryOptions { include_standard_locations: false })
            .unwrap()
    }

    #[test]
    fn a_jdk_on_path_is_listed_with_its_release_version_and_effective() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let jdk = fake_jdk(dir.path(), "jdk-21", "21.0.1");
        let backend = MemBackend::new().with_user([("Path", leak(&jdk.join("bin").to_string_lossy()))]);
        let views = java_views(&backend, None);
        assert_eq!(views.len(), 1);
        assert!(views[0].effective);
        assert_eq!(views[0].installation.version, "21.0.1");
    }

    #[test]
    fn system_path_wins_over_user_for_the_effective_jdk() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let user_jdk = fake_jdk(dir.path(), "user", "22.0.0");
        let sys_jdk = fake_jdk(dir.path(), "system", "21.0.0");
        let backend = MemBackend::new()
            .with_user([("Path", leak(&user_jdk.join("bin").to_string_lossy()))])
            .with_system([("Path", leak(&sys_jdk.join("bin").to_string_lossy()))]);
        let views = java_views(&backend, Some(&user_jdk));
        assert_eq!(views.iter().find(|v| v.effective).unwrap().installation.version, "21.0.0");
        let user_view = views.iter().find(|v| v.installation.root == user_jdk).unwrap();
        assert!(!user_view.effective && user_view.selected);
        assert!(user_view.mismatch_reason.is_some(), "the selection is shadowed");
    }

    #[test]
    fn lists_node_from_user_path() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let node_root = dir.path().join("nodejs");
        std::fs::create_dir_all(&node_root).unwrap();
        std::fs::write(node_root.join("node.exe"), b"").unwrap();

        let path_val = leak(&node_root.to_string_lossy());
        let backend = MemBackend::new().with_user([(leak("Path"), path_val)]);
        let views = list_tool_installations_with_options(
            &backend,
            ToolKind::Node,
            None,
            ToolDiscoveryOptions {
                include_standard_locations: false,
            },
        )
        .unwrap();
        assert_eq!(views.len(), 1);
        assert!(views[0].available);
    }

    /// A Node version laid out the way mise installs it inside an install store.
    fn mise_node(store: &Path, version: &str) -> PathBuf {
        let root = store.join("_mise").join("data").join("installs").join("node").join(version);
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("node.exe"), b"").unwrap();
        root
    }

    #[test]
    fn managed_installs_in_current_and_earlier_stores_are_listed() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let store_a = dir.path().join("store-a");
        let store_b = dir.path().join("store-b");
        let in_a = mise_node(&store_a, "22.23.4");

        let mut settings = crate::whichcraft::persistence::load_settings().unwrap();
        settings.install_store = store_a.clone();
        settings.switch_install_store(store_b.clone());
        crate::whichcraft::persistence::save_settings(&settings).unwrap();
        let in_b = mise_node(&store_b, "24.11.0");

        let views = list_tool_installations_with_options(
            &MemBackend::new(),
            ToolKind::Node,
            None,
            ToolDiscoveryOptions { include_standard_locations: false },
        )
        .unwrap();
        let roots: Vec<&PathBuf> = views.iter().map(|v| &v.installation.root).collect();
        assert!(roots.contains(&&in_a) && roots.contains(&&in_b));
        assert!(views.iter().all(|v| v.installation.managed));
    }

    /// Reads the real registry and disk (no writes) and prints what the survey machine has.
    /// Run with `cargo test contract_discovers -- --ignored --nocapture`.
    #[test]
    #[cfg(windows)]
    #[ignore = "contract: reads this machine's real environment"]
    fn contract_discovers_the_survey_machine_tools() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        // D-6: Flutter at E:\Dev\flutter is only found once E:\Dev is a scan folder.
        let mut settings = crate::whichcraft::persistence::load_settings().unwrap();
        settings.scan_roots = vec![PathBuf::from("E:\\Dev")];
        crate::whichcraft::persistence::save_settings(&settings).unwrap();
        let backend = crate::env_backend::WinregBackend;
        for tool in [ToolKind::Java, ToolKind::Node, ToolKind::Python, ToolKind::Go, ToolKind::Flutter, ToolKind::Git] {
            for v in list_tool_installations(&backend, tool, None).unwrap() {
                println!(
                    "{tool:?}\t{} {}\teffective={}\t{:?}\t{}",
                    v.installation.vendor,
                    v.installation.version,
                    v.effective,
                    v.installer_kind,
                    v.installation.root.display()
                );
            }
        }
        let temurin = list_tool_installations(&backend, ToolKind::Java, None)
            .unwrap()
            .into_iter()
            .filter(|v| v.installation.vendor == "Eclipse Adoptium")
            .count();
        assert!(temurin >= 4, "expected the 4 Temurin JDKs from the survey, found {temurin}");
    }

    #[test]
    fn java_home_alone_is_enough_to_find_a_jdk() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let jdk = dir.path().join("jdk-21");
        std::fs::create_dir_all(jdk.join("bin")).unwrap();
        std::fs::write(jdk.join("bin").join("java.exe"), b"").unwrap();
        std::fs::write(jdk.join("release"), "IMPLEMENTOR=\"Eclipse Adoptium\"\nJAVA_VERSION=\"21.0.12\"\n").unwrap();
        let backend = MemBackend::new().with_system([(leak("JAVA_HOME"), leak(&jdk.to_string_lossy()))]);

        let views = list_tool_installations_with_options(
            &backend,
            ToolKind::Java,
            None,
            ToolDiscoveryOptions { include_standard_locations: false },
        )
        .unwrap();
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].installation.vendor, "Eclipse Adoptium");
        assert_eq!(views[0].installation.version, "21.0.12");
    }

    #[test]
    fn a_selected_installation_whose_folder_vanished_is_listed_as_unavailable() {
        let selection = crate::whichcraft::persistence::ToolSelection {
            tool: ToolKind::Node,
            root: "C:\\gone\\node20".into(),
            vendor: "Node.js".into(),
            version: "20.19.0".into(),
        };
        let views = with_missing_selection(Vec::new(), Some(&selection));
        assert_eq!(views.len(), 1);
        assert!(!views[0].available && views[0].selected);
        assert_eq!(views[0].installation.version, "20.19.0");
        // Still present on disk: listed once, as found.
        let again = with_missing_selection(views.clone(), Some(&selection));
        assert_eq!(again.len(), 1);
    }

    #[test]
    fn managed_installs_are_labelled_as_whichcraft_managed() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let store = dir.path().join("store");
        mise_node(&store, "22.23.4");
        let mut settings = crate::whichcraft::persistence::load_settings().unwrap();
        settings.install_store = store;
        crate::whichcraft::persistence::save_settings(&settings).unwrap();

        let views = list_tool_installations_with_options(
            &MemBackend::new(),
            ToolKind::Node,
            None,
            ToolDiscoveryOptions { include_standard_locations: false },
        )
        .unwrap();
        assert_eq!(views[0].installer_kind, InstallerKind::ManagedByWhichcraft);
    }

    #[test]
    fn switching_back_and_forth_keeps_each_store_once() {
        let mut settings = crate::whichcraft::persistence::WhichcraftSettings {
            install_store: "C:\\a".into(),
            ..Default::default()
        };
        settings.switch_install_store("C:\\b".into());
        settings.switch_install_store("C:\\a".into());
        assert_eq!(settings.install_store, PathBuf::from("C:\\a"));
        assert_eq!(settings.all_install_stores(), vec![PathBuf::from("C:\\a"), PathBuf::from("C:\\b")]);
    }
}
