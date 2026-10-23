//! Removing installations (tickets 14 and 15).
//!
//! Managed installations go through mise in the store that holds them. External ones go through
//! the uninstaller their installer registered (MSI always as `msiexec /x`, since the registered
//! string is usually `/I`, which opens Modify), shown normally rather than silently (Q18). Plain
//! folders go to the Recycle Bin only when every safety rule holds (Q26). An installation in use
//! is never removed (Q19), and the one currently selected or effective is switched away first (Q9).

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::ports::elevator::Elevator;
use crate::whichcraft::ports::store::Store;
use crate::whichcraft::domain::uninstall::UninstallRecord;
use crate::whichcraft::ports::installer_catalog::{CatalogEntry};
use crate::whichcraft::domain::{InstallerKind};
use crate::whichcraft::ports::uninstaller::{RunOutcome, Uninstaller};
use crate::whichcraft::ports::usage_probe::{UsageProbe, UsageReport};
use crate::whichcraft::domain::profiles::ToolProfile;
use crate::whichcraft::application::tool_apply::apply_tool_plan_elevated;
use crate::whichcraft::domain::ToolInstallationView;
use crate::whichcraft::domain::ToolApplyPlan;
use crate::whichcraft::ports::machine::Machine;
use crate::whichcraft::domain::uninstall::{product_code, split_command_line, UninstallMethod, UninstallOutcome};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallPlan {
    pub installation: ToolInstallationView,
    pub method: UninstallMethod,
    pub usage: UsageReport,
    /// Selected or effective: a replacement must be chosen and applied first (Q9).
    pub needs_replacement: bool,
    /// Other installations of the tool that can replace it.
    pub replacements: Vec<ToolInstallationView>,
    /// Profiles that refer to this installation (F-5, repointed by ticket 19).
    pub affected_profiles: Vec<String>,
    /// Suggests `gradlew --stop` when a JDK is held by a Java process.
    pub gradle_hint: bool,
    /// The registered uninstaller removes without asking (Python install manager), so the
    /// confirmation in the app is the only one (R-4).
    pub no_confirmation: bool,
}

/// Why a plain folder must not be moved to the Recycle Bin, or `None` when it may (Q26 rules 1-4;
/// rule 5, nothing using it, is checked with the usage probe).
pub fn folder_refusal(
    machine: &dyn Machine,
    tool: ToolKind,
    root: &Path,
    scan_roots: &[PathBuf],
    other_roots: &[PathBuf],
    protected: &[PathBuf],
) -> Option<String> {
    let same = |a: &Path, b: &Path| {
        a.to_string_lossy().trim_end_matches(['\\', '/']).eq_ignore_ascii_case(b.to_string_lossy().trim_end_matches(['\\', '/']))
    };
    if machine.is_reparse_point(root) {
        return Some("the folder is a junction or symbolic link".into());
    }
    if root.parent().is_none() || root.parent().is_some_and(|p| p.parent().is_none() && root.components().count() <= 1) {
        return Some("a drive root is never removed".into());
    }
    if machine.probe(tool, root, false).is_none() {
        return Some("the folder is not the root of this installation".into());
    }
    if scan_roots.iter().any(|s| same(s, root)) {
        return Some("the folder is a scan folder".into());
    }
    if protected.iter().any(|p| same(p, root)) {
        return Some("the folder is a protected system or profile folder".into());
    }
    if let Some(inner) = other_roots.iter().find(|o| !same(o, root) && o.starts_with(root)) {
        return Some(format!("another installation is inside it: {}", inner.display()));
    }
    None
}

/// Folders that must never be removed: drive-level system folders and the user profile.
pub fn protected_folders(machine: &dyn Machine) -> Vec<PathBuf> {
    ["SystemRoot", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "USERPROFILE", "LOCALAPPDATA", "APPDATA"]
        .iter()
        .filter_map(|v| machine.env_var(v).map(PathBuf::from))
        .collect()
}

pub struct PlanInputs<'a> {
    pub machine: &'a dyn Machine,
    pub view: &'a ToolInstallationView,
    pub all: &'a [ToolInstallationView],
    pub catalog: Option<CatalogEntry>,
    pub stores: &'a [PathBuf],
    pub scan_roots: &'a [PathBuf],
    pub protected: &'a [PathBuf],
    pub profiles: &'a [ToolProfile],
    /// Roots of every other tool's installations: a folder holding one of them, such as a Python
    /// that sits inside a JDK folder, must not go to the Recycle Bin with it (Q26).
    pub other_tool_roots: &'a [PathBuf],
}

