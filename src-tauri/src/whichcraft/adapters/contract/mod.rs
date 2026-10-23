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
