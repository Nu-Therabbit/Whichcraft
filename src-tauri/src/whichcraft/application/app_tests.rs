//! The use cases end to end on fakes: no disk, no registry, no network, no UAC.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::app::App;
use crate::env_store::{EnvBackend, MemBackend};
use crate::whichcraft::domain::profiles::{ProfileToolPin, ToolProfile};
use crate::whichcraft::domain::selection::ToolSelection;
use crate::whichcraft::domain::settings::WhichcraftSettings;
use crate::whichcraft::domain::uninstall::UninstallOutcome;
use crate::whichcraft::domain::{ToolInstallation, ToolKind};
use crate::whichcraft::fake::{
    CountingCatalogs, DeclinesUac, FakeInstallerLifecycle, FakeMachine, FakeOperationIds, FakeProcessRunner, FakeToolManagers, FakeTools,
    FakeUsageProbe, MachineUninstaller, MemStore, NoInstallerEntries, NoSdks,
};

const STORE: &str = r"C:\Users\me\AppData\Local\Whichcraft\installs";

struct World {
    app: App<MemBackend>,
    machine: Arc<FakeMachine>,
    tools: Arc<FakeTools>,
    processes: Arc<FakeProcessRunner>,
}

fn world(user_path: &'static str, confirmed: bool) -> World {
    let machine = Arc::new(FakeMachine::default());
    machine.set_var("USERPROFILE", r"C:\Users\me");
    let tools = FakeTools::with_machine(machine.clone());
    let processes = Arc::new(FakeProcessRunner::default());
    let store = MemStore::default();
    // Folders off PATH are found through a scan root, as on a real machine.
    *store.settings.lock().unwrap() = WhichcraftSettings {
        install_store: STORE.into(),
        install_store_confirmed: confirmed,
        scan_roots: vec![PathBuf::from(r"C:\nodes")],
        ..Default::default()
    };
    let app = App {
        env: MemBackend::new().with_user([("Path", user_path)]).with_system([("PATHEXT", ".COM;.EXE;.BAT;.CMD")]),
        store: Box::new(store),
        machine: Box::new(machine.clone()),
        catalogs: Box::new(NoInstallerEntries),
        tools: Box::new(FakeToolManagers(tools.clone())),
        elevator: Box::new(DeclinesUac),
        usage: Box::new(FakeUsageProbe::default()),
        uninstaller: Box::new(MachineUninstaller(machine.clone())),
        sdk: Box::new(NoSdks),
        processes: Box::new(processes.clone()),
        ids: Box::new(FakeOperationIds::fixed(
            "apply-test-fixed-id",
            "uninstall-test-fixed-id",
            "2025-06-01T12:00:00+00:00",
        )),
        installer_lifecycle: Box::new(FakeInstallerLifecycle::ready("2025.3.6")),
    };
    World { app, machine, tools, processes }
}

fn world_with_lifecycle(lifecycle: FakeInstallerLifecycle) -> World {
    let mut w = world(r"C:\u", true);
    w.app.installer_lifecycle = Box::new(lifecycle);
    w
}

fn node(version: &str, root: &str) -> ToolInstallation {
    ToolInstallation { tool: ToolKind::Node, vendor: "Node.js".into(), version: version.into(), root: root.into(), managed: false }
}

fn user_path(app: &App<MemBackend>) -> String {
    app.env.read_user().unwrap()["Path"].value.clone()
}

#[test]
fn plans_and_journals_use_injected_ids_and_timestamps() {
    let w = world(r"C:\u", true);
    w.machine.add_install(node("20.19.0", r"C:\nodes\node20"));
    let plan = w.app.plan_switch(ToolKind::Node, Path::new(r"C:\nodes\node20")).unwrap();
    assert_eq!(plan.plan_id, "apply-test-fixed-id");
    w.app.apply(&plan, false).unwrap();
    let journal = w.app.store.journal("apply-test-fixed-id").unwrap();
    assert_eq!(journal.created_at, "2025-06-01T12:00:00+00:00");

    let cleanup = w.app.plan_path_cleanup().unwrap();
    assert_eq!(cleanup.inner.plan_id, "apply-test-fixed-id");
}

#[test]
fn switching_tools_writes_user_path_remembers_the_choice_and_undoes() {
    let w = world(r"C:\nodes\node20;C:\u", true);
    w.machine.add_install(node("20.19.0", r"C:\nodes\node20"));
    w.machine.add_install(node("22.23.4", r"C:\nodes\node22"));

    let listed = w.app.list_tools(ToolKind::Node).unwrap();
    assert_eq!(listed.len(), 2);
    assert!(listed.iter().find(|v| v.installation.version == "20.19.0").unwrap().effective);

    let plan = w.app.plan_switch(ToolKind::Node, Path::new(r"C:\nodes\node22")).unwrap();
    assert!(!w.app.apply(&plan, false).unwrap().stale);
    assert_eq!(user_path(&w.app), r"C:\nodes\node22;C:\u", "the old node leaves PATH with the switch");
    assert_eq!(w.app.store.selection(ToolKind::Node).unwrap().unwrap().root, PathBuf::from(r"C:\nodes\node22"));
    let after = w.app.list_tools(ToolKind::Node).unwrap();
    let chosen = after.iter().find(|v| v.installation.version == "22.23.4").unwrap();
    assert!(chosen.effective && chosen.selected);

    w.app.undo().unwrap();
    assert_eq!(user_path(&w.app), r"C:\nodes\node20;C:\u");
}