pub fn plan_uninstall(inputs: PlanInputs, usage: &dyn UsageProbe) -> Result<UninstallPlan, EnvarlyError> {
    let view = inputs.view;
    let inst = &view.installation;
    let report = usage.probe(inst.tool, &inst.root)?;

    let no_confirmation = inputs.catalog.as_ref().is_some_and(|e| e.kind == InstallerKind::PythonInstallManager);
    let method = if let Some(store) = inputs.stores.iter().find(|s| inst.root.starts_with(s)) {
        UninstallMethod::Managed {
            store: store.clone(),
            mise_version: inst.root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        }
    } else {
        match inputs.catalog {
            Some(entry) => match (&entry.kind, entry.uninstall_command.as_deref()) {
                (InstallerKind::Msi, Some(cmd)) => match product_code(cmd) {
                    Some(code) => UninstallMethod::Uninstaller { program: "msiexec.exe".into(), args: vec!["/x".into(), code] },
                    None => UninstallMethod::Refused { reason: "the MSI entry has no product code".into() },
                },
                (InstallerKind::ManagedByOtherTool, _) => UninstallMethod::Refused {
                    reason: format!("{} is managed by another tool; remove it there", entry.display_name),
                },
                (_, None) => UninstallMethod::Refused {
                    reason: format!("{} registered no uninstall command; another tool probably manages it", entry.display_name),
                },
                (_, Some(cmd)) => match split_command_line(cmd) {
                    Some((program, args)) => UninstallMethod::Uninstaller { program, args },
                    None => UninstallMethod::Refused { reason: "the uninstall command is empty".into() },
                },
            },
            None => {
                let others: Vec<PathBuf> = inputs
                    .all
                    .iter()
                    .map(|v| v.installation.root.clone())
                    .chain(inputs.other_tool_roots.iter().cloned())
                    .collect();
                match folder_refusal(inputs.machine, inst.tool, &inst.root, inputs.scan_roots, &others, inputs.protected) {
                    Some(reason) => UninstallMethod::Refused { reason },
                    None => UninstallMethod::RecycleFolder,
                }
            }
        }
    };

    let replacements = inputs
        .all
        .iter()
        .filter(|v| v.available && v.installation.root != inst.root)
        .cloned()
        .collect();
    let affected_profiles = crate::whichcraft::domain::profiles::profiles_using(inputs.profiles, inst);

    Ok(UninstallPlan {
        gradle_hint: inst.tool == ToolKind::Java && !report.processes.is_empty(),
        no_confirmation,
        usage: report,
        needs_replacement: view.selected || view.effective,
        installation: view.clone(),
        method,
        replacements,
        affected_profiles,
    })
}

/// Carries out a plan. `replacement` is the apply plan for the chosen replacement when the
/// installation is selected or effective; it is applied first, through UAC when needed.
pub fn uninstall<B: EnvBackend>(
    plan: &UninstallPlan,
    replacement: Option<&ToolApplyPlan>,
    backend: &B,
    store: &dyn Store,
    machine: &dyn Machine,
    elevator: &dyn Elevator,
    usage: &dyn UsageProbe,
    uninstaller: &dyn Uninstaller,
) -> Result<UninstallOutcome, EnvarlyError> {
    let inst = &plan.installation.installation;
    if let UninstallMethod::Refused { reason } = &plan.method {
        return Ok(UninstallOutcome::Blocked { reason: reason.clone() });
    }
    // Usage can change between planning and confirming; check again right before removing.
    let usage_now = usage.probe(inst.tool, &inst.root)?;
    if usage_now.in_use() {
        return Ok(UninstallOutcome::Blocked {
            reason: if usage_now.processes.is_empty() {
                "a program has the folder open (for example a terminal inside it)".into()
            } else {
                format!("in use by {}", usage_now.processes.join(", "))
            },
        });
    }

    if plan.needs_replacement {
        let Some(switch) = replacement else {
            return Ok(UninstallOutcome::Blocked { reason: "choose a replacement first".into() });
        };
        let result = apply_tool_plan_elevated(backend, store, elevator, switch)?;
        if result.stale {
            return Ok(UninstallOutcome::Blocked {
                reason: "the environment changed; review the switch again".into(),
            });
        }
    }

    // Recorded before anything is removed, so an uninstall the app did not see finish leaves a trace.
    let mut record = UninstallRecord {
        id: format!("uninstall-{}", chrono::Utc::now().format("%Y%m%dT%H%M%S%.3fZ")),
        started_at: chrono::Utc::now().to_rfc3339(),
        finished_at: None,
        installation: inst.clone(),
        method: plan.method.clone(),
        switch_plan_id: replacement.filter(|_| plan.needs_replacement).map(|p| p.plan_id.clone()),
        outcome: None,
        error: None,
    };
    store.save_uninstall_record(&record)?;
    let result = run_method(plan, machine, uninstaller);
    record.finished_at = Some(chrono::Utc::now().to_rfc3339());
    match &result {
        Ok(outcome) => record.outcome = Some(outcome.clone()),
        Err(e) => record.error = Some(e.to_string()),
    }
    store.save_uninstall_record(&record)?;
    result
}

