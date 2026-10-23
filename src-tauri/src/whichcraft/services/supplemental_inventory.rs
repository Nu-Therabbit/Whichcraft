//! Read-only inventory (ticket 08): Android SDK pieces, MSVC and Windows SDK, and what the
//! Python launcher and the Store alias would run. Nothing here can be selected or installed.

use crate::whichcraft::ports::machine::Machine;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::domain::env::get_var;

// ---------------------------------------------------------------------------
// Python launcher
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PythonLauncherLine {
    /// The launcher's tag, e.g. `3.14[-64]`.
    pub tag: String,
    pub path: String,
    /// Marked with `*`: what a bare `py` runs.
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonSupplementalView {
    /// `py -0p`, or empty when the launcher is not installed.
    pub launcher_lines: Vec<PythonLauncherLine>,
    pub launcher_installed: bool,
    /// The Microsoft Store alias `python.exe`, when present.
    pub store_stub: Option<String>,
    pub note: String,
}

/// Parses `py -0p` lines such as ` -V:3.14[-64] *        C:\…\python.exe`.
pub fn parse_py_list(output: &str) -> Vec<PythonLauncherLine> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let rest = line.strip_prefix("-V:").or_else(|| line.strip_prefix('-'))?;
            let mut parts = rest.split_whitespace();
            let tag = parts.next()?.to_string();
            let mut is_default = false;
            let mut path_parts = Vec::new();
            for p in parts {
                if p == "*" && path_parts.is_empty() {
                    is_default = true;
                } else {
                    path_parts.push(p);
                }
            }
            let path = path_parts.join(" ");
            (!path.is_empty()).then_some(PythonLauncherLine { tag, path, is_default })
        })
        .collect()
}

pub fn python_supplemental() -> Result<PythonSupplementalView, EnvarlyError> {
    let output = std::process::Command::new("py").arg("-0p").output();
    let (launcher_installed, launcher_lines) = match output {
        Ok(o) => (true, parse_py_list(&String::from_utf8_lossy(&o.stdout))),
        Err(_) => (false, Vec::new()),
    };
    let store_stub = std::env::var_os("LOCALAPPDATA")
        .map(|l| PathBuf::from(l).join("Microsoft").join("WindowsApps").join("python.exe"))
        .filter(|p| std::fs::symlink_metadata(p).is_ok())
        .map(|p| p.to_string_lossy().into_owned());
    Ok(PythonSupplementalView {
        launcher_lines,
        launcher_installed,
        store_stub,
        note: "Whichcraft switches only `python` on PATH. The `py` launcher picks from interpreters registered with Windows and does not see Python that Whichcraft installs.".into(),
    })
}

// ---------------------------------------------------------------------------
// Android SDK
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AndroidInventory {
    pub sdk_root: Option<String>,
    /// Where the root came from: `ANDROID_HOME`, `ANDROID_SDK_ROOT` or the default folder.
    pub root_source: Option<String>,
    pub platforms: Vec<String>,
    pub build_tools: Vec<String>,
    pub ndk: Vec<String>,
    pub platform_tools: Option<String>,
    pub emulator: Option<String>,
    pub cmake: Vec<String>,
}

