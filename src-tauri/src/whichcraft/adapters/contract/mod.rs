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
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::persistence::{new_journal_id, use_test_data_dir};
use crate::whichcraft::domain::ToolInstallation;
use crate::whichcraft::services::tool_apply::{apply_tool_plan, apply_tool_plan_elevated};
use crate::whichcraft::domain::plan::{PlanVariableDiff, ToolApplyPlan};
use crate::whichcraft::services::undo::undo_last_apply;
use crate::whichcraft::persistence::FileStore;
use crate::whichcraft::adapters::local::LocalMachine;
use crate::whichcraft::fake::FakeInstallerCatalog;

/// A plan that sets one variable, shaped like any tool plan so it takes the same path through
/// apply, journal and Undo.
fn set_variable_plan(scope: VarScope, name: &str, value: &str) -> ToolApplyPlan {
    let baseline = read_snapshot_with(&WinregBackend).unwrap();
    let map = if scope == VarScope::System { &baseline.system } else { &baseline.user };
    let diff = PlanVariableDiff {
        name: name.into(),
        scope: scope.clone(),
        before: crate::whichcraft::domain::env::get_var(map, name).map(|v| v.value.clone()),
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

    let result = apply_tool_plan(&WinregBackend, &FileStore, &set_variable_plan(VarScope::User, &name, &value)).unwrap();
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

    let undo = undo_last_apply(&WinregBackend, &FileStore, None).unwrap();
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
    use crate::whichcraft::domain::InstallerKind;
    use crate::whichcraft::adapters::win::elevation::WinElevator;
    use crate::whichcraft::services::tool_inventory::list_tool_installations;
    use crate::whichcraft::services::uninstall::{plan_uninstall, uninstall, PlanInputs};
    use crate::whichcraft::domain::uninstall::{UninstallMethod, UninstallOutcome};

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

    let views = list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), ToolKind::Node, None).unwrap();
    let view = views
        .iter()
        .find(|v| crate::whichcraft::tools::paths_equal(&v.installation.root, &root))
        .expect("the inventory finds the managed installation");
    assert!(view.installation.managed);
    assert_eq!(view.installer_kind, InstallerKind::ManagedByWhichcraft);
    assert!(!view.effective && !view.selected);

    let stores = settings.all_install_stores();
    let plan = plan_uninstall(
        PlanInputs { machine: &LocalMachine, view, all: &views, catalog: None, stores: &stores, scan_roots: &[], protected: &[], profiles: &[], other_tool_roots: &[] },
        &WinUsageProbe,
    )
    .unwrap();
    assert!(matches!(&plan.method, UninstallMethod::Managed { mise_version, .. } if mise_version == VERSION), "{:?}", plan.method);
    let outcome = uninstall(&plan, None, &WinregBackend, &FileStore, &LocalMachine, &WinElevator, &WinUsageProbe, &WinUninstaller).unwrap();
    assert_eq!(outcome, UninstallOutcome::Removed);
    assert!(!root.exists());
    assert!(
        !list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), ToolKind::Node, None).unwrap().iter().any(|v| v.installation.root == root),
        "gone from the inventory"
    );
    assert!(same_values(&WinregBackend.read_user().unwrap(), &user_before));
    assert!(same_values(&WinregBackend.read_system().unwrap(), &system_before));
}

/// Newest release of `line` that mise offers, e.g. the newest Temurin 21.
fn newest_remote(mgr: &crate::whichcraft::mise::MiseToolManager<crate::whichcraft::mise::manager::ProcessMiseRunner>, tool: ToolKind, line: &str) -> String {
    use crate::whichcraft::ports::tool_manager::ToolManager;
    use crate::whichcraft::domain::versions::release_numbers;
    mgr.list_remote(tool)
        .unwrap()
        .into_iter()
        .filter(|r| r.version.starts_with(line) && release_numbers(tool, &r.version).is_some())
        .max_by_key(|r| release_numbers(tool, &r.version))
        .unwrap_or_else(|| panic!("no {tool:?} {line} release"))
        .version
}