fn run_method(plan: &UninstallPlan, machine: &dyn Machine, uninstaller: &dyn Uninstaller) -> Result<UninstallOutcome, EnvarlyError> {
    let inst = &plan.installation.installation;
    match &plan.method {
        UninstallMethod::Managed { store, mise_version } => uninstaller.uninstall_managed(store, inst.tool, mise_version)?,
        UninstallMethod::RecycleFolder => uninstaller.recycle_folder(&inst.root)?,
        UninstallMethod::Uninstaller { program, args } => match uninstaller.run_uninstaller(program, args)? {
            RunOutcome::Finished => {}
            RunOutcome::Cancelled => return Ok(UninstallOutcome::Cancelled),
            RunOutcome::Failed(code) => return Ok(UninstallOutcome::Failed { code }),
        },
        UninstallMethod::Refused { reason } => return Ok(UninstallOutcome::Blocked { reason: reason.clone() }),
    }

    // Check the result on disk rather than trusting the uninstaller (R-5).
    if machine.is_dir(&inst.root) || machine.is_file(&inst.root) {
        return Ok(UninstallOutcome::Incomplete { remaining: inst.root.clone() });
    }
    Ok(UninstallOutcome::Removed)
}

/// Uninstalls that started but were never seen to end (the app closed or crashed meanwhile);
/// the UI asks the user to rescan, since only the disk says what happened.
pub fn unfinished_uninstalls(store: &dyn Store) -> Result<Vec<UninstallRecord>, EnvarlyError> {
    Ok(store.uninstall_records()?.into_iter().filter(|r| r.finished_at.is_none()).collect())
}

/// Marks an unfinished uninstall as seen, with what a rescan found.
pub fn dismiss_unfinished_uninstall(store: &dyn Store, machine: &dyn Machine, id: &str) -> Result<(), EnvarlyError> {
    let Some(mut record) = store.uninstall_records()?.into_iter().find(|r| r.id == id) else {
        return Ok(());
    };
    let root = &record.installation.root;
    record.finished_at = Some(chrono::Utc::now().to_rfc3339());
    record.outcome = Some(if machine.is_dir(root) || machine.is_file(root) {
        UninstallOutcome::Incomplete { remaining: root.clone() }
    } else {
        UninstallOutcome::Removed
    });
    store.save_uninstall_record(&record)
}

#[cfg(test)]
mod tests {
    use crate::whichcraft::adapters::local::LocalMachine;
    use super::*;
    use crate::whichcraft::fake::MemStore;
    use crate::env_store::MemBackend;
    use crate::whichcraft::fake::{FakeUninstaller, FakeUsageProbe};
    use crate::whichcraft::persistence::use_test_data_dir;
    use crate::whichcraft::domain::ToolInstallation;
    use crate::whichcraft::domain::profiles::ProfileToolPin;
    use crate::whichcraft::application::tool_apply::{create_tool_plan, test_support::FakeElevator};

