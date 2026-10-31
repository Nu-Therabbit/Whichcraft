use crate::whichcraft::domain::plan::RESTART_LIMITATION_NOTICE;

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::model::{EnvValue, EnvValueKind, VarScope};
use crate::path_manage;
use crate::whichcraft::domain::env::get_var;
use crate::whichcraft::domain::path::{compute_prepend, path_entries, path_entry_diff};
use crate::whichcraft::domain::plan::path_dirs_for_tool;
use crate::whichcraft::domain::ToolInstallation;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::domain::{PlanVariableDiff, ToolApplyPlan};
use crate::whichcraft::ports::machine::Machine;

pub fn build_tool_apply_plan<B: EnvBackend>(
    backend: &B,
    machine: &dyn Machine,
    installation: &ToolInstallation,
    plan_id: String,
) -> Result<ToolApplyPlan, EnvarlyError> {
    if !machine.is_dir(&installation.root) {
        return Err(EnvarlyError::InvalidInput(
            "installation folder is missing (unavailable)".into(),
        ));
    }

    let baseline = crate::env_store::read_snapshot_with(backend)?;
    let user = backend.read_user()?;
    let system = backend.read_system()?;

    let path_before = user
        .get("Path")
        .map(|v| v.value.clone())
        .unwrap_or_default();
    let path_kind = user
        .get("Path")
        .and_then(|v| v.kind)
        .unwrap_or(EnvValueKind::ExpandString);

    let mut path_after = path_before.clone();
    for dir in path_dirs_for_tool(installation) {
        if let Some(next) = compute_prepend(&path_after, &dir) {
            path_after = next;
        }
    }
    // The same switch takes the other installations of this tool off User PATH, so the diff shows
    // them and Undo puts them back. `%JAVA_HOME%\bin` is judged with the JAVA_HOME written here.
    let mut planned_user = user.clone();
    if installation.tool == ToolKind::Java {
        planned_user.insert(
            "JAVA_HOME".into(),
            crate::model::EnvValue::typed(
                installation.root.to_string_lossy().into_owned(),
                EnvValueKind::String,
            ),
        );
    }
    let expand_planned =
        crate::whichcraft::application::registry_expander(&planned_user, &system, machine);
    for entry in other_installation_entries(machine, &path_after, installation, &expand_planned) {
        path_after = remove_path_entry(&path_after, &entry);
    }

    let mut user_diffs = Vec::new();
    if installation.tool == ToolKind::Java {
        let root = installation.root.to_string_lossy().into_owned();
        let java_home_before = user.get("JAVA_HOME").map(|v| v.value.clone());
        let java_home_kind = user
            .get("JAVA_HOME")
            .and_then(|v| v.kind)
            .unwrap_or(EnvValueKind::String);
        user_diffs.push(PlanVariableDiff {
            name: "JAVA_HOME".into(),
            scope: VarScope::User,
            before: java_home_before,
            after: root,
            value_kind: java_home_kind,
        });
    }

    if path_after != path_before {
        user_diffs.push(PlanVariableDiff {
            name: "Path".into(),
            scope: VarScope::User,
            before: Some(path_before.clone()),
            after: path_after.clone(),
            value_kind: path_kind,
        });
    }

    let system_path_before = system
        .get("Path")
        .map(|v| v.value.clone())
        .unwrap_or_default();
    let system_path_kind = system
        .get("Path")
        .and_then(|v| v.kind)
        .unwrap_or(EnvValueKind::ExpandString);

    let mut system_diffs = Vec::new();
    let mut warnings = Vec::new();
    let cmd = crate::whichcraft::tools::command_name(installation.tool);
    let pathext = user
        .get("PATHEXT")
        .or_else(|| system.get("PATHEXT"))
        .map(|v| v.value.as_str())
        .unwrap_or("");

    // Judge PATH with the values this plan writes: a System `%JAVA_HOME%\bin` follows the new
    // JAVA_HOME, so it is not a shadow to remove.
    let mut user_after = user.clone();
    for diff in &user_diffs {
        user_after.insert(
            diff.name.clone(),
            crate::model::EnvValue::typed(diff.after.clone(), diff.value_kind),
        );
    }
    let expand = crate::whichcraft::application::registry_expander(&user_after, &system, machine);
    let check_user = path_manage::check_command_with(
        cmd,
        &path_after,
        system_path_before.as_str(),
        pathext,
        &expand,
        |p: &str| machine.dir_exists(p),
    );
    let effective_after_user = check_user.hits.first().is_some_and(|hit| {
        path_dirs_for_tool(installation)
            .iter()
            .any(|d| hit.directory.eq_ignore_ascii_case(d))
    });

    if !effective_after_user {
        if let Some(shadow) =
            find_system_shadow(machine, &system_path_before, installation, &expand)
        {
            let mut system_after = system_path_before.clone();
            system_after = remove_path_entry(&system_after, &shadow);
            system_diffs.push(PlanVariableDiff {
                name: "Path".into(),
                scope: VarScope::System,
                before: Some(system_path_before.clone()),
                after: system_after,
                value_kind: system_path_kind,
            });
            warnings.push(format!(
                "system_path_removal: will remove {shadow} from System PATH (affects all users)"
            ));
        } else {
            warnings.push(format!(
                "system_path_may_still_win: effective {cmd} may not change until System PATH is adjusted"
            ));
        }
    }

    for dir in path_dirs_for_tool(installation) {
        if is_local_appdata_path(machine, &dir)
            && system_diffs.iter().any(|d| d.scope == VarScope::System)
        {
            return Err(EnvarlyError::InvalidInput(
                "refusing to mirror LocalAppData paths into System PATH".into(),
            ));
        }
    }

    let requires_uac = !system_diffs.is_empty();

    Ok(ToolApplyPlan {
        plan_id,
        tool: installation.tool,
        requires_uac,
        warnings,
        limitation_notice: RESTART_LIMITATION_NOTICE.into(),
        user_diffs,
        system_diffs,
        baseline,
        selected: installation.clone(),
        additional_selections: Vec::new(),
        records_selection: true,
        effective_after_user_only: effective_after_user,
    })
}