/// Everything still under the store for one tool: its installs folder and mise's download cache.
fn leftovers(store: &std::path::Path, tool: ToolKind) -> Vec<String> {
    let installs = crate::whichcraft::domain::store_layout::mise_installs_dir(store, tool).unwrap();
    let cache = store.join("_mise").join("cache").join(installs.file_name().unwrap());
    [installs, cache]
        .iter()
        .flat_map(|dir| std::fs::read_dir(dir).into_iter().flatten().flatten().map(|e| e.path().display().to_string()))
        .collect()
}

/// I-1, D-3, R-1 for Temurin 21, Python 3.13 and Go 1.26: each installs into a temporary store,
/// runs from its own folder, is listed once (mise's junctions are not extra installations), and
/// Whichcraft's uninstall leaves nothing of it in the store. Downloads a few hundred MB.
#[test]
#[ignore = "contract: downloads mise, Temurin 21, Python 3.13 and Go 1.26 into temporary folders"]
fn contract_mise_installs_temurin_python_go_and_uninstalls_them_cleanly() {
    use crate::whichcraft::adapters::win::uninstall::{WinUninstaller, WinUsageProbe};
    use crate::whichcraft::mise::manager::ProcessMiseRunner;
    use crate::whichcraft::mise::MiseToolManager;
    use crate::whichcraft::persistence::{load_settings, save_settings};
    use crate::whichcraft::adapters::win::elevation::WinElevator;
    use crate::whichcraft::services::tool_inventory::list_tool_installations;
    use crate::whichcraft::services::uninstall::{plan_uninstall, uninstall, PlanInputs};
    use crate::whichcraft::domain::uninstall::{UninstallOutcome};

    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let store = tempfile::tempdir().unwrap();
    let mut settings = load_settings().unwrap();
    settings.install_store = store.path().to_path_buf();
    save_settings(&settings).unwrap();
    let user_before = WinregBackend.read_user().unwrap();
    let system_before = WinregBackend.read_system().unwrap();
    let mgr = MiseToolManager::with_runner(ProcessMiseRunner::for_store(store.path()));

    let cases: [(ToolKind, &str, &str, &[&str]); 3] = [
        (ToolKind::Java, "21.", "bin\\java.exe", &["-version"]),
        (ToolKind::Python, "3.13.", "python.exe", &["--version"]),
        (ToolKind::Go, "1.26.", "bin\\go.exe", &["version"]),
    ];
    let mut report = Vec::new();
    for (tool, line, exe, args) in cases {
        let version = newest_remote(&mgr, tool, line);
        let started = std::time::Instant::now();
        let root = mgr.install(tool, &version).unwrap();
        let out = std::process::Command::new(root.join(exe)).args(args).output().unwrap();
        let said = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
        println!("{tool:?} {version} at {} in {:?}: {}", root.display(), started.elapsed(), said.lines().next().unwrap_or(""));
        assert!(out.status.success(), "{tool:?} does not run: {said}");
        assert!(root.starts_with(store.path()));

        let views = list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), tool, None).unwrap();
        let ours: Vec<_> = views.iter().filter(|v| v.installation.root.starts_with(store.path())).collect();
        println!("  listed: {:?}", ours.iter().map(|v| (&v.installation.vendor, &v.installation.version)).collect::<Vec<_>>());
        assert_eq!(ours.len(), 1, "listed once, not once per junction");
        if tool == ToolKind::Java {
            assert_eq!(ours[0].installation.vendor, "Eclipse Adoptium", "vendor comes from the release file");
        }
        println!("  before uninstall: {:?}", leftovers(store.path(), tool));

        let stores = settings.all_install_stores();
        let plan = plan_uninstall(
            PlanInputs { machine: &LocalMachine, view: ours[0], all: &views, catalog: None, stores: &stores, scan_roots: &[], protected: &[], profiles: &[], other_tool_roots: &[] },
            &WinUsageProbe,
        )
        .unwrap();
        let outcome = uninstall(&plan, None, &WinregBackend, &FileStore, &LocalMachine, &WinElevator, &WinUsageProbe, &WinUninstaller).unwrap();
        assert_eq!(outcome, UninstallOutcome::Removed, "{tool:?}");
        let left = leftovers(store.path(), tool);
        println!("  after uninstall: {left:?}");
        report.push((tool, left));
    }
    assert!(same_values(&WinregBackend.read_user().unwrap(), &user_before));
    assert!(same_values(&WinregBackend.read_system().unwrap(), &system_before));
    // mise's version lists and metadata (`*.msgpack.z`) are shared by every version of the tool and
    // stay; nothing that belongs to the removed version may (folder, junctions, download cache).
    assert!(
        report.iter().all(|(_, left)| left.iter().all(|p| p.ends_with(".msgpack.z"))),
        "left in the store after uninstall: {report:?}"
    );
}