#[test]
fn a_vanished_selection_is_still_listed_as_unavailable() {
    let w = world(r"C:\u", true);
    w.app
        .store
        .save_selection(&ToolSelection { tool: ToolKind::Node, root: r"C:\gone\node18".into(), vendor: "Node.js".into(), version: "18.20.0".into() })
        .unwrap();
    let listed = w.app.list_tools(ToolKind::Node).unwrap();
    assert_eq!(listed.len(), 1);
    assert!(listed[0].selected && !listed[0].available);
}

#[test]
fn nothing_installs_until_the_install_folder_is_confirmed() {
    let w = world(r"C:\u", false);
    let err = w.app.install(ToolKind::Node, "22.24.0").unwrap_err();
    assert!(err.to_string().contains("Choose where"));
    assert!(w.tools.installed.lock().unwrap().is_empty());

    w.app.save_settings(WhichcraftSettings { install_store: STORE.into(), install_store_confirmed: true, ..Default::default() }).unwrap();
    let root = w.app.install(ToolKind::Node, "22.24.0").unwrap();
    assert!(root.starts_with(STORE));
    let listed = w.app.list_tools(ToolKind::Node).unwrap();
    assert!(listed.iter().any(|v| v.installation.root == root && v.installation.managed));
}

#[test]
fn updating_installs_beside_the_old_version_and_plans_the_switch() {
    let w = world(r"C:\nodes\node22;C:\u", true);
    w.machine.add_install(node("22.13.0", r"C:\nodes\node22"));
    w.tools.offer(ToolKind::Node, &["22.13.0", "22.24.0", "24.1.0"]);

    let candidates = w.app.update_candidates(ToolKind::Node).unwrap();
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].latest, "22.24.0");

    let update = w.app.update(ToolKind::Node, "22.24.0").unwrap();
    assert!(update.installation.root.starts_with(STORE));
    w.app.apply(&update.plan, false).unwrap();
    let listed = w.app.list_tools(ToolKind::Node).unwrap();
    assert!(listed.iter().find(|v| v.installation.version == "22.24.0").unwrap().effective);
    assert!(listed.iter().any(|v| v.installation.version == "22.13.0"), "the old version stays installed (P-1)");
}

#[test]
fn a_profile_installs_what_it_misses_then_plans_one_switch() {
    let w = world(r"C:\u", true);
    w.tools.offer(ToolKind::Node, &["20.19.0", "22.23.4"]);
    w.tools.download_bytes.lock().unwrap().insert("20.19.0".into(), 30_000_000);
    let profile = ToolProfile {
        id: "a".into(),
        name: "Android work".into(),
        tools: vec![ProfileToolPin { tool: ToolKind::Node, vendor: "Node.js".into(), version: "20.19.0".into(), preferred_root: None }],
    };

    let missing = w.app.profile_missing(&profile).unwrap();
    assert_eq!(missing[0].install_version.as_deref(), Some("20.19.0"));
    assert_eq!(missing[0].download_bytes, Some(30_000_000));

    w.app.install_missing(&profile).unwrap();
    assert!(w.app.profile_missing(&profile).unwrap().is_empty());
    let plan = w.app.plan_profile(&profile).unwrap();
    assert_eq!(plan.plan_id, "apply-test-fixed-id");
    assert!(plan.selected.root.starts_with(STORE));
}

#[test]
fn removing_a_managed_install_goes_through_its_store_and_is_journaled() {
    let w = world(r"C:\u", true);
    let root = w.app.install(ToolKind::Node, "22.24.0").unwrap();

    let plan = w.app.plan_uninstall(ToolKind::Node, &root).unwrap();
    assert!(!plan.needs_replacement);
    let outcome = w.app.uninstall(ToolKind::Node, &root, None).unwrap();
    assert_eq!(outcome, UninstallOutcome::Removed);
    assert!(w.app.list_tools(ToolKind::Node).unwrap().is_empty());
    let records = w.app.store.uninstall_records().unwrap();
    assert_eq!(records[0].id, "uninstall-test-fixed-id");
    assert_eq!(records[0].started_at, "2025-06-01T12:00:00+00:00");
    assert_eq!(records[0].outcome, Some(UninstallOutcome::Removed));
    assert!(w.app.unfinished_uninstalls().unwrap().is_empty());
}