/// True when any variable the plan touches no longer has the value the plan was built from.
pub fn tool_plan_is_stale(
    plan: &ToolApplyPlan,
    backend: &dyn EnvBackend,
) -> Result<bool, EnvarlyError> {
    let current = crate::env_store::read_snapshot_with(backend)?;
    for diff in plan.user_diffs.iter().chain(plan.system_diffs.iter()) {
        let map = match diff.scope {
            VarScope::User => &current.user,
            VarScope::System => &current.system,
            VarScope::OtherUser => current.other_user.as_ref().unwrap_or(&current.user),
        };
        if get_var(map, &diff.name).map(|v| v.value.as_str()) != diff.before.as_deref() {
            return Ok(true);
        }
    }
    Ok(false)
}

fn find_system_shadow(
    machine: &dyn Machine,
    system_path: &str,
    installation: &ToolInstallation,
    expand: &dyn Fn(&str) -> String,
) -> Option<String> {
    let selected_dirs: Vec<String> = path_dirs_for_tool(installation);
    for entry in path_entries(system_path) {
        let expanded = expand(&entry);
        if !machine.dir_exists(&expanded) {
            continue;
        }
        for sel in &selected_dirs {
            if crate::whichcraft::tools::paths_equal(
                std::path::Path::new(&expanded),
                std::path::Path::new(sel),
            ) {
                continue;
            }
            if would_shadow(machine, &expanded, sel, installation.tool) {
                return Some(entry);
            }
        }
    }
    None
}

/// User PATH entries that run `installation`'s tool from another installation: the folder holds
/// the tool's executable and its root is recognised as an installation of that tool.
fn other_installation_entries(
    machine: &dyn Machine,
    path: &str,
    installation: &ToolInstallation,
    expand: &dyn Fn(&str) -> String,
) -> Vec<String> {
    let tool = installation.tool;
    let exe = format!("{}.exe", crate::whichcraft::tools::command_name(tool));
    path_entries(path)
        .into_iter()
        .filter(|entry| {
            let dir = std::path::PathBuf::from(expand(entry).trim_end_matches(['\\', '/']));
            if !machine.is_file(&dir.join(&exe)) {
                return false;
            }
            crate::whichcraft::tools::probes::infer_root_from_command_dir(tool, &dir)
                .and_then(|root| machine.probe(tool, &root, false))
                .is_some_and(|other| {
                    !crate::whichcraft::tools::paths_equal(&other.root, &installation.root)
                })
        })
        .collect()
}

