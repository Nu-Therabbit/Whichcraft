//! Adapter contract tests against real Windows APIs.
//!
//! Run manually (not in default CI), one at a time:
//! `cargo test --lib whichcraft::adapters::contract -- --ignored --test-threads=1 --nocapture`
//!
//! They write only variables named `WHICHCRAFT_TEST_*`, undo them through the app's own Undo,
//! and check the key matches what it was before. Back up the Environment keys first anyway.

use std::collections::HashMap;
use std::path::PathBuf;

use crate::env_backend::WinregBackend;
use crate::env_store::{read_snapshot_with, EnvBackend};
use crate::model::{EnvValue, EnvValueKind, VarScope};
use crate::whichcraft::adapters::win::process::fresh_environment;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::persistence::{new_journal_id, use_test_data_dir};
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::services::tool_apply::{apply_tool_plan, apply_tool_plan_elevated};
use crate::whichcraft::services::tool_plan::{PlanVariableDiff, ToolApplyPlan};
use crate::whichcraft::services::undo::undo_last_apply;

/// A plan that sets one variable, shaped like any tool plan so it takes the same path through
/// apply, journal and Undo.
fn set_variable_plan(scope: VarScope, name: &str, value: &str) -> ToolApplyPlan {
    let baseline = read_snapshot_with(&WinregBackend).unwrap();
    let map = if scope == VarScope::System { &baseline.system } else { &baseline.user };
    let diff = PlanVariableDiff {
        name: name.into(),
        scope: scope.clone(),
        before: crate::whichcraft::services::get_var(map, name).map(|v| v.value.clone()),
        after: value.into(),
        value_kind: EnvValueKind::String,
    };
    let system = scope == VarScope::System;
    ToolApplyPlan {
        plan_id: new_journal_id(),
        tool: ToolKind::Node,
        requires_uac: system,
        warnings: Vec::new(),
        limitation_notice: String::new(),
        user_diffs: if system { vec![] } else { vec![diff.clone()] },
        system_diffs: if system { vec![diff] } else { vec![] },
        baseline,
        selected: ToolInstallation {
            tool: ToolKind::Node,
            vendor: "contract".into(),
            version: "0".into(),
            root: PathBuf::from("."),
            managed: false,
        },
        additional_selections: Vec::new(),
        records_selection: false,
        effective_after_user_only: true,
    }
}

fn same_values(a: &HashMap<String, EnvValue>, b: &HashMap<String, EnvValue>) -> bool {
    a.len() == b.len() && a.iter().all(|(k, v)| b.get(k).is_some_and(|w| w.value == v.value && w.kind == v.kind))
}

fn unique(prefix: &str) -> (String, String) {
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    (format!("WHICHCRAFT_TEST_{prefix}"), format!("contract-{stamp}"))
}

