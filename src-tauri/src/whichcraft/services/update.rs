//! Updating within a version line (ticket 16): install the newer version next to the old one,
//! switch to it with the usual plan, then offer to uninstall the old one. Nothing is overwritten
//! in place (P-1).

use std::path::PathBuf;

use serde::Serialize;

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::ports::tool_manager::RemoteVersion;
use crate::whichcraft::services::tool_apply::create_tool_plan;
use crate::whichcraft::services::tool_inventory::ToolInstallationView;
use crate::whichcraft::services::tool_plan::ToolApplyPlan;
use crate::whichcraft::tools::probe_tool_root;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCandidate {
    pub root: PathBuf,
    pub current: String,
    /// The version to pass to install, as the remote list spells it.
    pub latest: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    pub installation: ToolInstallation,
    pub plan: ToolApplyPlan,
}

/// How many leading numbers make a line: Temurin 21 and Node 22 by major, Python 3.14, Go 1.27
/// and Flutter 3.32 by major.minor.
fn line_len(tool: ToolKind) -> usize {
    match tool {
        ToolKind::Java | ToolKind::Node => 1,
        _ => 2,
    }
}

/// The numbers of a release, or `None` for pre-releases and variants (`3.15.0a1`, `1.27rc1`,
/// `3.35.0-beta`, `3.14.6t`). Build metadata after `+` is ignored.
fn release_numbers(tool: ToolKind, version: &str) -> Option<Vec<u64>> {
    let base = version.split('+').next()?;
    let base = if tool == ToolKind::Flutter { base.strip_suffix("-stable").unwrap_or(base) } else { base };
    let base = base.strip_prefix('v').unwrap_or(base);
    base.split('.').map(|p| p.parse().ok()).collect()
}

/// The newest release in the same line as `installed` that is newer than it.
pub fn newest_in_line(tool: ToolKind, installed: &str, remote: &[RemoteVersion]) -> Option<String> {
    let current = release_numbers(tool, installed)?;
    let n = line_len(tool);
    if current.len() < n {
        return None;
    }
    remote
        .iter()
        .filter_map(|r| Some((release_numbers(tool, &r.version)?, &r.version)))
        .filter(|(nums, _)| nums.len() >= n && nums[..n] == current[..n] && *nums > current)
        .max_by(|a, b| a.0.cmp(&b.0))
        .map(|(_, v)| v.clone())
}

/// Installations with a newer release in their line that is not installed yet.
pub fn update_candidates(tool: ToolKind, views: &[ToolInstallationView], remote: &[RemoteVersion]) -> Vec<UpdateCandidate> {
    let installed: Vec<Vec<u64>> = views
        .iter()
        .filter_map(|v| release_numbers(tool, &v.installation.version))
        .collect();
    views
        .iter()
        .filter(|v| v.available && tool != ToolKind::Git)
        .filter_map(|v| {
            let latest = newest_in_line(tool, &v.installation.version, remote)?;
            let nums = release_numbers(tool, &latest)?;
            // Already installed next to it: switching is enough, nothing to download.
            if installed.iter().any(|i| i.len() >= nums.len() && i[..nums.len()] == nums[..]) {
                return None;
            }
            Some(UpdateCandidate { root: v.installation.root.clone(), current: v.installation.version.clone(), latest })
        })
        .collect()
}