fn would_shadow(
    machine: &dyn Machine,
    system_dir: &str,
    selected_dir: &str,
    tool: ToolKind,
) -> bool {
    let cmd = crate::whichcraft::tools::command_name(tool);
    let hit = path_manage::check_command_with(
        cmd,
        selected_dir,
        system_dir,
        ".EXE;.CMD;.BAT",
        // Both folders are already expanded.
        |s: &str| s.to_string(),
        |p: &str| machine.dir_exists(p),
    );
    // A hit in the selected User folder proves the target exists, not that this System
    // entry shadows it. Removing that entry could otherwise drop System32 from PATH.
    hit.hits.first().is_some_and(|hit| hit.source == "System")
}

fn remove_path_entry(path: &str, entry: &str) -> String {
    path_entries(path)
        .into_iter()
        .filter(|e| !e.eq_ignore_ascii_case(entry))
        .collect::<Vec<_>>()
        .join(";")
}

fn is_local_appdata_path(machine: &dyn Machine, dir: &str) -> bool {
    if let Some(local) = machine.env_var("LOCALAPPDATA") {
        return dir
            .trim_end_matches(['\\', '/'])
            .eq_ignore_ascii_case(local.trim_end_matches(['\\', '/']));
    }
    false
}

pub fn diff_to_env_value(diff: &PlanVariableDiff) -> EnvValue {
    EnvValue::typed(diff.after.clone(), diff.value_kind)
}

type PathMutation = (PlanVariableDiff, (Vec<String>, Vec<String>));