fn subdirs(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .map(|r| {
            r.flatten()
                .filter(|e| e.path().is_dir())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    names
}

/// `Pkg.Revision` from an SDK component's `source.properties`.
fn pkg_revision(component: &Path) -> Option<String> {
    let text = std::fs::read_to_string(component.join("source.properties")).ok()?;
    text.lines()
        .find_map(|l| l.strip_prefix("Pkg.Revision="))
        .map(|v| v.trim().to_string())
}

/// What is installed under an Android SDK root.
pub fn read_android_sdk(root: &Path) -> AndroidInventory {
    AndroidInventory {
        sdk_root: Some(root.to_string_lossy().into_owned()),
        root_source: None,
        platforms: subdirs(&root.join("platforms")),
        build_tools: subdirs(&root.join("build-tools")),
        ndk: subdirs(&root.join("ndk")),
        platform_tools: pkg_revision(&root.join("platform-tools")),
        emulator: pkg_revision(&root.join("emulator")),
        cmake: subdirs(&root.join("cmake")),
    }
}

/// The SDK named by ANDROID_HOME/ANDROID_SDK_ROOT in the registry environment, else Android
/// Studio's default `%LOCALAPPDATA%\Android\Sdk` (the survey machine sets neither variable).
pub fn android_inventory<B: EnvBackend>(
    backend: &B,
    machine: &dyn Machine,
    local_app_data: Option<&Path>,
) -> Result<AndroidInventory, EnvarlyError> {
    let user = backend.read_user()?;
    let system = backend.read_system()?;
    let expand = crate::whichcraft::services::registry_expander(&user, &system, machine);
    for name in ["ANDROID_HOME", "ANDROID_SDK_ROOT"] {
        if let Some(v) = get_var(&user, name).or_else(|| get_var(&system, name)) {
            let root = PathBuf::from(expand(&v.value));
            if root.is_dir() {
                return Ok(AndroidInventory {
                    root_source: Some(name.into()),
                    ..read_android_sdk(&root)
                });
            }
        }
    }
    if let Some(root) = local_app_data.map(|l| l.join("Android").join("Sdk")).filter(|r| r.is_dir()) {
        return Ok(AndroidInventory {
            root_source: Some("default".into()),
            ..read_android_sdk(&root)
        });
    }
    Ok(AndroidInventory::default())
}

// ---------------------------------------------------------------------------
// MSVC and Windows SDK
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VisualStudioInstance {
    pub display_name: String,
    pub version: String,
    pub path: String,
    /// `VC\Tools\MSVC\<version>` folders.
    pub msvc_toolsets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct MsvcInventory {
    pub instances: Vec<VisualStudioInstance>,
    /// `Include\<version>` folders under the Windows 10/11 SDK root.
    pub windows_sdks: Vec<String>,
}

/// Parses `vswhere -products * -format json`.
pub fn parse_vswhere(json: &str) -> Vec<(String, String, String)> {
    let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(json) else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|i| {
            Some((
                i.get("displayName")?.as_str()?.to_string(),
                i.get("installationVersion")?.as_str()?.to_string(),
                i.get("installationPath")?.as_str()?.to_string(),
            ))
        })
        .collect()
}

pub fn msvc_toolsets(installation_path: &Path) -> Vec<String> {
    subdirs(&installation_path.join("VC").join("Tools").join("MSVC"))
}

pub fn windows_sdk_versions(kits_root: &Path) -> Vec<String> {
    subdirs(&kits_root.join("Include"))
        .into_iter()
        .filter(|v| v.starts_with("10."))
        .collect()
}

pub fn msvc_inventory() -> MsvcInventory {
    let vswhere = std::env::var_os("ProgramFiles(x86)")
        .map(|p| PathBuf::from(p).join("Microsoft Visual Studio").join("Installer").join("vswhere.exe"));
    let instances = vswhere
        .filter(|p| p.is_file())
        .and_then(|exe| {
            std::process::Command::new(exe)
                .args(["-products", "*", "-format", "json", "-utf8"])
                .output()
                .ok()
        })
        .map(|o| parse_vswhere(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default()
        .into_iter()
        .map(|(display_name, version, path)| VisualStudioInstance {
            msvc_toolsets: msvc_toolsets(Path::new(&path)),
            display_name,
            version,
            path,
        })
        .collect();
    MsvcInventory {
        instances,
        windows_sdks: windows_kits_root()
            .map(|r| windows_sdk_versions(&r))
            .unwrap_or_default(),
    }
}

#[cfg(windows)]
fn windows_kits_root() -> Option<PathBuf> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    let key = winreg::RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows Kits\Installed Roots")
        .ok()?;
    key.get_value::<String, _>("KitsRoot10").ok().map(PathBuf::from)
}

#[cfg(not(windows))]
fn windows_kits_root() -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use crate::whichcraft::adapters::local::LocalMachine;
    use super::*;
    use crate::env_store::MemBackend;

    #[test]
    fn py_list_lines_become_tags_and_paths() {
        let out = " -V:3.14[-64] *        C:\\Users\\me\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe\n -V:3.12          C:\\Program Files\\Python312\\python.exe\n";
        let lines = parse_py_list(out);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].tag, "3.14[-64]");
        assert!(lines[0].is_default);
        assert!(lines[0].path.ends_with("pythoncore-3.14-64\\python.exe"));
        assert_eq!(lines[1].path, "C:\\Program Files\\Python312\\python.exe");
        assert!(!lines[1].is_default);
    }

    fn fake_sdk(root: &Path) {
        for d in ["platforms/android-34", "platforms/android-36.1", "build-tools/35.0.0", "ndk/27.0.12077973", "cmake/3.22.1"] {
            std::fs::create_dir_all(root.join(d)).unwrap();
        }
        for (d, rev) in [("platform-tools", "37.0.1"), ("emulator", "37.2.12")] {
            std::fs::create_dir_all(root.join(d)).unwrap();
            std::fs::write(root.join(d).join("source.properties"), format!("Pkg.Desc=x\nPkg.Revision={rev}\n")).unwrap();
        }
    }

    #[test]
    fn android_sdk_contents_are_listed() {
        let dir = tempfile::tempdir().unwrap();
        fake_sdk(dir.path());
        let inv = read_android_sdk(dir.path());
        assert_eq!(inv.platforms, vec!["android-34", "android-36.1"]);
        assert_eq!(inv.build_tools, vec!["35.0.0"]);
        assert_eq!(inv.ndk, vec!["27.0.12077973"]);
        assert_eq!(inv.platform_tools.as_deref(), Some("37.0.1"));
        assert_eq!(inv.emulator.as_deref(), Some("37.2.12"));
        assert_eq!(inv.cmake, vec!["3.22.1"]);
    }

    #[test]
    fn without_android_variables_the_default_sdk_folder_is_used() {
        let local = tempfile::tempdir().unwrap();
        fake_sdk(&local.path().join("Android").join("Sdk"));
        let inv = android_inventory(&MemBackend::new(), &LocalMachine, Some(local.path())).unwrap();
        assert_eq!(inv.root_source.as_deref(), Some("default"));
        assert_eq!(inv.ndk, vec!["27.0.12077973"]);
    }

    #[test]
    fn android_home_in_the_registry_wins_over_the_default() {
        let sdk = tempfile::tempdir().unwrap();
        fake_sdk(sdk.path());
        let value: &'static str = Box::leak(sdk.path().to_string_lossy().into_owned().into_boxed_str());
        let backend = MemBackend::new().with_user([("ANDROID_HOME", value)]);
        let inv = android_inventory(&backend, &LocalMachine, None).unwrap();
        assert_eq!(inv.root_source.as_deref(), Some("ANDROID_HOME"));
        assert_eq!(inv.platforms.len(), 2);
    }

    #[test]
    fn vswhere_json_and_msvc_folders_are_read() {
        let json = r#"[{"displayName":"Visual Studio Build Tools 2022","installationVersion":"17.14.42","installationPath":"C:\\BT"}]"#;
        assert_eq!(
            parse_vswhere(json),
            vec![("Visual Studio Build Tools 2022".into(), "17.14.42".into(), "C:\\BT".into())]
        );
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("VC/Tools/MSVC/14.44.35207")).unwrap();
        assert_eq!(msvc_toolsets(dir.path()), vec!["14.44.35207"]);
        std::fs::create_dir_all(dir.path().join("Include/10.0.26100.0")).unwrap();
        std::fs::create_dir_all(dir.path().join("Include/wdf")).unwrap();
        assert_eq!(windows_sdk_versions(dir.path()), vec!["10.0.26100.0"]);
    }

    /// Reads this machine (no writes). `cargo test contract_reads_the_survey -- --ignored --nocapture`
    #[test]
    #[ignore = "contract: reads this machine's SDK folders, vswhere and py"]
    fn contract_reads_the_survey_machine_sdks() {
        let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
        let android = android_inventory(&crate::env_backend::WinregBackend, &LocalMachine, local.as_deref()).unwrap();
        println!("{android:#?}");
        let msvc = msvc_inventory();
        println!("{msvc:#?}");
        println!("{:#?}", python_supplemental().unwrap());
        assert!(android.ndk.contains(&"27.0.12077973".to_string()));
        assert!(msvc.windows_sdks.contains(&"10.0.26100.0".to_string()));
    }
}