/// S-1, S-2: install in store A, switch to store B and install there; both are listed, A's copy
/// stays where it is and is removed with mise pointed at A, leaving B's alone.
#[test]
#[ignore = "contract: downloads mise and two Node versions into temporary folders"]
fn contract_two_install_stores_list_both_and_uninstall_from_the_old_one() {
    use crate::whichcraft::adapters::win::uninstall::{WinUninstaller, WinUsageProbe};
    use crate::whichcraft::mise::manager::ProcessMiseRunner;
    use crate::whichcraft::mise::MiseToolManager;
    use crate::whichcraft::persistence::{load_settings, save_settings};
    use crate::whichcraft::adapters::win::elevation::WinElevator;
    use crate::whichcraft::services::tool_inventory::list_tool_installations;
    use crate::whichcraft::services::uninstall::{plan_uninstall, uninstall, PlanInputs};
    use crate::whichcraft::domain::uninstall::{UninstallMethod, UninstallOutcome};

    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let (a, b) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
    let mut settings = load_settings().unwrap();
    settings.install_store = a.path().to_path_buf();
    save_settings(&settings).unwrap();
    let in_a = MiseToolManager::with_runner(ProcessMiseRunner::from_settings().unwrap()).install(ToolKind::Node, "22.11.0").unwrap();

    let mut settings = load_settings().unwrap();
    settings.switch_install_store(b.path().to_path_buf());
    save_settings(&settings).unwrap();
    let in_b = MiseToolManager::with_runner(ProcessMiseRunner::from_settings().unwrap()).install(ToolKind::Node, "22.12.0").unwrap();
    assert!(in_a.starts_with(a.path()) && in_b.starts_with(b.path()), "{} {}", in_a.display(), in_b.display());

    let views = list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), ToolKind::Node, None).unwrap();
    let find = |root: &std::path::Path| views.iter().find(|v| crate::whichcraft::tools::paths_equal(&v.installation.root, root));
    let (view_a, _) = (find(&in_a).expect("store A still listed"), find(&in_b).expect("store B listed"));

    let settings = load_settings().unwrap();
    let stores = settings.all_install_stores();
    let plan = plan_uninstall(
        PlanInputs { machine: &LocalMachine, view: view_a, all: &views, catalog: None, stores: &stores, scan_roots: &[], protected: &[], profiles: &[], other_tool_roots: &[] },
        &WinUsageProbe,
    )
    .unwrap();
    assert!(matches!(&plan.method, UninstallMethod::Managed { store, .. } if crate::whichcraft::tools::paths_equal(store, a.path())), "{:?}", plan.method);
    assert_eq!(
        uninstall(&plan, None, &WinregBackend, &FileStore, &LocalMachine, &WinElevator, &WinUsageProbe, &WinUninstaller).unwrap(),
        UninstallOutcome::Removed
    );
    assert!(!in_a.exists());
    assert!(in_b.join("node.exe").is_file(), "store B is untouched");
}

fn folder_bytes(dir: &std::path::Path) -> u64 {
    std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() && !t.is_symlink() => folder_bytes(&e.path()),
            Ok(t) if t.is_file() => e.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}