    fn jdk(dir: &Path, name: &str, version: &str) -> ToolInstallationView {
        // Uninstalls write their journal record to the data dir.
        use_test_data_dir(dir);
        let root = dir.join(name);
        std::fs::create_dir_all(root.join("bin")).unwrap();
        std::fs::write(root.join("bin").join("java.exe"), b"").unwrap();
        std::fs::write(root.join("release"), format!("IMPLEMENTOR=\"Eclipse Adoptium\"\nJAVA_VERSION=\"{version}\"\n")).unwrap();
        ToolInstallationView {
            installation: ToolInstallation { tool: ToolKind::Java, vendor: "Eclipse Adoptium".into(), version: version.into(), root, managed: false },
            effective: false,
            selected: false,
            available: true,
            installer_kind: InstallerKind::FolderOnly,
            mismatch_reason: None,
        }
    }

    fn inputs<'a>(view: &'a ToolInstallationView, all: &'a [ToolInstallationView], catalog: Option<CatalogEntry>) -> PlanInputs<'a> {
        PlanInputs { machine: &LocalMachine, view, all, catalog, stores: &[], scan_roots: &[], protected: &[], profiles: &[], other_tool_roots: &[] }
    }

    fn msi_entry(root: &Path) -> CatalogEntry {
        CatalogEntry {
            install_root: root.to_path_buf(),
            kind: InstallerKind::Msi,
            display_name: "Eclipse Temurin JDK 17".into(),
            uninstall_command: Some("MsiExec.exe /I{E8C508F2-9798-43CA-84B4-B25D1274380B}".into()),
        }
    }