#[test]
fn installs_and_uninstalls_read_the_installer_catalog_afresh() {
    let mut w = world(r"C:\u", true);
    let catalogs = Arc::new(CountingCatalogs::default());
    w.app.catalogs = Box::new(catalogs.clone());
    let count = || catalogs.invalidations.load(std::sync::atomic::Ordering::SeqCst);

    let root = w.app.install(ToolKind::Node, "22.24.0").unwrap();
    assert_eq!(count(), 1, "after an install");
    w.app.list_tools(ToolKind::Node).unwrap();
    assert_eq!(count(), 1, "listing reuses the snapshot");
    w.app.list_tools_with_refresh(ToolKind::Node, true).unwrap();
    assert_eq!(count(), 2, "explicit Rescan bypasses a recent installer catalog");
    w.app.list_tools(ToolKind::Node).unwrap();
    assert_eq!(count(), 2, "the remaining tools reuse the refreshed snapshot");
    w.app.uninstall(ToolKind::Node, &root, None).unwrap();
    assert!(count() >= 4, "before planning the removal and after it: {}", count());
}

#[test]
fn a_folder_holding_another_tool_off_path_is_not_recycled() {
    use crate::whichcraft::domain::uninstall::UninstallMethod;
    let w = world(r"C:\jdk\bin;C:\u", true);
    let jdk = ToolInstallation { tool: ToolKind::Java, vendor: "Eclipse Adoptium".into(), version: "21.0.12".into(), root: r"C:\jdk".into(), managed: false };
    w.machine.add_install(jdk.clone());
    w.machine.add_install(ToolInstallation { tool: ToolKind::Python, vendor: "Python".into(), version: "3.14.0".into(), root: r"C:\jdk\tools\python".into(), managed: false });
    assert!(w.app.list_tools(ToolKind::Python).unwrap().is_empty(), "the inner Python is neither on PATH nor under a scan root");

    let plan = w.app.plan_uninstall(ToolKind::Java, &jdk.root).unwrap();
    assert!(matches!(&plan.method, UninstallMethod::Refused { reason } if reason.contains(r"C:\jdk\tools\python")), "{:?}", plan.method);
}

#[test]
fn the_terminal_opens_in_the_home_folder_with_the_fresh_environment() {
    let w = world(r"C:\u", true);
    w.app.open_terminal().unwrap();
    let spawned = w.processes.spawned.lock().unwrap();
    assert_eq!(spawned[0].program, "wt.exe");
    assert_eq!(spawned[0].cwd, PathBuf::from(r"C:\Users\me"));
    drop(spawned);
    w.app.open_folder(Path::new(r"C:\Users\me")).unwrap();
    assert_eq!(*w.processes.opened.lock().unwrap(), vec![PathBuf::from(r"C:\Users\me")]);
}

#[test]
fn flutter_downloads_come_with_a_disk_estimate() {
    let w = world(r"C:\u", true);
    w.tools.download_bytes.lock().unwrap().insert("3.32.8".into(), 1_749_058_829);
    let size = w.app.download_size(ToolKind::Flutter, "3.32.8").unwrap();
    assert_eq!(size.download_bytes, Some(1_749_058_829));
    assert!(size.disk_bytes.unwrap() > 3_000_000_000);
    assert_eq!(w.app.download_size(ToolKind::Node, "22.24.0").unwrap().disk_bytes, None);
}

#[test]
fn mise_status_and_prepare_go_through_the_application_port() {
    let w = world_with_lifecycle(FakeInstallerLifecycle::needs_download("2025.3.6", 230_000_000));
    let status = w.app.mise_status().unwrap();
    assert!(!status.present);
    assert_eq!(status.download_bytes, 230_000_000);
    assert!(w.app.prepare_mise().unwrap());

    let offline = world_with_lifecycle(FakeInstallerLifecycle::offline());
    assert!(offline.app.mise_status().is_err());
    assert!(offline.app.prepare_mise().is_err());

    let failed = world_with_lifecycle(FakeInstallerLifecycle::prepare_fails("2025.3.6"));
    assert!(!failed.app.mise_status().unwrap().present);
    let err = failed.app.prepare_mise().unwrap_err();
    assert!(err.to_string().contains("checksum"));
}

#[test]
fn app_start_and_install_list_still_see_mise_when_it_is_ready() {
    let w = world_with_lifecycle(FakeInstallerLifecycle::ready("2025.3.6"));
    let status = w.app.mise_status().unwrap();
    assert!(status.present);
    assert!(!status.fetching);
    assert!(!w.app.prepare_mise().unwrap(), "nothing left to fetch when mise is already present");

    w.tools.offer(ToolKind::Node, &["22.24.0", "24.1.0"]);
    let versions = w.app.remote_versions(ToolKind::Node).unwrap();
    assert_eq!(versions.len(), 2);
    let offered: Vec<_> = versions.iter().map(|v| v.version.as_str()).collect();
    assert!(offered.contains(&"22.24.0") && offered.contains(&"24.1.0"));
}

#[test]
fn the_sdk_inventory_reports_nothing_when_nothing_is_there() {
    let w = world(r"C:\u", true);
    let python = w.app.python_supplemental().unwrap();
    assert!(!python.launcher_installed && python.store_stub.is_none());
    assert!(w.app.msvc_inventory().instances.is_empty());
    assert_eq!(w.app.android_inventory().unwrap().sdk_root, None);
}
