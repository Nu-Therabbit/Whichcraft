use std::collections::HashMap;

use crate::env_store::{EnvBackend, MemBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvValue, VarScope};
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::ports::operation_ids::OperationIds;
use crate::whichcraft::ports::store::Store;
use crate::whichcraft::ports::machine::Machine;
use crate::whichcraft::ports::installer_catalog::InstallerCatalog;
use crate::whichcraft::domain::env::get_var;
use crate::whichcraft::domain::PlanVariableDiff;
use crate::whichcraft::application::tool_apply::create_tool_plan;
use crate::whichcraft::application::tool_inventory::{list_tool_installations};
use crate::whichcraft::domain::ToolInstallationView;
use crate::whichcraft::domain::ToolApplyPlan;
use crate::whichcraft::domain::profiles::{resolve_pin, ProfileMatchStatus, ToolProfile};

pub fn profile_status<B: EnvBackend>(
    backend: &B,
    store: &dyn Store,
    machine: &dyn Machine,
    catalog: &dyn InstallerCatalog,
    profile: &ToolProfile,
) -> Result<ProfileMatchStatus, EnvarlyError> {
    profile_status_with(profile, |tool| list_tool_installations(backend, store, machine, catalog, tool, None))
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
    store: &dyn Store,
    machine: &dyn Machine,
    catalog: &dyn InstallerCatalog,
    profile: &ToolProfile,
    ids: &dyn OperationIds,
) -> Result<ToolApplyPlan, EnvarlyError> {
    plan_profile_apply_with(backend, machine, profile, ids, |tool| {
        list_tool_installations(backend, store, machine, catalog, tool, None)
    })
}

fn plan_profile_apply_with<B: EnvBackend>(
    backend: &B,
    machine: &dyn Machine,
    profile: &ToolProfile,
    ids: &dyn OperationIds,
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
        let step = create_tool_plan(&scratch, machine, installation, ids)?;
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
        plan_id: ids.new_apply_id(),
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

#[cfg(test)]
mod tests {
    use crate::whichcraft::adapters::local::LocalMachine;
    use crate::whichcraft::adapters::operation_ids::SystemOperationIds;
    use super::*;
    use std::path::PathBuf;
    use crate::whichcraft::application::tool_apply::apply_tool_plan;
    use crate::whichcraft::persistence::FileStore;
    use crate::whichcraft::persistence::{load_last_completed_apply, load_tool_selection, use_test_data_dir};
    use crate::whichcraft::domain::profiles::ProfileToolPin;
    use crate::whichcraft::domain::{InstallerKind, ToolInstallation};
    use crate::whichcraft::application::tool_apply::test_support::FakeElevator;
    use crate::whichcraft::application::tool_apply::apply_tool_plan_elevated;

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
        assert!(plan_profile_apply_with(&backend, &LocalMachine, &p, &SystemOperationIds, |_| Ok(found.clone())).is_err());
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

        let plan = plan_profile_apply_with(&backend, &LocalMachine, &p, &SystemOperationIds, find).unwrap();
        let result = apply_tool_plan(&backend, &FileStore, &SystemOperationIds, &plan).unwrap();
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
        apply_tool_plan(
            &backend,
            &FileStore,
            &SystemOperationIds,
            &plan_profile_apply_with(&backend, &LocalMachine, &a, &SystemOperationIds, find).unwrap(),
        )
        .unwrap();
        let b = profile(vec![pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", None)]);
        apply_tool_plan(
            &backend,
            &FileStore,
            &SystemOperationIds,
            &plan_profile_apply_with(&backend, &LocalMachine, &b, &SystemOperationIds, find).unwrap(),
        )
        .unwrap();

        let user = backend.read_user().unwrap();
        assert_eq!(user["JAVA_HOME"].value, jdk21.installation.root.to_string_lossy());
        let path = &user["Path"].value;
        assert!(path.contains(&*jdk21.installation.root.join("bin").to_string_lossy()));
        assert!(!path.contains(&*jdk17.installation.root.join("bin").to_string_lossy()), "{path}");
        assert!(path.contains(&*node20.installation.root.to_string_lossy()));
        assert_eq!(load_tool_selection(ToolKind::Node).unwrap().unwrap().root, node20.installation.root);
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

        let plan = plan_profile_apply_with(&backend, &LocalMachine, &p, &SystemOperationIds, find).unwrap();
        assert!(plan.requires_uac);
        let elevator = FakeElevator::new(&backend, vec![]);
        apply_tool_plan_elevated(&backend, &FileStore, &SystemOperationIds, &elevator, &plan).unwrap();

        assert_eq!(elevator.requests.lock().unwrap().len(), 1);
        assert!(!backend.read_system().unwrap()["Path"].value.contains("program-files-nodejs"));
        assert!(backend.read_user().unwrap()["Path"].value.contains("node20"));
    }
}
