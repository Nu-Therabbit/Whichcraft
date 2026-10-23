//! Removing installations (tickets 14 and 15).
//!
//! Managed installations go through mise in the store that holds them. External ones go through
//! the uninstaller their installer registered (MSI always as `msiexec /x`, since the registered
//! string is usually `/I`, which opens Modify), shown normally rather than silently (Q18). Plain
//! folders go to the Recycle Bin only when every safety rule holds (Q26). An installation in use
//! is never removed (Q19), and the one currently selected or effective is switched away first (Q9).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::elevator::Elevator;
use crate::whichcraft::ports::installer_catalog::{CatalogEntry, InstallerKind};
use crate::whichcraft::ports::uninstaller::{RunOutcome, Uninstaller};
use crate::whichcraft::ports::usage_probe::{UsageProbe, UsageReport};
use crate::whichcraft::services::profiles::ToolProfile;
use crate::whichcraft::services::tool_apply::apply_tool_plan_elevated;
use crate::whichcraft::services::tool_inventory::ToolInstallationView;
use crate::whichcraft::services::tool_plan::ToolApplyPlan;
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::tools::probe_tool_root;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "kind")]
pub enum UninstallMethod {
    /// `mise uninstall` in the store that holds the installation.
    Managed { store: PathBuf, mise_version: String },
    /// The registered uninstaller, run with its normal UI.
    Uninstaller { program: String, args: Vec<String> },
    /// Move the folder to the Recycle Bin.
    RecycleFolder,
    /// Not offered, with the reason shown to the user.
    Refused { reason: String },
}

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum UninstallOutcome {
    Removed,
    /// The user cancelled the uninstaller; any switch already applied stays (R-13).
    Cancelled,
    /// The uninstaller finished but the folder is still there (R-5).
    Incomplete { remaining: PathBuf },
    Blocked { reason: String },
    Failed { code: i32 },
}

/// Splits a registered command line into program and arguments, honouring double quotes.
pub fn split_command_line(command: &str) -> Option<(String, Vec<String>)> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for ch in command.chars() {
        match ch {
            '"' => quoted = !quoted,
            c if c.is_whitespace() && !quoted => {
                if !current.is_empty() {
                    parts.push(std::mem::take(&mut current));
                }
            }
            c => current.push(c),
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }
    let mut iter = parts.into_iter();
    let program = iter.next()?;
    Some((program, iter.collect()))
}

fn product_code(command: &str) -> Option<String> {
    let start = command.find('{')?;
    let end = start + command[start..].find('}')?;
    Some(command[start..=end].to_string())
}