/// I-1, I-8, I-9, R-1 for Flutter: the vfox plugin is installed at the pinned commit, a stable
/// Flutter installs into a temporary store, runs, is listed once, and uninstalls cleanly.
/// Downloads about 1.9 GB and unpacks about 3.3 GB.
#[test]
#[ignore = "contract: downloads mise, the vfox-flutter plugin and Flutter (about 1.9 GB) into temporary folders"]
fn contract_flutter_installs_through_the_pinned_plugin_and_uninstalls() {
    use crate::whichcraft::adapters::win::uninstall::{WinUninstaller, WinUsageProbe};
    use crate::whichcraft::mise::manager::ProcessMiseRunner;
    use crate::whichcraft::mise::pins::VFOX_FLUTTER_PLUGIN_SHA;
    use crate::whichcraft::mise::MiseToolManager;
    use crate::whichcraft::persistence::{load_settings, save_settings};
    use crate::whichcraft::adapters::win::elevation::WinElevator;
    use crate::whichcraft::services::tool_inventory::list_tool_installations;
    use crate::whichcraft::services::uninstall::{plan_uninstall, uninstall, PlanInputs};
    use crate::whichcraft::domain::uninstall::{UninstallOutcome};

    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let store = tempfile::tempdir().unwrap();
    let mut settings = load_settings().unwrap();
    settings.install_store = store.path().to_path_buf();
    save_settings(&settings).unwrap();
    let user_before = WinregBackend.read_user().unwrap();
    let system_before = WinregBackend.read_system().unwrap();
    let mgr = MiseToolManager::with_runner(ProcessMiseRunner::for_store(store.path()));

    // Listing remote versions installs the plugin first, at the pinned commit.
    let version = newest_remote(&mgr, ToolKind::Flutter, "3.32.");
    let plugin = store.path().join("_mise").join("data").join("plugins").join("vfox-jdx-vfox-flutter");
    let head = std::process::Command::new("git").arg("-C").arg(&plugin).args(["rev-parse", "HEAD"]).output().unwrap();
    assert_eq!(String::from_utf8_lossy(&head.stdout).trim(), VFOX_FLUTTER_PLUGIN_SHA, "plugin at {}", plugin.display());

    let started = std::time::Instant::now();
    let root = mgr.install(ToolKind::Flutter, &version).unwrap();
    println!("Flutter {version} at {} in {:?}, {:.2} GB on disk", root.display(), started.elapsed(), folder_bytes(&root) as f64 / 1e9);
    let listed_before_first_run = list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), ToolKind::Flutter, None)
        .unwrap()
        .iter()
        .any(|v| v.installation.root.starts_with(store.path()));
    println!("listed before Flutter's first run: {listed_before_first_run}");

    let dart = root.join("bin").join("cache").join("dart-sdk").join("bin").join("dart.exe");
    let out = std::process::Command::new(&dart).arg("--version").output().unwrap();
    println!("dart: {}", String::from_utf8_lossy(&out.stdout).trim());
    assert!(out.status.success());
    let out = std::process::Command::new(root.join("bin").join("flutter.bat"))
        .args(["--version", "--suppress-analytics"])
        .output()
        .unwrap();
    let said = String::from_utf8_lossy(&out.stdout);
    println!("flutter: {}", said.lines().next().unwrap_or(""));
    assert!(out.status.success(), "{said}{}", String::from_utf8_lossy(&out.stderr));
    assert!(said.contains(version.trim_end_matches("-stable")), "{said}");

    let views = list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), ToolKind::Flutter, None).unwrap();
    let ours: Vec<_> = views.iter().filter(|v| v.installation.root.starts_with(store.path())).collect();
    println!("listed: {:?}", ours.iter().map(|v| &v.installation.version).collect::<Vec<_>>());
    assert_eq!(ours.len(), 1, "listed once");
    println!("before uninstall: {:?}", leftovers(store.path(), ToolKind::Flutter));

    let stores = settings.all_install_stores();
    let plan = plan_uninstall(
        PlanInputs { machine: &LocalMachine, view: ours[0], all: &views, catalog: None, stores: &stores, scan_roots: &[], protected: &[], profiles: &[], other_tool_roots: &[] },
        &WinUsageProbe,
    )
    .unwrap();
    let outcome = uninstall(&plan, None, &WinregBackend, &FileStore, &LocalMachine, &WinElevator, &WinUsageProbe, &WinUninstaller).unwrap();
    let left = leftovers(store.path(), ToolKind::Flutter);
    println!("after uninstall: {outcome:?} {left:?}");
    assert_eq!(outcome, UninstallOutcome::Removed);
    assert!(left.iter().all(|p| p.ends_with(".msgpack.z")), "{left:?}");
    assert!(same_values(&WinregBackend.read_user().unwrap(), &user_before));
    assert!(same_values(&WinregBackend.read_system().unwrap(), &system_before));
}