/// U-1 and A-2 for User scope, T-2: apply, a new process and a new Windows Terminal see it, Undo
/// leaves HKCU\Environment exactly as it was.
#[test]
#[ignore = "contract: writes WHICHCRAFT_TEST_USER to HKCU\\Environment and opens a Windows Terminal window"]
fn contract_user_apply_reaches_new_processes_and_undo_restores_the_key() {
    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let before = WinregBackend.read_user().unwrap();
    let (name, value) = unique("USER");

    let result = apply_tool_plan(&WinregBackend, &set_variable_plan(VarScope::User, &name, &value)).unwrap();
    assert!(!result.stale && !result.needs_elevation);
    assert_eq!(WinregBackend.read_user().unwrap()[&name].value, value);
    let fresh = fresh_environment().unwrap();
    assert_eq!(fresh.get(&name), Some(&value), "a process started now gets the new value");

    // T-2: a new Windows Terminal window, even with one already open, runs with that environment.
    let out = data.path().join("wt-out.txt");
    let wt_running = std::process::Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq WindowsTerminal.exe", "/NH"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("WindowsTerminal.exe"))
        .unwrap_or(false);
    println!("Windows Terminal already running: {wt_running}");
    let script = format!("echo %{name}%> \"{}\"", out.display());
    std::process::Command::new("wt.exe")
        .args(["-w", "new", "new-tab", "cmd", "/c", &script])
        .env_clear()
        .envs(&fresh)
        .spawn()
        .unwrap();
    let mut seen = None;
    for _ in 0..100 {
        if let Ok(text) = std::fs::read_to_string(&out) {
            if !text.trim().is_empty() {
                seen = Some(text.trim().to_string());
                break;
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    assert_eq!(seen.as_deref(), Some(value.as_str()), "the new terminal sees the new value");

    let undo = undo_last_apply(&WinregBackend, None).unwrap();
    assert!(undo.conflicts.is_empty(), "{:?}", undo.conflicts);
    assert!(same_values(&WinregBackend.read_user().unwrap(), &before), "HKCU\\Environment is back as it was");
}

/// I-1, I-7, R-1: the pinned mise (downloaded and hash-checked into a temporary data folder)
/// installs one Node version into a temporary install store; it runs from its own folder, the
/// inventory finds it, nothing in the registry or mise's default folders changes, and
/// Whichcraft's uninstall removes it again. Downloads about 80 MB of mise plus Node.
#[test]
#[ignore = "contract: downloads mise and Node into temporary folders"]
fn contract_mise_installs_node_without_touching_the_environment_and_uninstalls_it() {
    use crate::whichcraft::adapters::win::uninstall::{WinUninstaller, WinUsageProbe};
    use crate::whichcraft::mise::manager::ProcessMiseRunner;
    use crate::whichcraft::mise::MiseToolManager;
    use crate::whichcraft::persistence::{load_settings, save_settings};
    use crate::whichcraft::ports::installer_catalog::InstallerKind;
    use crate::whichcraft::services::elevation::WinElevator;
    use crate::whichcraft::services::tool_inventory::list_tool_installations;
    use crate::whichcraft::services::uninstall::{plan_uninstall, uninstall, PlanInputs, UninstallMethod, UninstallOutcome};

    const VERSION: &str = "22.12.0";
    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let store = tempfile::tempdir().unwrap();
    let mut settings = load_settings().unwrap();
    settings.install_store = store.path().to_path_buf();
    settings.install_store_confirmed = true;
    save_settings(&settings).unwrap();

    let home = PathBuf::from(std::env::var("USERPROFILE").unwrap());
    let local = PathBuf::from(std::env::var("LOCALAPPDATA").unwrap());
    let mise_defaults = [home.join(".config").join("mise"), local.join("mise"), home.join(".local").join("share").join("mise")];
    let defaults_before: Vec<bool> = mise_defaults.iter().map(|p| p.exists()).collect();
    let user_before = WinregBackend.read_user().unwrap();
    let system_before = WinregBackend.read_system().unwrap();

    let started = std::time::Instant::now();
    let root = MiseToolManager::with_runner(ProcessMiseRunner::for_store(store.path()))
        .install(ToolKind::Node, VERSION)
        .unwrap();
    println!("installed {VERSION} at {} in {:?}", root.display(), started.elapsed());
    assert!(root.starts_with(store.path()), "{}", root.display());

    let out = std::process::Command::new(root.join("node.exe")).arg("--version").output().unwrap();
    assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), format!("v{VERSION}"));

    assert!(same_values(&WinregBackend.read_user().unwrap(), &user_before), "install wrote to HKCU\\Environment");
    assert!(same_values(&WinregBackend.read_system().unwrap(), &system_before), "install wrote to System Environment");
    let defaults_after: Vec<bool> = mise_defaults.iter().map(|p| p.exists()).collect();
    assert_eq!(defaults_after, defaults_before, "mise wrote outside the store: {mise_defaults:?}");

    let views = list_tool_installations(&WinregBackend, ToolKind::Node, None).unwrap();
    let view = views
        .iter()
        .find(|v| crate::whichcraft::tools::paths_equal(&v.installation.root, &root))
        .expect("the inventory finds the managed installation");
    assert!(view.installation.managed);
    assert_eq!(view.installer_kind, InstallerKind::ManagedByWhichcraft);
    assert!(!view.effective && !view.selected);

    let stores = settings.all_install_stores();
    let plan = plan_uninstall(
        PlanInputs { view, all: &views, catalog: None, stores: &stores, scan_roots: &[], protected: &[], profiles: &[] },
        &WinUsageProbe,
    )
    .unwrap();
    assert!(matches!(&plan.method, UninstallMethod::Managed { mise_version, .. } if mise_version == VERSION), "{:?}", plan.method);
    let outcome = uninstall(&plan, None, &WinregBackend, &WinElevator, &WinUsageProbe, &WinUninstaller).unwrap();
    assert_eq!(outcome, UninstallOutcome::Removed);
    assert!(!root.exists());
    assert!(
        !list_tool_installations(&WinregBackend, ToolKind::Node, None).unwrap().iter().any(|v| v.installation.root == root),
        "gone from the inventory"
    );
    assert!(same_values(&WinregBackend.read_user().unwrap(), &user_before));
    assert!(same_values(&WinregBackend.read_system().unwrap(), &system_before));
}

/// A-2 and U-1 for System scope: the write goes through UAC to the app's elevated helper (two UAC
/// prompts: apply, then Undo). Needs `cargo build` first so target\debug\whichcraft.exe is current.
#[test]
#[ignore = "contract: writes WHICHCRAFT_TEST_SYSTEM to HKLM through two UAC prompts"]
fn contract_system_apply_through_uac_and_undo_restores_the_key() {
    use crate::whichcraft::services::elevation::HelperExeElevator;
    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let helper = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target").join("debug").join("whichcraft.exe");
    assert!(helper.is_file(), "build the app first: {}", helper.display());
    let elevator = HelperExeElevator(helper);
    let before = WinregBackend.read_system().unwrap();
    let (name, value) = unique("SYSTEM");

    let plan = set_variable_plan(VarScope::System, &name, &value);
    let result = apply_tool_plan_elevated(&WinregBackend, &elevator, &plan).unwrap();
    assert!(!result.stale && !result.needs_elevation, "{result:?}");
    assert_eq!(WinregBackend.read_system().unwrap()[&name].value, value);
    assert_eq!(fresh_environment().unwrap().get(&name), Some(&value), "a process started now gets it");

    let undo = undo_last_apply(&WinregBackend, Some(&elevator)).unwrap();
    assert!(undo.conflicts.is_empty(), "{:?}", undo.conflicts);
    assert!(same_values(&WinregBackend.read_system().unwrap(), &before), "System Environment is back as it was");
}