/// Each diff with the PATH entries it adds and removes (empty for other variables).
pub fn plan_to_mutations(plan: &ToolApplyPlan) -> Vec<PathMutation> {
    plan.user_diffs
        .iter()
        .chain(plan.system_diffs.iter())
        .map(|diff| {
            let entries = if diff.name.eq_ignore_ascii_case("path") {
                path_entry_diff(diff.before.as_deref().unwrap_or(""), &diff.after)
            } else {
                (Vec::new(), Vec::new())
            };
            (diff.clone(), entries)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    use crate::whichcraft::adapters::local::LocalMachine;
    use crate::whichcraft::persistence::FileStore;

    fn leak(s: String) -> &'static str {
        Box::leak(s.into_boxed_str())
    }

    fn jdk(dir: &std::path::Path, name: &str, version: &str) -> ToolInstallation {
        let root = dir.join(name);
        std::fs::create_dir_all(root.join("bin")).unwrap();
        std::fs::write(root.join("bin").join("java.exe"), b"").unwrap();
        std::fs::write(
            root.join("release"),
            format!("IMPLEMENTOR=\"Eclipse Adoptium\"\nJAVA_VERSION=\"{version}\"\n"),
        )
        .unwrap();
        ToolInstallation {
            tool: ToolKind::Java,
            vendor: "Eclipse Adoptium".into(),
            version: version.into(),
            root,
            managed: false,
        }
    }

    #[test]
    fn a_go_switch_preserves_shared_system_directories_before_the_real_shadow() {
        let dir = tempfile::tempdir().unwrap();
        let shared = dir.path().join("system32");
        let unrelated = dir.path().join("other-tools");
        let old = dir.path().join("old-go");
        let new = dir.path().join("new-go");
        for folder in [&shared, &unrelated, &old.join("bin"), &new.join("bin")] {
            std::fs::create_dir_all(folder).unwrap();
        }
        for root in [&old, &new] {
            std::fs::write(root.join("bin").join("go.exe"), b"").unwrap();
            std::fs::write(root.join("VERSION"), "go1.26.10").unwrap();
        }
        let system_path = leak(format!(
            "{};{};{}",
            shared.display(),
            old.join("bin").display(),
            unrelated.display()
        ));
        let backend = MemBackend::new()
            .with_user([("Path", r"C:\user-tools")])
            .with_system([("Path", system_path), ("PATHEXT", ".EXE;.CMD;.BAT")]);
        let selected = ToolInstallation {
            tool: ToolKind::Go,
            vendor: "Go".into(),
            version: "1.26.10".into(),
            root: new,
            managed: true,
        };
        let plan =
            build_tool_apply_plan(&backend, &LocalMachine, &selected, "go-shadow".into()).unwrap();
        assert_eq!(plan.system_diffs.len(), 1);
        assert_eq!(
            plan.system_diffs[0].after,
            format!("{};{}", shared.display(), unrelated.display()),
            "only the actual old Go directory may be removed"
        );
        assert!(
            !plan.system_diffs[0]
                .after
                .contains(&*selected.root.to_string_lossy()),
            "the selected root stays in User PATH"
        );
    }

    #[test]
    fn switching_takes_the_old_installation_off_user_path_in_the_same_plan() {
        let dir = tempfile::tempdir().unwrap();
        let old = jdk(dir.path(), "jdk17", "17.0.20");
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let other = dir.path().join("tools");
        std::fs::create_dir_all(&other).unwrap();
        let user_path = leak(format!(
            "{};{};%JAVA_HOME%\\bin",
            old.root.join("bin").display(),
            other.display()
        ));
        let old_home = leak(old.root.to_string_lossy().into_owned());
        let backend = MemBackend::new()
            .with_user([("Path", user_path), ("JAVA_HOME", old_home)])
            .with_system([("PATHEXT", ".EXE;.CMD;.BAT")]);

        let plan = build_tool_apply_plan(&backend, &LocalMachine, &new, "p".into()).unwrap();
        let path = &plan
            .user_diffs
            .iter()
            .find(|d| d.name == "Path")
            .unwrap()
            .after;
        let expected = format!(
            "{};{};%JAVA_HOME%\\bin",
            new.root.join("bin").display(),
            other.display()
        );
        // The old JDK goes; an unrelated folder stays; %JAVA_HOME%\bin follows the new JAVA_HOME and stays.
        assert_eq!(path, &expected);
    }

    #[test]
    fn undo_puts_the_removed_old_installation_back() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let old = jdk(dir.path(), "jdk17", "17.0.20");
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let before = leak(format!("{};C:\\u", old.root.join("bin").display()));
        let backend = MemBackend::new()
            .with_user([("Path", before)])
            .with_system([("PATHEXT", ".EXE")]);

        use crate::whichcraft::adapters::operation_ids::SystemOperationIds;
        let plan = crate::whichcraft::application::tool_apply::create_tool_plan(
            &backend,
            &LocalMachine,
            &new,
            &SystemOperationIds,
        )
        .unwrap();
        crate::whichcraft::application::tool_apply::apply_tool_plan(
            &backend,
            &FileStore,
            &SystemOperationIds,
            &plan,
        )
        .unwrap();
        assert!(!backend.read_user().unwrap()["Path"].value.contains("jdk17"));

        let undo =
            crate::whichcraft::application::undo::undo_last_apply(&backend, &FileStore, None)
                .unwrap();
        assert!(undo.conflicts.is_empty());
        assert_eq!(backend.read_user().unwrap()["Path"].value, before);
    }

    #[test]
    fn a_new_folder_already_behind_the_old_one_becomes_first_by_removing_the_old() {
        let dir = tempfile::tempdir().unwrap();
        let old = jdk(dir.path(), "jdk17", "17.0.20");
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let user_path = leak(format!(
            "{};{}",
            old.root.join("bin").display(),
            new.root.join("bin").display()
        ));
        let backend = MemBackend::new()
            .with_user([("Path", user_path)])
            .with_system([("PATHEXT", ".EXE")]);
        let plan = build_tool_apply_plan(&backend, &LocalMachine, &new, "p".into()).unwrap();
        let path = &plan
            .user_diffs
            .iter()
            .find(|d| d.name == "Path")
            .unwrap()
            .after;
        assert_eq!(path, &new.root.join("bin").to_string_lossy());
        assert!(plan.effective_after_user_only);
    }

    #[test]
    fn a_system_java_home_bin_entry_follows_the_new_java_home_and_is_not_removed() {
        let dir = tempfile::tempdir().unwrap();
        for jdk in ["jdk17", "jdk21"] {
            std::fs::create_dir_all(dir.path().join(jdk).join("bin")).unwrap();
            std::fs::write(dir.path().join(jdk).join("bin").join("java.exe"), b"").unwrap();
        }
        let jdk17 = leak(dir.path().join("jdk17").to_string_lossy().into_owned());
        let backend = MemBackend::new()
            .with_user([("Path", r"C:\u")])
            .with_system([
                ("Path", r"%JAVA_HOME%\bin"),
                ("JAVA_HOME", jdk17),
                ("PATHEXT", ".EXE;.CMD;.BAT"),
            ]);
        let jdk21 = ToolInstallation {
            tool: ToolKind::Java,
            vendor: "Eclipse Adoptium".into(),
            version: "21.0.12".into(),
            root: dir.path().join("jdk21"),
            managed: false,
        };
        let plan = build_tool_apply_plan(&backend, &LocalMachine, &jdk21, "p".into()).unwrap();
        assert!(plan.system_diffs.is_empty(), "{:?}", plan.system_diffs);
        assert!(!plan.requires_uac);
    }
}