/// I-17: mise never moves the plugin by itself, even when upstream is ahead and the checkout is
/// a month old; and before installing, Whichcraft puts a plugin at any other commit back on the pin.
/// Downloads mise and the plugin (no Flutter).
#[test]
#[ignore = "contract: downloads mise and the vfox-flutter plugin into temporary folders"]
fn contract_flutter_plugin_stays_on_the_pin_over_time() {
    use crate::whichcraft::mise::manager::{MiseRunner, ProcessMiseRunner};
    use crate::whichcraft::mise::pins::VFOX_FLUTTER_PLUGIN_SHA;
    use crate::whichcraft::mise::MiseToolManager;

    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let store = tempfile::tempdir().unwrap();
    let mgr = MiseToolManager::with_runner(ProcessMiseRunner::for_store(store.path()));
    mgr.ensure_flutter_plugin().unwrap();
    let plugin = store.path().join("_mise").join("data").join("plugins").join("vfox-jdx-vfox-flutter");
    let git = |args: &[&str]| {
        let out = std::process::Command::new("git").arg("-C").arg(&plugin).args(args).output().unwrap();
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    };
    assert_eq!(git(&["rev-parse", "HEAD"]), VFOX_FLUTTER_PLUGIN_SHA);

    // Put the checkout behind upstream and make everything mise wrote a month old.
    let older = git(&["rev-parse", "HEAD~3"]);
    git(&["-c", "advice.detachedHead=false", "checkout", "-q", &older]);
    let month_ago = std::time::SystemTime::now() - std::time::Duration::from_secs(30 * 24 * 3600);
    fn backdate(dir: &std::path::Path, when: std::time::SystemTime) {
        for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
            let path = entry.path();
            if path.is_dir() {
                backdate(&path, when);
            } else if let Ok(f) = std::fs::OpenOptions::new().write(true).open(&path) {
                let _ = f.set_modified(when);
            }
        }
    }
    backdate(&store.path().join("_mise"), month_ago);

    let runner = ProcessMiseRunner::for_store(store.path());
    assert!(runner.run(&["ls-remote", "vfox:jdx/vfox-flutter"]).unwrap().success);
    assert_eq!(git(&["rev-parse", "HEAD"]), older, "mise moved the plugin by itself");

    mgr.ensure_flutter_plugin().unwrap();
    assert_eq!(git(&["rev-parse", "HEAD"]), VFOX_FLUTTER_PLUGIN_SHA, "Whichcraft puts it back on the pin");
}

/// The mise an earlier Whichcraft pinned, for the app-update test (SHASUMS256.txt of the release).
const OLD_MISE: &str = "2026.9.18";
const OLD_MISE_ZIP_SHA256: &str = "0436007827b3594fb3494164065ddeed87974c68c7e394d09ef87c962fa4c2ac";