/// Why a plain folder must not be moved to the Recycle Bin, or `None` when it may (Q26 rules 1-4;
/// rule 5, nothing using it, is checked with the usage probe).
pub fn folder_refusal(
    tool: ToolKind,
    root: &Path,
    scan_roots: &[PathBuf],
    other_roots: &[PathBuf],
    protected: &[PathBuf],
) -> Option<String> {
    let same = |a: &Path, b: &Path| {
        a.to_string_lossy().trim_end_matches(['\\', '/']).eq_ignore_ascii_case(b.to_string_lossy().trim_end_matches(['\\', '/']))
    };
    if crate::whichcraft::tools::fs_util::is_reparse_point(root) {
        return Some("the folder is a junction or symbolic link".into());
    }
    if root.parent().is_none() || root.parent().is_some_and(|p| p.parent().is_none() && root.components().count() <= 1) {
        return Some("a drive root is never removed".into());
    }
    if probe_tool_root(tool, root, false).is_none() {
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
pub fn protected_folders() -> Vec<PathBuf> {
    ["SystemRoot", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "USERPROFILE", "LOCALAPPDATA", "APPDATA"]
        .iter()
        .filter_map(|v| std::env::var_os(v).map(PathBuf::from))
        .collect()
}

pub struct PlanInputs<'a> {
    pub view: &'a ToolInstallationView,
    pub all: &'a [ToolInstallationView],
    pub catalog: Option<CatalogEntry>,
    pub stores: &'a [PathBuf],
    pub scan_roots: &'a [PathBuf],
    pub protected: &'a [PathBuf],
    pub profiles: &'a [ToolProfile],
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
                let others: Vec<PathBuf> = inputs.all.iter().map(|v| v.installation.root.clone()).collect();
                match folder_refusal(inst.tool, &inst.root, inputs.scan_roots, &others, inputs.protected) {
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
    let affected_profiles = inputs
        .profiles
        .iter()
        .filter(|p| {
            p.tools.iter().any(|pin| {
                pin.tool == inst.tool
                    && pin.vendor.eq_ignore_ascii_case(&inst.vendor)
                    && pin.version == inst.version
                    && pin.preferred_root.as_ref().map_or(true, |r| *r == inst.root)
            })
        })
        .map(|p| p.name.clone())
        .collect();

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
        let result = apply_tool_plan_elevated(backend, elevator, switch)?;
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
    save_uninstall_record(&record)?;
    let result = run_method(plan, uninstaller);
    record.finished_at = Some(chrono::Utc::now().to_rfc3339());
    match &result {
        Ok(outcome) => record.outcome = Some(outcome.clone()),
        Err(e) => record.error = Some(e.to_string()),
    }
    save_uninstall_record(&record)?;
    result
}

fn run_method(plan: &UninstallPlan, uninstaller: &dyn Uninstaller) -> Result<UninstallOutcome, EnvarlyError> {
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
    if inst.root.exists() {
        return Ok(UninstallOutcome::Incomplete { remaining: inst.root.clone() });
    }
    Ok(UninstallOutcome::Removed)
}

/// The journal entry of one uninstall. Kept apart from env applies (in `journal/uninstalls`), so
/// Undo and recovery, which read every apply in `journal`, never mistake it for one.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UninstallRecord {
    pub id: String,
    pub started_at: String,
    /// `None` while the uninstaller runs; still `None` afterwards means the app did not see it end.
    pub finished_at: Option<String>,
    pub installation: ToolInstallation,
    pub method: UninstallMethod,
    /// The journal of the switch applied first, when the installation was selected or effective.
    pub switch_plan_id: Option<String>,
    pub outcome: Option<UninstallOutcome>,
    pub error: Option<String>,
}

fn uninstall_dir() -> Result<PathBuf, EnvarlyError> {
    let dir = crate::whichcraft::persistence::whichcraft_data_dir()?.join("journal").join("uninstalls");
    std::fs::create_dir_all(&dir).map_err(|e| EnvarlyError::Snapshot(format!("create uninstall journal dir: {e}")))?;
    Ok(dir)
}

fn save_uninstall_record(record: &UninstallRecord) -> Result<(), EnvarlyError> {
    let text = serde_json::to_string_pretty(record)
        .map_err(|e| EnvarlyError::Snapshot(format!("serialize uninstall record: {e}")))?;
    std::fs::write(uninstall_dir()?.join(format!("{}.json", record.id)), text)
        .map_err(|e| EnvarlyError::Snapshot(format!("write uninstall record: {e}")))
}

/// Uninstalls that started but were never seen to end (the app closed or crashed meanwhile);
/// the UI asks the user to rescan, since only the disk says what happened.
pub fn unfinished_uninstalls() -> Result<Vec<UninstallRecord>, EnvarlyError> {
    Ok(load_uninstall_records()?.into_iter().filter(|r| r.finished_at.is_none()).collect())
}

/// Marks an unfinished uninstall as seen, with what a rescan found.
pub fn dismiss_unfinished_uninstall(id: &str) -> Result<(), EnvarlyError> {
    let Some(mut record) = load_uninstall_records()?.into_iter().find(|r| r.id == id) else {
        return Ok(());
    };
    let root = &record.installation.root;
    record.finished_at = Some(chrono::Utc::now().to_rfc3339());
    record.outcome = Some(if root.exists() {
        UninstallOutcome::Incomplete { remaining: root.clone() }
    } else {
        UninstallOutcome::Removed
    });
    save_uninstall_record(&record)
}

/// Every recorded uninstall, newest first.
pub fn load_uninstall_records() -> Result<Vec<UninstallRecord>, EnvarlyError> {
    let mut records: Vec<UninstallRecord> = std::fs::read_dir(uninstall_dir()?)
        .map_err(|e| EnvarlyError::Snapshot(format!("read uninstall journal: {e}")))?
        .flatten()
        .filter_map(|e| serde_json::from_str(&std::fs::read_to_string(e.path()).ok()?).ok())
        .collect();
    records.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::env_store::MemBackend;
    use crate::whichcraft::fake::{FakeUninstaller, FakeUsageProbe};
    use crate::whichcraft::persistence::use_test_data_dir;
    use crate::whichcraft::ports::installation_probe::ToolInstallation;
    use crate::whichcraft::services::profiles::ProfileToolPin;
    use crate::whichcraft::services::tool_apply::{create_tool_plan, test_support::FakeElevator};

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
        PlanInputs { view, all, catalog, stores: &[], scan_roots: &[], protected: &[], profiles: &[] }
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
    fn registered_command_lines_keep_their_quoted_parts() {
        assert_eq!(
            split_command_line("\"C:\\Program Files\\Git\\unins001.exe\""),
            Some(("C:\\Program Files\\Git\\unins001.exe".into(), vec![]))
        );
        assert_eq!(
            split_command_line("\"C:\\x\\pymanager.exe\" uninstall --yes --by-id \"pythoncore-3.14-64\""),
            Some(("C:\\x\\pymanager.exe".into(), vec!["uninstall".into(), "--yes".into(), "--by-id".into(), "pythoncore-3.14-64".into()]))
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
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let v = jdk(dir.path(), "jdk-zip", "21.0.1");
        let plan = plan_uninstall(inputs(&v, &[v.clone()], None), &FakeUsageProbe::default()).unwrap();
        assert_eq!(plan.method, UninstallMethod::RecycleFolder);
        let un = FakeUninstaller::default();
        let out = uninstall(&plan, None, &MemBackend::new(), &FakeElevator::new(&MemBackend::new(), vec![]), &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Removed);
        assert_eq!(*un.recycled.lock().unwrap(), vec![v.installation.root.clone()]);
    }

    #[test]
    fn folders_failing_the_safety_rules_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        let outer = jdk(dir.path(), "outer", "21.0.1");
        let inner_root = outer.installation.root.join("nested-jdk");
        // Not an installation root.
        assert!(folder_refusal(ToolKind::Java, dir.path(), &[], &[], &[]).is_some());
        // A scan folder.
        assert!(folder_refusal(ToolKind::Java, &outer.installation.root, &[outer.installation.root.clone()], &[], &[]).is_some());
        // Another installation inside.
        let reason = folder_refusal(ToolKind::Java, &outer.installation.root, &[], &[inner_root], &[]).unwrap();
        assert!(reason.contains("nested-jdk"));
        // A protected folder.
        assert!(folder_refusal(ToolKind::Java, &outer.installation.root, &[], &[], &[outer.installation.root.clone()]).is_some());
        // A drive root.
        assert!(folder_refusal(ToolKind::Java, Path::new("C:\\"), &[], &[], &[]).is_some());
        // All rules pass.
        assert!(folder_refusal(ToolKind::Java, &outer.installation.root, &[], &[], &[]).is_none());
    }

    #[test]
    fn an_installation_in_use_is_never_removed() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk-zip", "21.0.1");
        let busy = FakeUsageProbe { report: UsageReport { processes: vec!["OpenJDK Platform binary".into()], folder_locked: false } };
        let plan = plan_uninstall(inputs(&v, &[v.clone()], None), &busy).unwrap();
        assert!(plan.gradle_hint);
        let un = FakeUninstaller::default();
        let out = uninstall(&plan, None, &MemBackend::new(), &FakeElevator::new(&MemBackend::new(), vec![]), &busy, &un).unwrap();
        assert!(matches!(out, UninstallOutcome::Blocked { reason } if reason.contains("OpenJDK")));
        assert!(un.recycled.lock().unwrap().is_empty());
        assert!(v.installation.root.exists());
    }

    #[test]
    fn a_terminal_inside_the_folder_blocks_removal() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk-zip", "21.0.1");
        let locked = FakeUsageProbe { report: UsageReport { processes: vec![], folder_locked: true } };
        let plan = plan_uninstall(inputs(&v, &[v.clone()], None), &FakeUsageProbe::default()).unwrap();
        let out = uninstall(&plan, None, &MemBackend::new(), &FakeElevator::new(&MemBackend::new(), vec![]), &locked, &FakeUninstaller::default()).unwrap();
        assert!(matches!(out, UninstallOutcome::Blocked { reason } if reason.contains("folder open")));
    }

    #[test]
    fn the_selected_jdk_is_switched_away_before_it_is_removed() {
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
        let blocked = uninstall(&plan, None, &backend, &elevator, &FakeUsageProbe::default(), &un).unwrap();
        assert!(matches!(blocked, UninstallOutcome::Blocked { .. }));
        assert!(old.installation.root.exists());

        let switch = create_tool_plan(&backend, &new.installation).unwrap();
        let out = uninstall(&plan, Some(&switch), &backend, &elevator, &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Removed);
        assert_eq!(backend.read_user().unwrap()["JAVA_HOME"].value, new.installation.root.to_string_lossy());
    }

    #[test]
    fn each_uninstall_is_journaled_and_undo_still_reverts_the_switch() {
        let dir = tempfile::tempdir().unwrap();
        let mut old = jdk(dir.path(), "jdk17", "17.0.20.1");
        old.selected = true;
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let all = vec![old.clone(), new.clone()];
        let backend = MemBackend::new().with_user([("Path", "C:\\u")]);
        let plan = plan_uninstall(inputs(&old, &all, None), &FakeUsageProbe::default()).unwrap();
        let switch = create_tool_plan(&backend, &new.installation).unwrap();
        let elevator = FakeElevator::new(&backend, vec![]);
        let out = uninstall(&plan, Some(&switch), &backend, &elevator, &FakeUsageProbe::default(), &FakeUninstaller::default()).unwrap();
        assert_eq!(out, UninstallOutcome::Removed);

        let records = load_uninstall_records().unwrap();
        assert_eq!(records.len(), 1);
        let r = &records[0];
        assert_eq!(r.installation.root, old.installation.root);
        assert_eq!(r.switch_plan_id.as_deref(), Some(switch.plan_id.as_str()));
        assert_eq!(r.outcome, Some(UninstallOutcome::Removed));
        assert!(r.finished_at.is_some());

        // The uninstall record is not an env apply: Undo goes back to the switch.
        let undo = crate::whichcraft::services::undo::undo_last_apply(&backend, Some(&elevator)).unwrap();
        assert!(undo.conflicts.is_empty());
        assert!(!backend.read_user().unwrap().contains_key("JAVA_HOME"));
    }

    #[test]
    fn an_uninstall_cut_short_is_reported_until_dismissed() {
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
        save_uninstall_record(&record).unwrap();
        assert_eq!(unfinished_uninstalls().unwrap(), vec![record]);
        dismiss_unfinished_uninstall("uninstall-x").unwrap();
        assert!(unfinished_uninstalls().unwrap().is_empty());
        assert_eq!(
            load_uninstall_records().unwrap()[0].outcome,
            Some(UninstallOutcome::Incomplete { remaining: v.installation.root.clone() }),
            "the folder is still there, so the rescan says incomplete"
        );
    }

    #[test]
    fn a_failing_uninstaller_is_journaled_with_its_error() {
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
        assert!(uninstall(&plan, None, &backend, &FakeElevator::new(&backend, vec![]), &FakeUsageProbe::default(), &Broken).is_err());
        let r = &load_uninstall_records().unwrap()[0];
        assert_eq!(r.outcome, None);
        assert!(r.error.as_deref().unwrap().contains("msiexec"));
    }

    #[test]
    fn a_cancelled_uninstaller_keeps_the_switch_and_the_installation() {
        let dir = tempfile::tempdir().unwrap();
        use_test_data_dir(dir.path());
        let mut old = jdk(dir.path(), "jdk17", "17.0.20.1");
        old.effective = true;
        let new = jdk(dir.path(), "jdk21", "21.0.12");
        let all = vec![old.clone(), new.clone()];
        let backend = MemBackend::new().with_user([("Path", "C:\\u")]);
        let plan = plan_uninstall(inputs(&old, &all, Some(msi_entry(&old.installation.root))), &FakeUsageProbe::default()).unwrap();
        let switch = create_tool_plan(&backend, &new.installation).unwrap();
        let un = FakeUninstaller { outcome: RunOutcome::Cancelled, ..Default::default() };
        let out = uninstall(&plan, Some(&switch), &backend, &FakeElevator::new(&backend, vec![]), &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Cancelled);
        assert!(old.installation.root.exists());
        assert_eq!(backend.read_user().unwrap()["JAVA_HOME"].value, new.installation.root.to_string_lossy());
    }

    #[test]
    fn a_folder_left_behind_by_the_uninstaller_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let v = jdk(dir.path(), "jdk17", "17.0.20.1");
        let plan = plan_uninstall(inputs(&v, &[v.clone()], Some(msi_entry(&v.installation.root))), &FakeUsageProbe::default()).unwrap();
        let un = FakeUninstaller { leaves_folder: true, ..Default::default() };
        let out = uninstall(&plan, None, &MemBackend::new(), &FakeElevator::new(&MemBackend::new(), vec![]), &FakeUsageProbe::default(), &un).unwrap();
        assert_eq!(out, UninstallOutcome::Incomplete { remaining: v.installation.root.clone() });
        assert_eq!(un.ran.lock().unwrap()[0], "msiexec.exe /x {E8C508F2-9798-43CA-84B4-B25D1274380B}");
    }

    #[test]
    fn managed_installs_are_removed_with_mise_in_their_own_store() {
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
        let out = uninstall(&plan, None, &MemBackend::new(), &FakeElevator::new(&MemBackend::new(), vec![]), &FakeUsageProbe::default(), &un).unwrap();
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