    #[test]
    fn msi_uninstalls_with_x_not_the_registered_i() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk17", "17.0.20.1");
        let plan = plan_uninstall(inputs(&v, &[v.clone()], Some(msi_entry(&v.installation.root))), &FakeUsageProbe::default()).unwrap();
        assert_eq!(
            plan.method,
            UninstallMethod::Uninstaller {
                program: "msiexec.exe".into(),
                args: vec!["/x".into(), "{E8C508F2-9798-43CA-84B4-B25D1274380B}".into()]
            }
        );
    }

    #[test]
    fn python_install_manager_runs_its_command_and_warns_there_is_no_prompt() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "py", "3.14.6");
        let entry = CatalogEntry {
            install_root: v.installation.root.clone(),
            kind: InstallerKind::PythonInstallManager,
            display_name: "Python 3.14".into(),
            uninstall_command: Some(r#""C:\pm\pymanager.exe" uninstall --yes --by-id pythoncore-3.14-64"#.into()),
        };
        let plan = plan_uninstall(inputs(&v, &[v.clone()], Some(entry)), &FakeUsageProbe::default()).unwrap();
        assert!(plan.no_confirmation);
        assert!(matches!(&plan.method, UninstallMethod::Uninstaller { program, .. } if program == r"C:\pm\pymanager.exe"));
    }

    #[test]
    fn an_entry_without_an_uninstall_command_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk", "21.0.5");
        let entry = CatalogEntry {
            install_root: v.installation.root.clone(),
            kind: InstallerKind::InnoSetup,
            display_name: "Some JDK".into(),
            uninstall_command: None,
        };
        let plan = plan_uninstall(inputs(&v, &[v.clone()], Some(entry)), &FakeUsageProbe::default()).unwrap();
        assert!(matches!(&plan.method, UninstallMethod::Refused { reason } if reason.contains("another tool")));
    }

    #[test]
    fn tools_managed_elsewhere_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jbr", "21.0.5");
        let entry = CatalogEntry {
            install_root: v.installation.root.clone(),
            kind: InstallerKind::ManagedByOtherTool,
            display_name: "Android Studio".into(),
            uninstall_command: None,
        };
        let plan = plan_uninstall(inputs(&v, &[v.clone()], Some(entry)), &FakeUsageProbe::default()).unwrap();
        assert!(matches!(&plan.method, UninstallMethod::Refused { reason } if reason.contains("Android Studio")));
    }

    #[test]
    fn a_plain_jdk_folder_goes_to_the_recycle_bin() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let v = jdk(dir.path(), "jdk-zip", "21.0.1");
        let plan = plan_uninstall(inputs(&v, &[v.clone()], None), &FakeUsageProbe::default()).unwrap();
        assert_eq!(plan.method, UninstallMethod::RecycleFolder);
        let un = FakeUninstaller::default();
        let out = uninstall(&plan, None, &MemBackend::new(), &store, &LocalMachine, &FakeElevator::new(&MemBackend::new(), vec![]), &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Removed);
        assert_eq!(*un.recycled.lock().unwrap(), vec![v.installation.root.clone()]);
    }

    #[test]
    fn folders_failing_the_safety_rules_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        let outer = jdk(dir.path(), "outer", "21.0.1");
        let inner_root = outer.installation.root.join("nested-jdk");
        // Not an installation root.
        assert!(folder_refusal(&LocalMachine, ToolKind::Java, dir.path(), &[], &[], &[]).is_some());
        // A scan folder.
        assert!(folder_refusal(&LocalMachine, ToolKind::Java, &outer.installation.root, &[outer.installation.root.clone()], &[], &[]).is_some());
        // Another installation inside.
        let reason = folder_refusal(&LocalMachine, ToolKind::Java, &outer.installation.root, &[], &[inner_root], &[]).unwrap();
        assert!(reason.contains("nested-jdk"));
        // A protected folder.
        assert!(folder_refusal(&LocalMachine, ToolKind::Java, &outer.installation.root, &[], &[], &[outer.installation.root.clone()]).is_some());
        // A drive root.
        assert!(folder_refusal(&LocalMachine, ToolKind::Java, Path::new("C:\\"), &[], &[], &[]).is_some());
        // All rules pass.
        assert!(folder_refusal(&LocalMachine, ToolKind::Java, &outer.installation.root, &[], &[], &[]).is_none());
    }

    #[test]
    fn a_jdk_folder_holding_another_tools_installation_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk-zip", "21.0.1");
        let python_inside = v.installation.root.join("tools").join("python");
        let other_tool_roots = vec![python_inside.clone()];
        let plan = plan_uninstall(
            PlanInputs { other_tool_roots: &other_tool_roots, ..inputs(&v, &[v.clone()], None) },
            &FakeUsageProbe::default(),
        )
        .unwrap();
        assert!(
            matches!(&plan.method, UninstallMethod::Refused { reason } if reason.contains("python")),
            "{:?}",
            plan.method
        );
    }

    #[test]
    fn an_installation_in_use_is_never_removed() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk-zip", "21.0.1");
        let busy = FakeUsageProbe { report: UsageReport { processes: vec!["OpenJDK Platform binary".into()], folder_locked: false } };
        let plan = plan_uninstall(inputs(&v, &[v.clone()], None), &busy).unwrap();
        assert!(plan.gradle_hint);
        let un = FakeUninstaller::default();
        let out = uninstall(&plan, None, &MemBackend::new(), &store, &LocalMachine, &FakeElevator::new(&MemBackend::new(), vec![]), &busy, &un).unwrap();
        assert!(matches!(out, UninstallOutcome::Blocked { reason } if reason.contains("OpenJDK")));
        assert!(un.recycled.lock().unwrap().is_empty());
        assert!(v.installation.root.exists());
    }

    #[test]
    fn a_terminal_inside_the_folder_blocks_removal() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk-zip", "21.0.1");
        let locked = FakeUsageProbe { report: UsageReport { processes: vec![], folder_locked: true } };
        let plan = plan_uninstall(inputs(&v, &[v.clone()], None), &FakeUsageProbe::default()).unwrap();
        let out = uninstall(&plan, None, &MemBackend::new(), &store, &LocalMachine, &FakeElevator::new(&MemBackend::new(), vec![]), &locked, &FakeUninstaller::default()).unwrap();
        assert!(matches!(out, UninstallOutcome::Blocked { reason } if reason.contains("folder open")));
    }

    #[test]
    fn the_selected_jdk_is_switched_away_before_it_is_removed() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let mut old = jdk(dir.path(), "jdk17", "17.0.20.1");
        old.selected = true;
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let all = vec![old.clone(), new.clone()];
        let backend = MemBackend::new().with_user([("Path", "C:\\u")]);
        let plan = plan_uninstall(inputs(&old, &all, None), &FakeUsageProbe::default()).unwrap();
        assert!(plan.needs_replacement);
        assert_eq!(plan.replacements.len(), 1);

        let elevator = FakeElevator::new(&backend, vec![]);
        let un = FakeUninstaller::default();
        // Without a replacement nothing happens.
        let blocked = uninstall(&plan, None, &backend, &store, &LocalMachine, &elevator, &FakeUsageProbe::default(), &un).unwrap();
        assert!(matches!(blocked, UninstallOutcome::Blocked { .. }));
        assert!(old.installation.root.exists());

        let switch = create_tool_plan(&backend, &LocalMachine, &new.installation).unwrap();
        let out = uninstall(&plan, Some(&switch), &backend, &store, &LocalMachine, &elevator, &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Removed);
        assert_eq!(backend.read_user().unwrap()["JAVA_HOME"].value, new.installation.root.to_string_lossy());
    }

    #[test]
    fn each_uninstall_is_journaled_and_undo_still_reverts_the_switch() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        let mut old = jdk(dir.path(), "jdk17", "17.0.20.1");
        old.selected = true;
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let all = vec![old.clone(), new.clone()];
        let backend = MemBackend::new().with_user([("Path", "C:\\u")]);
        let plan = plan_uninstall(inputs(&old, &all, None), &FakeUsageProbe::default()).unwrap();
        let switch = create_tool_plan(&backend, &LocalMachine, &new.installation).unwrap();
        let elevator = FakeElevator::new(&backend, vec![]);
        let out = uninstall(&plan, Some(&switch), &backend, &store, &LocalMachine, &elevator, &FakeUsageProbe::default(), &FakeUninstaller::default()).unwrap();
        assert_eq!(out, UninstallOutcome::Removed);

        let records = store.uninstall_records().unwrap();
        assert_eq!(records.len(), 1);
        let r = &records[0];
        assert_eq!(r.installation.root, old.installation.root);
        assert_eq!(r.switch_plan_id.as_deref(), Some(switch.plan_id.as_str()));
        assert_eq!(r.outcome, Some(UninstallOutcome::Removed));
        assert!(r.finished_at.is_some());

        // The uninstall record is not an env apply: Undo goes back to the switch.
        let undo = crate::whichcraft::application::undo::undo_last_apply(&backend, &store, Some(&elevator)).unwrap();
        assert!(undo.conflicts.is_empty());
        assert!(!backend.read_user().unwrap().contains_key("JAVA_HOME"));
    }

    #[test]
    fn an_uninstall_cut_short_is_reported_until_dismissed() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk17", "17.0.20.1");
        let record = UninstallRecord {
            id: "uninstall-x".into(),
            started_at: "2026-10-23T10:00:00Z".into(),
            finished_at: None,
            installation: v.installation.clone(),
            method: UninstallMethod::RecycleFolder,
            switch_plan_id: None,
            outcome: None,
            error: None,
        };
        store.save_uninstall_record(&record).unwrap();
        assert_eq!(unfinished_uninstalls(&store).unwrap(), vec![record]);
        dismiss_unfinished_uninstall(&store, &LocalMachine, "uninstall-x").unwrap();
        assert!(unfinished_uninstalls(&store).unwrap().is_empty());
        assert_eq!(
            store.uninstall_records().unwrap()[0].outcome,
            Some(UninstallOutcome::Incomplete { remaining: v.installation.root.clone() }),
            "the folder is still there, so the rescan says incomplete"
        );
    }

    #[test]
    fn a_failing_uninstaller_is_journaled_with_its_error() {
        let store = MemStore::default();
        struct Broken;
        impl Uninstaller for Broken {
            fn run_uninstaller(&self, _: &str, _: &[String]) -> Result<RunOutcome, EnvarlyError> {
                Err(EnvarlyError::InvalidInput("could not start msiexec.exe".into()))
            }
            fn recycle_folder(&self, _: &Path) -> Result<(), EnvarlyError> {
                unreachable!()
            }
            fn uninstall_managed(&self, _: &Path, _: ToolKind, _: &str) -> Result<(), EnvarlyError> {
                unreachable!()
            }
        }
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk17", "17.0.20.1");
        let plan = plan_uninstall(inputs(&v, &[v.clone()], Some(msi_entry(&v.installation.root))), &FakeUsageProbe::default()).unwrap();
        let backend = MemBackend::new();
        assert!(uninstall(&plan, None, &backend, &store, &LocalMachine, &FakeElevator::new(&backend, vec![]), &FakeUsageProbe::default(), &Broken).is_err());
        let r = &store.uninstall_records().unwrap()[0];
        assert_eq!(r.outcome, None);
        assert!(r.error.as_deref().unwrap().contains("msiexec"));
    }

    #[test]
    fn a_cancelled_uninstaller_keeps_the_switch_and_the_installation() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let mut old = jdk(dir.path(), "jdk17", "17.0.20.1");
        old.effective = true;
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let all = vec![old.clone(), new.clone()];
        let backend = MemBackend::new().with_user([("Path", "C:\\u")]);
        let plan = plan_uninstall(inputs(&old, &all, Some(msi_entry(&old.installation.root))), &FakeUsageProbe::default()).unwrap();
        let switch = create_tool_plan(&backend, &LocalMachine, &new.installation).unwrap();
        let un = FakeUninstaller { outcome: RunOutcome::Cancelled, ..Default::default() };
        let out = uninstall(&plan, Some(&switch), &backend, &store, &LocalMachine, &FakeElevator::new(&backend, vec![]), &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Cancelled);
        assert!(old.installation.root.exists());
        assert_eq!(backend.read_user().unwrap()["JAVA_HOME"].value, new.installation.root.to_string_lossy());
    }

    #[test]
    fn a_folder_left_behind_by_the_uninstaller_is_reported() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk17", "17.0.20.1");
        let plan = plan_uninstall(inputs(&v, &[v.clone()], Some(msi_entry(&v.installation.root))), &FakeUsageProbe::default()).unwrap();
        let un = FakeUninstaller { leaves_folder: true, ..Default::default() };
        let out = uninstall(&plan, None, &MemBackend::new(), &store, &LocalMachine, &FakeElevator::new(&MemBackend::new(), vec![]), &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Incomplete { remaining: v.installation.root.clone() });
        assert_eq!(un.ran.lock().unwrap()[0], "msiexec.exe /x {E8C508F2-9798-43CA-84B4-B25D1274380B}");
    }

    #[test]
    fn managed_installs_are_removed_with_mise_in_their_own_store() {
        let store = MemStore::default();
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let store_a = dir.path().join("store-a");
        let root = store_a.join("_mise").join("data").join("installs").join("java").join("temurin-21.0.12+101.0.LTS");
        std::fs::create_dir_all(root.join("bin")).unwrap();
        std::fs::write(root.join("bin").join("java.exe"), b"").unwrap();
        let v = ToolInstallationView {
            installation: ToolInstallation { tool: ToolKind::Java, vendor: "Eclipse Adoptium".into(), version: "21.0.12.1".into(), root: root.clone(), managed: true },
            effective: false,
            selected: false,
            available: true,
            installer_kind: InstallerKind::ManagedByWhichcraft,
            mismatch_reason: None,
        };
        let stores = vec![dir.path().join("store-b"), store_a.clone()];
        let plan = plan_uninstall(PlanInputs { stores: &stores, ..inputs(&v, &[v.clone()], None) }, &FakeUsageProbe::default()).unwrap();
        assert_eq!(plan.method, UninstallMethod::Managed { store: store_a.clone(), mise_version: "temurin-21.0.12+101.0.LTS".into() });
        let un = FakeUninstaller::default();
        *un.removes.lock().unwrap() = Some(root.clone());
        let out = uninstall(&plan, None, &MemBackend::new(), &store, &LocalMachine, &FakeElevator::new(&MemBackend::new(), vec![]), &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Removed);
        assert_eq!(un.managed.lock().unwrap()[0].0, store_a);
    }

    #[test]
    fn profiles_that_use_the_installation_are_listed() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk17", "17.0.20.1");
        let profiles = vec![
            ToolProfile {
                id: "a".into(),
                name: "Android work".into(),
                tools: vec![ProfileToolPin { tool: ToolKind::Java, vendor: "Eclipse Adoptium".into(), version: "17.0.20.1".into(), preferred_root: None }],
            },
            ToolProfile {
                id: "b".into(),
                name: "Web".into(),
                tools: vec![ProfileToolPin { tool: ToolKind::Node, vendor: "Node.js".into(), version: "22.23.4".into(), preferred_root: None }],
            },
        ];
        let plan = plan_uninstall(PlanInputs { profiles: &profiles, ..inputs(&v, &[v.clone()], None) }, &FakeUsageProbe::default()).unwrap();
        assert_eq!(plan.affected_profiles, vec!["Android work"]);
    }
}