/// Ticket 17, I-14, I-15: after an app update, Node installed by the previous pin's mise is
/// listed; while the new mise is missing, maintenance uses the old one without downloading;
/// preparing fetches the new one and removes the old; the new one uninstalls what the old installed.
#[test]
#[ignore = "contract: downloads two mise versions and Node into temporary folders"]
fn contract_install_with_old_mise_and_uninstall_with_the_new_one() {
    use crate::whichcraft::adapters::win::uninstall::{WinUninstaller, WinUsageProbe};
    use crate::whichcraft::mise::manager::{mise_status, prepare_mise, ProcessMiseRunner};
    use crate::whichcraft::mise::pins::MISE_VERSION;
    use crate::whichcraft::mise::MiseToolManager;
    use crate::whichcraft::persistence::{load_settings, save_settings, whichcraft_data_dir};
    use crate::whichcraft::adapters::win::elevation::WinElevator;
    use crate::whichcraft::services::tool_inventory::list_tool_installations;
    use crate::whichcraft::services::uninstall::{plan_uninstall, uninstall, PlanInputs};
    use crate::whichcraft::domain::uninstall::{UninstallOutcome};
    use sha2::{Digest, Sha256};

    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let store = tempfile::tempdir().unwrap();
    let mut settings = load_settings().unwrap();
    settings.install_store = store.path().to_path_buf();
    save_settings(&settings).unwrap();

    // What an earlier Whichcraft left: its verified mise in its own version folder.
    let url = format!("https://github.com/jdx/mise/releases/download/v{OLD_MISE}/mise-v{OLD_MISE}-windows-x64.zip");
    let zip = reqwest::blocking::get(&url).unwrap().bytes().unwrap().to_vec();
    assert_eq!(format!("{:x}", Sha256::digest(&zip)), OLD_MISE_ZIP_SHA256);
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(zip)).unwrap();
    let mut exe = Vec::new();
    std::io::Read::read_to_end(&mut archive.by_name("mise/bin/mise.exe").unwrap(), &mut exe).unwrap();
    let mise_root = whichcraft_data_dir().unwrap().join("mise");
    let old_dir = mise_root.join(OLD_MISE);
    std::fs::create_dir_all(&old_dir).unwrap();
    std::fs::write(old_dir.join("mise.exe"), exe).unwrap();
    let pinned_dir = mise_root.join(MISE_VERSION.trim_start_matches('v'));

    let status = mise_status().unwrap();
    assert!(!status.present);
    assert_eq!(status.old_versions, vec![OLD_MISE.to_string()]);

    // Installed by the old mise (a maintenance runner uses it while the new one is missing).
    let root = MiseToolManager::with_runner(ProcessMiseRunner::for_maintenance(store.path()))
        .install(ToolKind::Node, "22.12.0")
        .unwrap();
    assert!(!pinned_dir.exists(), "nothing downloaded: the old mise did the work");
    assert!(root.join("node.exe").is_file());
    assert!(list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), ToolKind::Node, None).unwrap().iter().any(|v| v.installation.root == root));

    // The app update's background step: fetch the new pin, verify it, drop the old one.
    assert!(prepare_mise().unwrap());
    assert!(pinned_dir.join("mise.exe").is_file());
    assert!(!old_dir.exists());
    assert!(mise_status().unwrap().old_versions.is_empty());

    // The new mise removes what the old one installed.
    let views = list_tool_installations(&WinregBackend, &FileStore, &LocalMachine, &FakeInstallerCatalog::default(), ToolKind::Node, None).unwrap();
    let view = views.iter().find(|v| v.installation.root == root).expect("still listed after the update");
    let stores = settings.all_install_stores();
    let plan = plan_uninstall(
        PlanInputs { machine: &LocalMachine, view, all: &views, catalog: None, stores: &stores, scan_roots: &[], protected: &[], profiles: &[], other_tool_roots: &[] },
        &WinUsageProbe,
    )
    .unwrap();
    assert_eq!(
        uninstall(&plan, None, &WinregBackend, &FileStore, &LocalMachine, &WinElevator, &WinUsageProbe, &WinUninstaller).unwrap(),
        UninstallOutcome::Removed
    );
    assert!(!root.exists());
}

/// A-2 and U-1 for System scope: the write goes through UAC to the app's elevated helper (two UAC
/// prompts: apply, then Undo). Needs `cargo build` first so target\debug\whichcraft.exe is current.
#[test]
#[ignore = "contract: writes WHICHCRAFT_TEST_SYSTEM to HKLM through two UAC prompts"]
fn contract_system_apply_through_uac_and_undo_restores_the_key() {
    use crate::whichcraft::adapters::win::elevation::HelperExeElevator;
    let data = tempfile::tempdir().unwrap();
    use_test_data_dir(data.path());
    let helper = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target").join("debug").join("whichcraft.exe");
    assert!(helper.is_file(), "build the app first: {}", helper.display());
    let elevator = HelperExeElevator(helper);
    let before = WinregBackend.read_system().unwrap();
    let (name, value) = unique("SYSTEM");

    let plan = set_variable_plan(VarScope::System, &name, &value);
    let result = apply_tool_plan_elevated(&WinregBackend, &FileStore, &elevator, &plan).unwrap();
    assert!(!result.stale && !result.needs_elevation, "{result:?}");
    assert_eq!(WinregBackend.read_system().unwrap()[&name].value, value);
    assert_eq!(fresh_environment().unwrap().get(&name), Some(&value), "a process started now gets it");

    let undo = undo_last_apply(&WinregBackend, &FileStore, Some(&elevator)).unwrap();
    assert!(undo.conflicts.is_empty(), "{:?}", undo.conflicts);
    assert!(same_values(&WinregBackend.read_system().unwrap(), &before), "System Environment is back as it was");
}