/// Installs `version` with `install` and plans the switch to it. The plan is shown and applied
/// like any other; the old installation is left alone.
pub fn install_and_plan<B: EnvBackend>(
    backend: &B,
    tool: ToolKind,
    version: &str,
    install: impl FnOnce(ToolKind, &str) -> Result<PathBuf, EnvarlyError>,
) -> Result<UpdateResult, EnvarlyError> {
    let root = install(tool, version)?;
    let installation = probe_tool_root(tool, &root, true).ok_or_else(|| {
        EnvarlyError::InvalidInput(format!("the new installation at {} was not recognised", root.display()))
    })?;
    let plan = create_tool_plan(backend, &installation)?;
    Ok(UpdateResult { installation, plan })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    use crate::whichcraft::ports::installer_catalog::InstallerKind;

    fn remote(versions: &[&str]) -> Vec<RemoteVersion> {
        versions
            .iter()
            .map(|v| RemoteVersion { version: (*v).into(), download_bytes: None, install_bytes: None })
            .collect()
    }

    fn view(tool: ToolKind, version: &str, root: &str) -> ToolInstallationView {
        ToolInstallationView {
            installation: ToolInstallation { tool, vendor: "x".into(), version: version.into(), root: root.into(), managed: false },
            effective: false,
            selected: false,
            available: true,
            installer_kind: InstallerKind::FolderOnly,
            mismatch_reason: None,
        }
    }

    #[test]
    fn temurin_updates_within_its_major() {
        let r = remote(&["17.0.21+7", "21.0.12+101.0.LTS", "21.0.13+11", "25.0.1+8"]);
        assert_eq!(newest_in_line(ToolKind::Java, "21.0.12", &r).as_deref(), Some("21.0.13+11"));
        assert_eq!(newest_in_line(ToolKind::Java, "17.0.20.1", &r).as_deref(), Some("17.0.21+7"));
        assert_eq!(newest_in_line(ToolKind::Java, "25.0.1", &r), None);
    }

    #[test]
    fn python_and_go_lines_are_major_minor_and_skip_pre_releases() {
        let py = remote(&["3.13.9", "3.14.6", "3.14.7", "3.14.8t", "3.15.0a1"]);
        assert_eq!(newest_in_line(ToolKind::Python, "3.14.6", &py).as_deref(), Some("3.14.7"));
        let go = remote(&["1.26.9", "1.27.0", "1.27.1", "1.28rc1"]);
        assert_eq!(newest_in_line(ToolKind::Go, "1.27.0", &go).as_deref(), Some("1.27.1"));
    }

    #[test]
    fn flutter_takes_only_stable_releases() {
        let r = remote(&["3.32.4-stable", "3.32.5-beta", "3.32.6-stable", "3.35.0-stable"]);
        assert_eq!(newest_in_line(ToolKind::Flutter, "3.32.4", &r).as_deref(), Some("3.32.6-stable"));
    }

    #[test]
    fn a_newer_version_already_installed_is_not_offered() {
        let views = vec![view(ToolKind::Node, "22.13.0", "C:\\n22a"), view(ToolKind::Node, "22.23.4", "C:\\n22b")];
        let r = remote(&["22.13.0", "22.23.4", "24.1.0"]);
        assert_eq!(update_candidates(ToolKind::Node, &views, &r), vec![]);
        let r = remote(&["22.13.0", "22.23.4", "22.24.0"]);
        let c = update_candidates(ToolKind::Node, &views, &r);
        assert_eq!(c.len(), 2);
        assert!(c.iter().all(|c| c.latest == "22.24.0"));
    }

    #[test]
    fn update_installs_beside_the_old_one_and_plans_the_switch() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let old = dir.path().join("node-22.13.0");
        std::fs::create_dir_all(&old).unwrap();
        std::fs::write(old.join("node.exe"), b"").unwrap();
        let backend = MemBackend::new().with_user([("Path", "C:\\old-node")]);

        let new_root = dir.path().join("store").join("node").join("22.24.0");
        let result = install_and_plan(&backend, ToolKind::Node, "22.24.0", |tool, version| {
            assert_eq!((tool, version), (ToolKind::Node, "22.24.0"));
            std::fs::create_dir_all(&new_root).unwrap();
            std::fs::write(new_root.join("node.exe"), b"").unwrap();
            Ok(new_root.clone())
        })
        .unwrap();

        assert_eq!(result.installation.root, new_root);
        assert!(result.installation.managed);
        assert!(old.join("node.exe").exists(), "the old installation is not touched");
        let path = &result.plan.user_diffs.iter().find(|d| d.name.eq_ignore_ascii_case("Path")).unwrap().after;
        assert!(path.starts_with(&*new_root.to_string_lossy()), "{path}");
    }

    #[test]
    fn a_failed_install_plans_nothing() {
        let backend = MemBackend::new();
        let err = install_and_plan(&backend, ToolKind::Go, "1.27.1", |_, _| Err(EnvarlyError::InvalidInput("offline".into())));
        assert!(err.is_err());
    }
}
