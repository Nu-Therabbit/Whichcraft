use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::commands::path::{dir_exists, expand_env_vars};
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
    let effective = path_manage::check_command_with(
        cmd,
        user_path,
        system_path,
        pathext,
        expand_env_vars,
        dir_exists,
    );
    let effective_root = effective
        .hits
        .first()
        .and_then(|hit| infer_root_from_command_dir(tool, Path::new(&hit.directory)));

    let mut roots: HashSet<PathBuf> = HashSet::new();
    for dir in path_dirs(user_path).chain(path_dirs(system_path)) {
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
        let _ = options;
    }

    for scan in &settings.scan_roots {
        if scan.is_dir() {
            walk_scan_root(tool, scan, 4, &mut roots);
        }
    }

    if options.include_standard_locations {
        append_standard_roots(tool, &mut roots);
    }

    append_managed_roots(tool, &settings.install_store, &mut roots);

    let mut by_root: HashMap<PathBuf, ToolInstallation> = HashMap::new();
    for root in roots {
        let managed = root.starts_with(&settings.install_store);
        if let Some(inst) = probe_tool_root(tool, &root, managed) {
            by_root.entry(inst.root.clone()).or_insert(inst);
        }
    }

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
            let installer_kind = installer_kind_for(&installation.root);
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

fn installer_kind_for(root: &Path) -> InstallerKind {
    #[cfg(windows)]
    {
        crate::whichcraft::adapters::win::installer_kind_for_root(root)
            .unwrap_or(InstallerKind::FolderOnly)
    }
    #[cfg(not(windows))]
    {
        let _ = root;
        InstallerKind::FolderOnly
    }
}

fn path_dirs(path: &str) -> impl Iterator<Item = PathBuf> + '_ {
    path.split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
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
    let pf86 = std::env::var("ProgramFiles(x86)").ok().map(PathBuf::from);
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
            if let Some(p) = local {
                out.insert(p.join("Programs").join("Python"));
            }
        }
        _ => {}
    }
    let _ = pf86;
}

fn append_managed_roots(tool: ToolKind, store: &Path, out: &mut HashSet<PathBuf>) {
    let tool_dir = store.join(tool_slug(tool));
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

fn tool_slug(tool: ToolKind) -> &'static str {
    match tool {
        ToolKind::Java => "java",
        ToolKind::Node => "node",
        ToolKind::Python => "python",
        ToolKind::Go => "go",
        ToolKind::Flutter => "flutter",
        ToolKind::Git => "git",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;

    fn leak(s: &str) -> &'static str {
        Box::leak(s.to_string().into_boxed_str())
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
}
