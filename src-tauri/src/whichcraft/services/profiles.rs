use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::env_store::{EnvBackend, MemBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvValue, VarScope};
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::persistence::{new_journal_id, whichcraft_data_dir};
use crate::whichcraft::ports::elevator::Elevator;
use crate::whichcraft::services::get_var;
use crate::whichcraft::services::tool_plan::PlanVariableDiff;
use crate::whichcraft::services::tool_apply::{
    apply_tool_plan, apply_tool_plan_elevated, create_tool_plan, ApplyToolResult,
};
use crate::whichcraft::services::tool_inventory::{list_tool_installations, ToolInstallationView};
use crate::whichcraft::services::tool_plan::ToolApplyPlan;
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::ports::tool_manager::RemoteVersion;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileToolPin {
    pub tool: ToolKind,
    pub vendor: String,
    pub version: String,
    pub preferred_root: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolProfile {
    pub id: String,
    pub name: String,
    pub tools: Vec<ProfileToolPin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileMatchStatus {
    pub profile: ToolProfile,
    pub matches_effective: bool,
    pub unavailable: Vec<ProfileToolPin>,
}

fn profiles_path() -> Result<PathBuf, EnvarlyError> {
    Ok(whichcraft_data_dir()?.join("profiles.json"))
}

pub fn load_profiles() -> Result<Vec<ToolProfile>, EnvarlyError> {
    let path = profiles_path()?;
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| EnvarlyError::Snapshot(format!("read profiles: {e}")))?;
    serde_json::from_str(&raw).map_err(|e| EnvarlyError::Snapshot(format!("parse profiles: {e}")))
}

pub fn save_profiles(profiles: &[ToolProfile]) -> Result<(), EnvarlyError> {
    let path = profiles_path()?;
    std::fs::write(
        &path,
        serde_json::to_string_pretty(profiles)
            .map_err(|e| EnvarlyError::Snapshot(format!("serialize profiles: {e}")))?,
    )
    .map_err(|e| EnvarlyError::Snapshot(format!("write profiles: {e}")))?;
    Ok(())
}

pub fn profile_status<B: EnvBackend>(
    backend: &B,
    profile: &ToolProfile,
) -> Result<ProfileMatchStatus, EnvarlyError> {
    profile_status_with(profile, |tool| list_tool_installations(backend, tool, None))
}

fn profile_status_with(
    profile: &ToolProfile,
    find: impl Fn(ToolKind) -> Result<Vec<ToolInstallationView>, EnvarlyError>,
) -> Result<ProfileMatchStatus, EnvarlyError> {
    let mut unavailable = Vec::new();
    let mut all_effective = true;
    for pin in &profile.tools {
        match resolve_pin(&find(pin.tool)?, pin) {
            Some(view) => all_effective &= view.effective,
            None => unavailable.push(pin.clone()),
        }
    }
    Ok(ProfileMatchStatus {
        profile: profile.clone(),
        matches_effective: all_effective && unavailable.is_empty(),
        unavailable,
    })
}

/// One plan for the whole profile, so every tool lands in a single apply, journal and UAC prompt.
pub fn plan_profile_apply<B: EnvBackend>(
    backend: &B,
    profile: &ToolProfile,
) -> Result<ToolApplyPlan, EnvarlyError> {
    plan_profile_apply_with(backend, profile, |tool| {
        list_tool_installations(backend, tool, None)
    })
}

fn plan_profile_apply_with<B: EnvBackend>(
    backend: &B,
    profile: &ToolProfile,
    find: impl Fn(ToolKind) -> Result<Vec<ToolInstallationView>, EnvarlyError>,
) -> Result<ToolApplyPlan, EnvarlyError> {
    // Check every tool first: if any is unavailable, nothing is planned or written.
    let mut chosen = Vec::new();
    let mut unavailable = Vec::new();
    for pin in &profile.tools {
        match resolve_pin(&find(pin.tool)?, pin) {
            Some(view) => chosen.push(view.installation),
            None => unavailable.push(format!("{:?} {} {}", pin.tool, pin.vendor, pin.version)),
        }
    }
    if !unavailable.is_empty() {
        return Err(EnvarlyError::InvalidInput(format!(
            "profile has unavailable installations: {}",
            unavailable.join(", ")
        )));
    }
    let Some((first, rest)) = chosen.split_first() else {
        return Err(EnvarlyError::InvalidInput("profile selects no tools".into()));
    };

    // Plan each tool against a scratch copy that already holds the earlier tools' changes.
    let baseline = crate::env_store::read_snapshot_with(backend)?;
    let scratch = MemBackend::new();
    *scratch.user.lock().unwrap() = baseline.user.clone();
    *scratch.system.lock().unwrap() = baseline.system.clone();

    let mut touched: Vec<PlanVariableDiff> = Vec::new();
    let mut warnings = Vec::new();
    let mut effective_after_user_only = true;
    for installation in &chosen {
        let step = create_tool_plan(&scratch, installation)?;
        warnings.extend(step.warnings);
        effective_after_user_only &= step.effective_after_user_only;
        for diff in step.user_diffs.into_iter().chain(step.system_diffs) {
            let value = EnvValue::typed(diff.after.clone(), diff.value_kind);
            match diff.scope {
                VarScope::System => scratch.system.lock().unwrap().insert(diff.name.clone(), value),
                _ => scratch.user.lock().unwrap().insert(diff.name.clone(), value),
            };
            match touched
                .iter_mut()
                .find(|t| t.scope == diff.scope && t.name.eq_ignore_ascii_case(&diff.name))
            {
                Some(existing) => {
                    existing.after = diff.after;
                    existing.value_kind = diff.value_kind;
                }
                None => touched.push(diff),
            }
        }
    }

    // Each variable's `before` is its value in the real environment, not in the scratch copy.
    let original = |scope: &VarScope, name: &str| -> Option<String> {
        let map: &HashMap<String, EnvValue> = match scope {
            VarScope::System => &baseline.system,
            _ => &baseline.user,
        };
        get_var(map, name).map(|v| v.value.clone())
    };
    let mut user_diffs = Vec::new();
    let mut system_diffs = Vec::new();
    for mut diff in touched {
        diff.before = original(&diff.scope, &diff.name);
        if diff.before.as_deref() == Some(diff.after.as_str()) {
            continue;
        }
        match diff.scope {
            VarScope::System => system_diffs.push(diff),
            _ => user_diffs.push(diff),
        }
    }

    Ok(ToolApplyPlan {
        plan_id: new_journal_id(),
        tool: first.tool,
        requires_uac: !system_diffs.is_empty(),
        warnings,
        limitation_notice:
            "Programs already running and IDEs with their own SDK settings will not pick up these changes until restarted."
                .into(),
        user_diffs,
        system_diffs,
        baseline,
        selected: first.clone(),
        additional_selections: rest.to_vec(),
        records_selection: true,
        effective_after_user_only,
    })
}

pub fn apply_profile<B: EnvBackend>(
    backend: &B,
    elevator: Option<&dyn Elevator>,
    profile: &ToolProfile,
) -> Result<ApplyToolResult, EnvarlyError> {
    let plan = plan_profile_apply(backend, profile)?;
    match elevator {
        Some(elevator) => apply_tool_plan_elevated(backend, elevator, &plan),
        None => apply_tool_plan(backend, &plan),
    }
}

/// A pin with no installation on this machine, and what Whichcraft could install for it (F-3).
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MissingPin {
    pub pin: ProfileToolPin,
    /// The version to install, as the remote list spells it; `None` when Whichcraft cannot.
    pub install_version: Option<String>,
    pub download_bytes: Option<u64>,
}

/// The remote release a pin means. Whichcraft installs Temurin only, so other Java vendors are
/// not installable; a four-part MSI version such as 17.0.20.1 matches the 17.0.20 release.
pub fn remote_for_pin(pin: &ProfileToolPin, remote: &[RemoteVersion]) -> Option<String> {
    use crate::whichcraft::services::update::release_numbers;
    if pin.tool == ToolKind::Git {
        return None;
    }
    if pin.tool == ToolKind::Java {
        let vendor = pin.vendor.to_ascii_lowercase();
        if !vendor.contains("adoptium") && !vendor.contains("temurin") {
            return None;
        }
    }
    let wanted = release_numbers(pin.tool, &pin.version)?;
    let numbered: Vec<(Vec<u64>, &String)> = remote
        .iter()
        .filter_map(|r| Some((release_numbers(pin.tool, &r.version)?, &r.version)))
        .collect();
    numbered
        .iter()
        .find(|(n, _)| *n == wanted)
        .or_else(|| numbered.iter().filter(|(n, _)| n.len() >= 3 && wanted.starts_with(n)).max_by(|a, b| a.0.cmp(&b.0)))
        .map(|(_, v)| (*v).clone())
}

/// Missing pins of a profile with what to install for each.
pub fn missing_pins(
    unavailable: &[ProfileToolPin],
    remote: impl Fn(ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError>,
    size: impl Fn(ToolKind, &str) -> Option<u64>,
) -> Result<Vec<MissingPin>, EnvarlyError> {
    unavailable
        .iter()
        .map(|pin| {
            let install_version = if pin.tool == ToolKind::Git { None } else { remote_for_pin(pin, &remote(pin.tool)?) };
            Ok(MissingPin {
                download_bytes: install_version.as_deref().and_then(|v| size(pin.tool, v)),
                pin: pin.clone(),
                install_version,
            })
        })
        .collect()
}

/// Whether a pin refers to this installation: same tool, vendor and full version, and either no
/// remembered root or that one.
pub fn pin_means(pin: &ProfileToolPin, inst: &ToolInstallation) -> bool {
    pin.tool == inst.tool
        && pin.vendor.eq_ignore_ascii_case(&inst.vendor)
        && pin.version == inst.version
        && pin.preferred_root.as_ref().is_none_or(|r| *r == inst.root)
}

/// Names of the profiles with a pin that means `inst` (F-5).
pub fn profiles_using(profiles: &[ToolProfile], inst: &ToolInstallation) -> Vec<String> {
    profiles
        .iter()
        .filter(|p| p.tools.iter().any(|pin| pin_means(pin, inst)))
        .map(|p| p.name.clone())
        .collect()
}

/// Points every pin that means `from` at `to` instead (F-5). Returns the names of the profiles
/// that changed.
pub fn repoint_profiles(profiles: &mut [ToolProfile], from: &ToolInstallation, to: &ToolInstallation) -> Vec<String> {
    let mut changed = Vec::new();
    for profile in profiles.iter_mut() {
        let mut touched = false;
        for pin in profile.tools.iter_mut() {
            if pin_means(pin, from) {
                *pin = ProfileToolPin {
                    tool: to.tool,
                    vendor: to.vendor.clone(),
                    version: to.version.clone(),
                    preferred_root: Some(to.root.clone()),
                };
                touched = true;
            }
        }
        if touched {
            changed.push(profile.name.clone());
        }
    }
    changed
}

/// Finds the installation a pin means: same vendor and full version, preferring the remembered
/// root when several match. Anything else counts as unavailable; there is no fallback.
fn resolve_pin(installs: &[ToolInstallationView], pin: &ProfileToolPin) -> Option<ToolInstallationView> {
    let matching: Vec<&ToolInstallationView> = installs
        .iter()
        .filter(|v| {
            v.available
                && v.installation.vendor.eq_ignore_ascii_case(&pin.vendor)
                && v.installation.version == pin.version
        })
        .collect();
    pin.preferred_root
        .as_ref()
        .and_then(|root| matching.iter().find(|v| &v.installation.root == root))
        .or_else(|| matching.first())
        .map(|v| (*v).clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::whichcraft::persistence::{load_last_completed_apply, load_tool_selection, use_test_data_dir};
    use crate::whichcraft::ports::installer_catalog::InstallerKind;
    use crate::whichcraft::services::tool_apply::test_support::FakeElevator;
    use crate::whichcraft::services::tool_apply::apply_tool_plan_elevated;

    fn leak(s: String) -> &'static str {
        Box::leak(s.into_boxed_str())
    }

    /// A fake installation on disk: `<dir>/<name>` with the tool's executable where PATH will look.
    fn install(dir: &std::path::Path, tool: ToolKind, name: &str, vendor: &str, version: &str) -> ToolInstallationView {
        let root = dir.join(name);
        let exe_dir = if tool == ToolKind::Java { root.join("bin") } else { root.clone() };
        std::fs::create_dir_all(&exe_dir).unwrap();
        let exe = if tool == ToolKind::Java { "java.exe" } else { "node.exe" };
        std::fs::write(exe_dir.join(exe), b"").unwrap();
        if tool == ToolKind::Java {
            std::fs::write(root.join("release"), format!("IMPLEMENTOR=\"{vendor}\"\nJAVA_VERSION=\"{version}\"\n")).unwrap();
        }
        ToolInstallationView {
            installation: ToolInstallation {
                tool,
                vendor: vendor.into(),
                version: version.into(),
                root,
                managed: false,
            },
            effective: false,
            selected: false,
            available: true,
            installer_kind: InstallerKind::FolderOnly,
            mismatch_reason: None,
        }
    }

    fn pin(tool: ToolKind, vendor: &str, version: &str, root: Option<PathBuf>) -> ProfileToolPin {
        ProfileToolPin { tool, vendor: vendor.into(), version: version.into(), preferred_root: root }
    }

    fn profile(tools: Vec<ProfileToolPin>) -> ToolProfile {
        ToolProfile { id: "p".into(), name: "Android work".into(), tools }
    }

    #[test]
    fn a_missing_version_is_unavailable_instead_of_another_one() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let node22 = install(dir.path(), ToolKind::Node, "node22", "Node.js", "22.23.4");
        let backend = MemBackend::new().with_user([("Path", "C:\\u")]);
        let p = profile(vec![pin(ToolKind::Node, "Node.js", "20.19.0", None)]);

        let found = vec![node22];
        assert!(plan_profile_apply_with(&backend, &p, |_| Ok(found.clone())).is_err());
        let status = profile_status_with(&p, |_| Ok(found.clone())).unwrap();
        assert_eq!(status.unavailable.len(), 1);
        assert!(!status.matches_effective);
        assert_eq!(backend.read_user().unwrap()["Path"].value, "C:\\u");
    }

    #[test]
    fn the_remembered_root_wins_among_identical_versions_and_others_stand_in() {
        let dir = tempfile::tempdir().unwrap();
        let external = install(dir.path(), ToolKind::Java, "external", "Eclipse Adoptium", "21.0.12");
        let managed = install(dir.path(), ToolKind::Java, "managed", "Eclipse Adoptium", "21.0.12");
        let both = vec![external.clone(), managed.clone()];

        let wants_managed = pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", Some(managed.installation.root.clone()));
        assert_eq!(resolve_pin(&both, &wants_managed).unwrap().installation.root, managed.installation.root);

        let only_external = vec![external.clone()];
        assert_eq!(resolve_pin(&only_external, &wants_managed).unwrap().installation.root, external.installation.root);
    }

    #[test]
    fn two_tools_that_both_touch_path_apply_together() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let jdk = install(dir.path(), ToolKind::Java, "jdk17", "Eclipse Adoptium", "17.0.20.1");
        let node = install(dir.path(), ToolKind::Node, "node20", "Node.js", "20.19.0");
        let backend = MemBackend::new()
            .with_user([("Path", "C:\\u")])
            .with_system([("PATHEXT", ".EXE;.CMD;.BAT")]);
        let p = profile(vec![
            pin(ToolKind::Java, "Eclipse Adoptium", "17.0.20.1", None),
            pin(ToolKind::Node, "Node.js", "20.19.0", None),
        ]);
        let find = |tool: ToolKind| Ok(if tool == ToolKind::Java { vec![jdk.clone()] } else { vec![node.clone()] });

        let plan = plan_profile_apply_with(&backend, &p, find).unwrap();
        let result = apply_tool_plan(&backend, &plan).unwrap();
        assert!(!result.stale);

        let user = backend.read_user().unwrap();
        let path = &user["Path"].value;
        assert!(path.contains(&*jdk.installation.root.join("bin").to_string_lossy()));
        assert!(path.contains(&*node.installation.root.to_string_lossy()));
        assert!(path.ends_with("C:\\u"));
        assert_eq!(user["JAVA_HOME"].value, jdk.installation.root.to_string_lossy());
        assert_eq!(load_tool_selection(ToolKind::Node).unwrap().unwrap().root, node.installation.root);
        assert_eq!(load_tool_selection(ToolKind::Java).unwrap().unwrap().root, jdk.installation.root);
        assert_eq!(load_last_completed_apply().unwrap().unwrap().id, plan.plan_id);
    }

    #[test]
    fn a_later_profile_changes_only_the_tools_it_names() {
        // F-1: A (Java 17 + Node 20), then B (Java 21 only) leaves Java 21 and Node 20.
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let jdk17 = install(dir.path(), ToolKind::Java, "jdk17", "Eclipse Adoptium", "17.0.20.1");
        let jdk21 = install(dir.path(), ToolKind::Java, "jdk21", "Eclipse Adoptium", "21.0.12");
        let node20 = install(dir.path(), ToolKind::Node, "node20", "Node.js", "20.19.0");
        let backend = MemBackend::new()
            .with_user([("Path", "C:\\u")])
            .with_system([("PATHEXT", ".EXE;.CMD;.BAT")]);
        let find = |tool: ToolKind| Ok(if tool == ToolKind::Java { vec![jdk17.clone(), jdk21.clone()] } else { vec![node20.clone()] });

        let a = profile(vec![
            pin(ToolKind::Java, "Eclipse Adoptium", "17.0.20.1", None),
            pin(ToolKind::Node, "Node.js", "20.19.0", None),
        ]);
        apply_tool_plan(&backend, &plan_profile_apply_with(&backend, &a, find).unwrap()).unwrap();
        let b = profile(vec![pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", None)]);
        apply_tool_plan(&backend, &plan_profile_apply_with(&backend, &b, find).unwrap()).unwrap();

        let user = backend.read_user().unwrap();
        assert_eq!(user["JAVA_HOME"].value, jdk21.installation.root.to_string_lossy());
        let path = &user["Path"].value;
        assert!(path.contains(&*jdk21.installation.root.join("bin").to_string_lossy()));
        assert!(!path.contains(&*jdk17.installation.root.join("bin").to_string_lossy()), "{path}");
        assert!(path.contains(&*node20.installation.root.to_string_lossy()));
        assert_eq!(load_tool_selection(ToolKind::Node).unwrap().unwrap().root, node20.installation.root);
    }

    fn remote(versions: &[&str]) -> Vec<RemoteVersion> {
        versions.iter().map(|v| RemoteVersion { version: (*v).into(), download_bytes: None, install_bytes: None }).collect()
    }

    #[test]
    fn missing_pins_map_to_the_release_whichcraft_would_install() {
        let java = remote(&["17.0.20+8", "21.0.12+101.0.LTS"]);
        assert_eq!(remote_for_pin(&pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", None), &java).as_deref(), Some("21.0.12+101.0.LTS"));
        assert_eq!(remote_for_pin(&pin(ToolKind::Java, "Eclipse Adoptium", "17.0.20.1", None), &java).as_deref(), Some("17.0.20+8"));
        assert_eq!(remote_for_pin(&pin(ToolKind::Java, "JetBrains s.r.o.", "21.0.12", None), &java), None, "only Temurin installs");
        assert_eq!(remote_for_pin(&pin(ToolKind::Node, "Node.js", "20.19.0", None), &remote(&["20.19.0", "22.23.4"])).as_deref(), Some("20.19.0"));
        assert_eq!(remote_for_pin(&pin(ToolKind::Node, "Node.js", "20.19.9", None), &remote(&["20.19.0"])), None);

        let unavailable = vec![pin(ToolKind::Node, "Node.js", "20.19.0", None), pin(ToolKind::Git, "Git", "2.55.0", None)];
        let missing = missing_pins(&unavailable, |_| Ok(remote(&["20.19.0"])), |_, _| Some(30_000_000)).unwrap();
        assert_eq!(missing[0].install_version.as_deref(), Some("20.19.0"));
        assert_eq!(missing[0].download_bytes, Some(30_000_000));
        assert_eq!(missing[1].install_version, None, "Git is switch-only");
        assert_eq!(missing[1].download_bytes, None);
    }

    #[test]
    fn repointing_moves_only_pins_that_mean_the_old_installation() {
        let old = ToolInstallation { tool: ToolKind::Java, vendor: "Eclipse Adoptium".into(), version: "21.0.12".into(), root: "C:\\old".into(), managed: true };
        let new = ToolInstallation { tool: ToolKind::Java, vendor: "Eclipse Adoptium".into(), version: "21.0.13".into(), root: "C:\\new".into(), managed: true };
        let mut profiles = vec![
            ToolProfile { id: "a".into(), name: "Android".into(), tools: vec![pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", None)] },
            ToolProfile { id: "b".into(), name: "Other copy".into(), tools: vec![pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", Some("C:\\elsewhere".into()))] },
            ToolProfile { id: "c".into(), name: "Web".into(), tools: vec![pin(ToolKind::Node, "Node.js", "22.23.4", None)] },
        ];
        assert_eq!(profiles_using(&profiles, &old), vec!["Android"], "a pin at another root means another copy");
        let changed = repoint_profiles(&mut profiles, &old, &new);
        assert_eq!(changed, vec!["Android"]);
        assert_eq!(profiles[0].tools[0], pin(ToolKind::Java, "Eclipse Adoptium", "21.0.13", Some("C:\\new".into())));
        assert_eq!(profiles[1].tools[0].version, "21.0.12");
    }

    #[test]
    fn a_profile_that_needs_system_asks_for_uac_once() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let shadow = install(dir.path(), ToolKind::Node, "program-files-nodejs", "Node.js", "24.20.0");
        let node = install(dir.path(), ToolKind::Node, "node20", "Node.js", "20.19.0");
        let jdk = install(dir.path(), ToolKind::Java, "jdk17", "Eclipse Adoptium", "17.0.20.1");
        let system_path = leak(shadow.installation.root.to_string_lossy().into_owned());
        let backend = MemBackend::new()
            .with_user([("Path", "C:\\u")])
            .with_system([("Path", system_path), ("PATHEXT", ".EXE;.CMD;.BAT")])
            .with_elevated(false);
        let p = profile(vec![
            pin(ToolKind::Java, "Eclipse Adoptium", "17.0.20.1", None),
            pin(ToolKind::Node, "Node.js", "20.19.0", None),
        ]);
        let find = |tool: ToolKind| Ok(if tool == ToolKind::Java { vec![jdk.clone()] } else { vec![node.clone(), shadow.clone()] });

        let plan = plan_profile_apply_with(&backend, &p, find).unwrap();
        assert!(plan.requires_uac);
        let elevator = FakeElevator::new(&backend, vec![]);
        apply_tool_plan_elevated(&backend, &elevator, &plan).unwrap();

        assert_eq!(elevator.requests.lock().unwrap().len(), 1);
        assert!(!backend.read_system().unwrap()["Path"].value.contains("program-files-nodejs"));
        assert!(backend.read_user().unwrap()["Path"].value.contains("node20"));
    }
}
