use std::path::{Path, PathBuf};
use std::process::Command;

use sha2::{Digest, Sha256};

use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::mise::pins::{self, MISE_VERSION};
use crate::whichcraft::persistence::load_settings;
use crate::whichcraft::ports::tool_manager::{ToolManager};
use crate::whichcraft::domain::versions::{RemoteVersion};

const FLUTTER_PLUGIN_NAME: &str = "vfox-jdx-vfox-flutter";
const FLUTTER_PLUGIN_URL: &str = "https://github.com/jdx/vfox-flutter";
const JAVA_VENDOR_PREFIX: &str = "temurin-";

/// Result of one mise invocation.
pub struct MiseOutput {
    pub success: bool,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

/// Runs the pinned mise against the app's own install store.
pub trait MiseRunner {
    fn run(&self, args: &[&str]) -> Result<MiseOutput, EnvarlyError>;
}

/// Spawns the pinned mise.exe with every mise dir pointed into the active install store.
pub struct ProcessMiseRunner {
    store: PathBuf,
    /// Uninstalling and listing may run with an older mise still on disk (I-14, I-15).
    maintenance: bool,
}

impl ProcessMiseRunner {
    /// Runs against the store new installations go to.
    pub fn from_settings() -> Result<Self, EnvarlyError> {
        Ok(Self::for_store(&load_settings()?.install_store))
    }

    /// Runs against a given install store, current or earlier.
    pub fn for_store(install_store: &Path) -> Self {
        Self {
            store: install_store.join("_mise"),
            maintenance: false,
        }
    }

    /// Like `for_store`, but uses the mise an earlier Whichcraft pinned when the current pin is
    /// not downloaded yet, so removing works offline right after an app update.
    pub fn for_maintenance(install_store: &Path) -> Self {
        Self {
            maintenance: true,
            ..Self::for_store(install_store)
        }
    }
}

impl MiseRunner for ProcessMiseRunner {
    fn run(&self, args: &[&str]) -> Result<MiseOutput, EnvarlyError> {
        let exe = if self.maintenance { maintenance_mise()? } else { ensure_mise()? };
        let mut cmd = Command::new(&exe);
        for (k, v) in mise_env(&self.store) {
            cmd.env(k, v);
        }
        let output = cmd
            .args(args)
            .output()
            .map_err(|e| EnvarlyError::InvalidInput(format!("mise spawn failed: {e}")))?;
        Ok(MiseOutput {
            success: output.status.success(),
            stdout: output.stdout,
            stderr: output.stderr,
        })
    }
}

pub fn mise_env(store: &Path) -> Vec<(String, String)> {
    vec![
        ("MISE_DATA_DIR".into(), store.join("data").to_string_lossy().into_owned()),
        ("MISE_CACHE_DIR".into(), store.join("cache").to_string_lossy().into_owned()),
        ("MISE_STATE_DIR".into(), store.join("state").to_string_lossy().into_owned()),
        ("MISE_CONFIG_DIR".into(), store.join("config").to_string_lossy().into_owned()),
        (
            "MISE_GLOBAL_CONFIG_FILE".into(),
            store.join("config").join("config.toml").to_string_lossy().into_owned(),
        ),
    ]
}

pub struct MiseToolManager<R: MiseRunner> {
    runner: R,
}

impl MiseToolManager<ProcessMiseRunner> {
    pub fn new() -> Result<Self, EnvarlyError> {
        Ok(Self::with_runner(ProcessMiseRunner::from_settings()?))
    }
}

impl<R: MiseRunner> MiseToolManager<R> {
    pub fn with_runner(runner: R) -> Self {
        Self { runner }
    }

    fn run_ok(&self, args: &[&str]) -> Result<Vec<u8>, EnvarlyError> {
        let output = self.runner.run(args)?;
        if !output.success {
            return Err(EnvarlyError::InvalidInput(format!(
                "mise {} failed: {}",
                args.first().copied().unwrap_or(""),
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        Ok(output.stdout)
    }

    pub fn install(&self, tool: ToolKind, version: &str) -> Result<PathBuf, EnvarlyError> {
        let name = mise_tool(tool)?;
        if tool == ToolKind::Flutter {
            self.ensure_flutter_plugin()?;
        }
        let spec = format!("{name}@{}", mise_version(tool, version));
        if let Err(err) = self.run_ok(&["install", &spec]) {
            // Leave nothing half-installed in the store for the inventory to pick up (I-8).
            let _ = self.runner.run(&["uninstall", &spec]);
            return Err(err);
        }
        self.install_path(tool, version)
    }

    /// Removes one installed version; `version` may be in mise's own form (the folder name).
    pub fn uninstall(&self, tool: ToolKind, version: &str) -> Result<(), EnvarlyError> {
        let spec = format!("{}@{}", mise_tool(tool)?, mise_version(tool, version));
        self.run_ok(&["uninstall", &spec]).map(|_| ())
    }

    pub fn install_path(&self, tool: ToolKind, version: &str) -> Result<PathBuf, EnvarlyError> {
        let wanted = mise_version(tool, version);
        parse_ls(&self.run_ok(&["ls", "--json", mise_tool(tool)?])?)?
            .into_iter()
            .find(|entry| entry.version == wanted)
            .and_then(|entry| entry.install_path)
            .ok_or_else(|| {
                EnvarlyError::InvalidInput(format!("mise install path not found for {wanted}"))
            })
    }

    /// Installs the vfox-flutter plugin at the pinned commit, replacing any other ref. There is no
    /// auto-update to turn off: the pinned mise never updates plugins by itself (its
    /// `plugin_autoupdate_last_check_duration` setting is deprecated as never implemented), and
    /// this check runs before every Flutter install anyway (I-17).
    pub fn ensure_flutter_plugin(&self) -> Result<(), EnvarlyError> {
        let listing = self.run_ok(&["plugins", "ls", "--urls", "--refs"])?;
        match plugin_ref(&String::from_utf8_lossy(&listing), FLUTTER_PLUGIN_NAME) {
            Some(r) if pins::VFOX_FLUTTER_PLUGIN_SHA.starts_with(&r) => return Ok(()),
            Some(_) => {
                self.run_ok(&["plugins", "uninstall", FLUTTER_PLUGIN_NAME])?;
            }
            None => {}
        }
        // mise rejects abbreviated SHAs here, so the pin must be the full commit hash.
        let url = format!("{FLUTTER_PLUGIN_URL}#{}", pins::VFOX_FLUTTER_PLUGIN_SHA);
        self.run_ok(&["plugins", "install", FLUTTER_PLUGIN_NAME, &url])?;
        Ok(())
    }
}

impl<R: MiseRunner + Send + Sync> ToolManager for MiseToolManager<R> {
    fn list_remote(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError> {
        let name = mise_tool(tool)?;
        if tool == ToolKind::Flutter {
            self.ensure_flutter_plugin()?;
        }
        let entries: Vec<serde_json::Value> =
            serde_json::from_slice(&self.run_ok(&["ls-remote", "--json", name])?)
                .map_err(|e| EnvarlyError::InvalidInput(format!("parse ls-remote: {e}")))?;
        Ok(entries
            .iter()
            .filter_map(|e| e.get("version")?.as_str())
            .filter(|v| tool != ToolKind::Java || v.starts_with(JAVA_VENDOR_PREFIX))
            .map(|v| RemoteVersion {
                version: display_version(tool, v),
                // `mise ls-remote --json` reports no sizes; they must come from elsewhere.
                download_bytes: None,
                install_bytes: None,
            })
            .collect())
    }
}

/// The mise registry name for a tool. Temurin is a vendor of `java`, not a tool of its own.
fn mise_tool(tool: ToolKind) -> Result<&'static str, EnvarlyError> {
    match tool {
        ToolKind::Java => Ok("java"),
        ToolKind::Node => Ok("node"),
        ToolKind::Python => Ok("python"),
        ToolKind::Go => Ok("go"),
        ToolKind::Flutter => Ok("vfox:jdx/vfox-flutter"),
        ToolKind::Git => Err(EnvarlyError::InvalidInput(
            "Git install via Whichcraft is out of scope".into(),
        )),
    }
}

/// The version string mise uses, e.g. `21.0.12+101.0.LTS` -> `temurin-21.0.12+101.0.LTS`.
fn mise_version(tool: ToolKind, version: &str) -> String {
    if tool == ToolKind::Java && !version.starts_with(JAVA_VENDOR_PREFIX) {
        format!("{JAVA_VENDOR_PREFIX}{version}")
    } else {
        version.to_string()
    }
}

fn display_version(tool: ToolKind, mise_version: &str) -> String {
    if tool == ToolKind::Java {
        mise_version.trim_start_matches(JAVA_VENDOR_PREFIX).to_string()
    } else {
        mise_version.to_string()
    }
}

struct LsEntry {
    version: String,
    install_path: Option<PathBuf>,
}

/// Parses `mise ls --json <tool>`, which returns an array for a single tool.
fn parse_ls(stdout: &[u8]) -> Result<Vec<LsEntry>, EnvarlyError> {
    let entries: Vec<serde_json::Value> = serde_json::from_slice(stdout)
        .map_err(|e| EnvarlyError::InvalidInput(format!("parse mise ls: {e}")))?;
    Ok(entries
        .iter()
        .filter_map(|e| {
            Some(LsEntry {
                version: e.get("version")?.as_str()?.to_string(),
                install_path: e
                    .get("install_path")
                    .and_then(|p| p.as_str())
                    .map(PathBuf::from),
            })
        })
        .collect())
}

/// The abbreviated commit a plugin is checked out at, from `mise plugins ls --urls --refs`.
fn plugin_ref(listing: &str, name: &str) -> Option<String> {
    listing.lines().find_map(|line| {
        let mut fields = line.split_whitespace();
        (fields.next()? == name).then(|| fields.last().map(str::to_string))?
    })
}

/// Whether the pinned mise is already on disk, and what the first install would download.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MiseStatus {
    pub version: String,
    pub present: bool,
    pub download_bytes: u64,
    /// Versions an earlier Whichcraft pinned that are still on disk, newest first.
    pub old_versions: Vec<String>,
    /// The pinned mise is being downloaded in the background; installs wait for it.
    pub fetching: bool,
}

pub fn mise_status() -> Result<MiseStatus, EnvarlyError> {
    Ok(MiseStatus {
        version: pinned_version().to_string(),
        present: mise_store_dir()?.join("mise.exe").is_file(),
        download_bytes: pins::MISE_WINDOWS_X64_ZIP_BYTES,
        old_versions: older_mise(&mise_root()?, pinned_version()).into_iter().map(|(v, _)| v).collect(),
        fetching: FETCHING.load(std::sync::atomic::Ordering::SeqCst),
    })
}

static FETCHING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn pinned_version() -> &'static str {
    MISE_VERSION.trim_start_matches('v')
}

fn version_key(version: &str) -> Vec<u64> {
    version.split('.').map(|p| p.parse().unwrap_or(0)).collect()
}

/// Version folders under `root` (`<data>\mise`) other than `pinned` that still hold a mise.exe,
/// newest first.
fn older_mise(root: &Path, pinned: &str) -> Vec<(String, PathBuf)> {
    let Ok(entries) = std::fs::read_dir(root) else { return Vec::new() };
    let mut found: Vec<(String, PathBuf)> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let exe = e.path().join("mise.exe");
            (name != pinned && exe.is_file()).then_some((name, exe))
        })
        .collect();
    found.sort_by(|a, b| version_key(&b.0).cmp(&version_key(&a.0)));
    found
}

/// The mise to uninstall or list with: the pinned one once it is on disk, otherwise the newest
/// one an earlier Whichcraft left (written only after its own hash check), otherwise none.
fn maintenance_choice(root: &Path, pinned: &str) -> Option<PathBuf> {
    if root.join(pinned).join("mise.exe").is_file() {
        return None;
    }
    older_mise(root, pinned).into_iter().next().map(|(_, exe)| exe)
}

fn maintenance_mise() -> Result<PathBuf, EnvarlyError> {
    match maintenance_choice(&mise_root()?, pinned_version()) {
        Some(old) => Ok(old),
        None => ensure_mise(),
    }
}

/// After an app update that pins a newer mise: fetch it if an older one shows that managed
/// installations exist, and remove the older ones once the new one has passed its hash check.
/// Returns whether anything was fetched.
fn prepare_in(root: &Path, pinned: &str, fetch: impl FnOnce() -> Result<PathBuf, EnvarlyError>) -> Result<bool, EnvarlyError> {
    let old = older_mise(root, pinned);
    if old.is_empty() {
        return Ok(false);
    }
    let fetched = !root.join(pinned).join("mise.exe").is_file();
    fetch()?;
    for (version, _) in old {
        // A copy still running (an uninstall in progress) stays until the next start.
        let _ = std::fs::remove_dir_all(root.join(version));
    }
    Ok(fetched)
}

pub fn prepare_mise() -> Result<bool, EnvarlyError> {
    use std::sync::atomic::Ordering;
    FETCHING.store(true, Ordering::SeqCst);
    let result = prepare_in(&mise_root()?, pinned_version(), ensure_mise);
    FETCHING.store(false, Ordering::SeqCst);
    result
}

/// The pinned hashes a mise.exe must match before it is run.
struct MisePins<'a> {
    zip_sha256: &'a str,
    exe_sha256: &'a str,
}

const PINNED: MisePins<'static> = MisePins {
    zip_sha256: pins::MISE_WINDOWS_X64_SHA256,
    exe_sha256: pins::MISE_WINDOWS_X64_EXE_SHA256,
};

fn ensure_mise() -> Result<PathBuf, EnvarlyError> {
    // Hashing 230 MB costs about a second, so check once per process.
    static VERIFIED: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
    // The background fetch and an install started meanwhile must not download twice.
    static DOWNLOAD: std::sync::Mutex<()> = std::sync::Mutex::new(());
    if let Some(exe) = VERIFIED.get() {
        return Ok(exe.clone());
    }
    let _guard = DOWNLOAD.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(exe) = VERIFIED.get() {
        return Ok(exe.clone());
    }
    let exe = verified_mise(&mise_store_dir()?, &PINNED, download_mise_zip)?;
    Ok(VERIFIED.get_or_init(|| exe).clone())
}

fn mise_root() -> Result<PathBuf, EnvarlyError> {
    Ok(crate::whichcraft::persistence::whichcraft_data_dir()?.join("mise"))
}

fn mise_store_dir() -> Result<PathBuf, EnvarlyError> {
    Ok(mise_root()?.join(pinned_version()))
}

fn download_mise_zip() -> Result<Vec<u8>, EnvarlyError> {
    Ok(reqwest::blocking::get(pins::mise_download_url())
        .map_err(|e| EnvarlyError::InvalidInput(format!("download mise: {e}")))?
        .bytes()
        .map_err(|e| EnvarlyError::InvalidInput(format!("read mise body: {e}")))?
        .to_vec())
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// Returns `dir\mise.exe` only once it matches the pinned hash. A missing or damaged copy is
/// fetched again; the new copy is written under a temporary name and renamed into place only
/// after its hash checks out, so an interrupted extraction never leaves a `mise.exe` behind.
fn verified_mise(
    dir: &Path,
    pins: &MisePins,
    fetch_zip: impl FnOnce() -> Result<Vec<u8>, EnvarlyError>,
) -> Result<PathBuf, EnvarlyError> {
    let exe = dir.join("mise.exe");
    if let Ok(bytes) = std::fs::read(&exe) {
        if sha256_hex(&bytes) == pins.exe_sha256 {
            return Ok(exe);
        }
        std::fs::remove_file(&exe)
            .map_err(|e| EnvarlyError::InvalidInput(format!("remove damaged mise.exe: {e}")))?;
    }

    let zip_bytes = fetch_zip()?;
    if sha256_hex(&zip_bytes) != pins.zip_sha256 {
        return Err(EnvarlyError::InvalidInput("mise download SHA256 mismatch".into()));
    }
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(zip_bytes))
        .map_err(|e| EnvarlyError::InvalidInput(format!("zip: {e}")))?;
    let mut exe_bytes = Vec::new();
    let mut found = false;
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| EnvarlyError::InvalidInput(format!("zip entry: {e}")))?;
        if file.name().ends_with("/mise.exe") || file.name() == "mise.exe" {
            std::io::Read::read_to_end(&mut file, &mut exe_bytes)
                .map_err(|e| EnvarlyError::InvalidInput(format!("extract mise: {e}")))?;
            found = true;
            break;
        }
    }
    if !found {
        return Err(EnvarlyError::InvalidInput("mise.exe not found in zip".into()));
    }
    if sha256_hex(&exe_bytes) != pins.exe_sha256 {
        return Err(EnvarlyError::InvalidInput("extracted mise.exe SHA256 mismatch".into()));
    }

    std::fs::create_dir_all(dir)
        .map_err(|e| EnvarlyError::InvalidInput(format!("create mise dir: {e}")))?;
    let partial = dir.join("mise.exe.partial");
    std::fs::write(&partial, &exe_bytes)
        .map_err(|e| EnvarlyError::InvalidInput(format!("write mise: {e}")))?;
    std::fs::rename(&partial, &exe)
        .map_err(|e| EnvarlyError::InvalidInput(format!("move mise into place: {e}")))?;
    Ok(exe)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// Records every mise invocation and answers from canned stdout keyed by the joined args.
    #[derive(Default)]
    struct FakeRunner {
        calls: std::sync::Mutex<Vec<String>>,
        replies: HashMap<String, String>,
        /// Commands (joined args) that fail, like a dropped connection mid-download.
        failing: Vec<String>,
    }

    impl FakeRunner {
        fn reply(mut self, args: &str, stdout: &str) -> Self {
            self.replies.insert(args.into(), stdout.into());
            self
        }

        fn fail(mut self, args: &str) -> Self {
            self.failing.push(args.into());
            self
        }
    }

    impl MiseRunner for FakeRunner {
        fn run(&self, args: &[&str]) -> Result<MiseOutput, EnvarlyError> {
            let key = args.join(" ");
            self.calls.lock().unwrap().push(key.clone());
            Ok(MiseOutput {
                success: !self.failing.contains(&key),
                stdout: self.replies.get(&key).cloned().unwrap_or_default().into_bytes(),
                stderr: b"network unreachable".to_vec(),
            })
        }
    }

    #[test]
    fn a_failed_install_is_cleaned_out_of_the_store() {
        let mgr = MiseToolManager::with_runner(FakeRunner::default().fail("install node@22.23.4"));
        let err = mgr.install(ToolKind::Node, "22.23.4").unwrap_err();
        assert!(err.to_string().contains("network unreachable"));
        assert_eq!(
            *mgr.runner.calls.lock().unwrap(),
            vec!["install node@22.23.4".to_string(), "uninstall node@22.23.4".to_string()]
        );
    }

    fn put_mise(root: &Path, version: &str) -> PathBuf {
        let dir = root.join(version);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("mise.exe"), version).unwrap();
        dir.join("mise.exe")
    }

    #[test]
    fn maintenance_uses_the_newest_old_mise_until_the_pinned_one_arrives() {
        let dir = tempfile::tempdir().unwrap();
        put_mise(dir.path(), "2026.2.1");
        let newest_old = put_mise(dir.path(), "2026.10.3");
        put_mise(dir.path(), "2026.9.30");
        assert_eq!(maintenance_choice(dir.path(), "2026.11.0"), Some(newest_old));
        put_mise(dir.path(), "2026.11.0");
        assert_eq!(maintenance_choice(dir.path(), "2026.11.0"), None, "the pinned one is used once present");
    }

    #[test]
    fn old_mise_is_removed_only_after_the_new_one_verifies() {
        let dir = tempfile::tempdir().unwrap();
        let old = put_mise(dir.path(), "2026.10.3");
        let err = prepare_in(dir.path(), "2026.11.0", || Err(EnvarlyError::InvalidInput("offline".into())));
        assert!(err.is_err());
        assert!(old.exists(), "offline: the old mise stays usable for uninstall and listing");

        let fetched = prepare_in(dir.path(), "2026.11.0", || Ok(put_mise(dir.path(), "2026.11.0"))).unwrap();
        assert!(fetched);
        assert!(!old.exists());
        assert_eq!(maintenance_choice(dir.path(), "2026.11.0"), None);
    }

    #[test]
    fn nothing_is_fetched_when_no_earlier_mise_was_ever_used() {
        let dir = tempfile::tempdir().unwrap();
        let fetched = prepare_in(dir.path(), "2026.11.0", || panic!("must not download")).unwrap();
        assert!(!fetched);
    }

    #[test]
    fn uninstall_names_the_version_the_way_mise_stored_it() {
        let mgr = MiseToolManager::with_runner(FakeRunner::default());
        mgr.uninstall(ToolKind::Java, "temurin-21.0.12+101.0.LTS").unwrap();
        mgr.uninstall(ToolKind::Flutter, "3.32.4-stable").unwrap();
        assert_eq!(
            *mgr.runner.calls.lock().unwrap(),
            vec![
                "uninstall java@temurin-21.0.12+101.0.LTS".to_string(),
                "uninstall vfox:jdx/vfox-flutter@3.32.4-stable".to_string()
            ]
        );
    }

    // Shape of `mise ls --json java` as seen in spike 3.
    const JAVA_LS: &str = r#"[{"version":"temurin-21.0.12+101.0.LTS","install_path":"C:\\store\\data\\installs\\java\\temurin-21.0.12+101.0.LTS","installed":true,"active":false}]"#;

    #[test]
    fn java_installs_as_temurin_vendor_of_java_tool() {
        let mgr = MiseToolManager::with_runner(FakeRunner::default().reply("ls --json java", JAVA_LS));
        let path = mgr.install(ToolKind::Java, "21.0.12+101.0.LTS").expect("install");
        assert_eq!(
            mgr.runner.calls.lock().unwrap().first().map(String::as_str),
            Some("install java@temurin-21.0.12+101.0.LTS")
        );
        assert!(path.ends_with("temurin-21.0.12+101.0.LTS"));
    }

    #[test]
    fn java_remote_versions_are_temurin_only() {
        let remote = r#"[{"version":"graalvm-community-25.0.3"},{"version":"temurin-21.0.12+101.0.LTS"},{"version":"zulu-21.0.1"}]"#;
        let mgr = MiseToolManager::with_runner(FakeRunner::default().reply("ls-remote --json java", remote));
        let versions = mgr.list_remote(ToolKind::Java).unwrap();
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].version, "21.0.12+101.0.LTS");
        assert_eq!(versions[0].download_bytes, None);
    }

    #[test]
    fn install_path_matches_the_exact_version_only() {
        let ls = r#"[{"version":"22.13.0","install_path":"C:\\n\\22.13.0"},{"version":"22.1.0","install_path":"C:\\n\\22.1.0"}]"#;
        let mgr = MiseToolManager::with_runner(FakeRunner::default().reply("ls --json node", ls));
        assert_eq!(mgr.install_path(ToolKind::Node, "22.1.0").unwrap(), PathBuf::from("C:\\n\\22.1.0"));
        assert!(mgr.install_path(ToolKind::Node, "22.1").is_err());
    }

    #[test]
    fn flutter_install_pins_the_plugin_first() {
        let runner = FakeRunner::default().reply(
            "ls --json vfox:jdx/vfox-flutter",
            r#"[{"version":"3.47.7","install_path":"C:\\f\\3.47.7"}]"#,
        );
        let mgr = MiseToolManager::with_runner(runner);
        mgr.install(ToolKind::Flutter, "3.47.7").unwrap();
        let calls = mgr.runner.calls.lock().unwrap();
        let pinned = format!(
            "plugins install vfox-jdx-vfox-flutter https://github.com/jdx/vfox-flutter#{}",
            pins::VFOX_FLUTTER_PLUGIN_SHA
        );
        let pin_at = calls.iter().position(|c| *c == pinned).expect("plugin installed at full SHA");
        let install_at = calls.iter().position(|c| c.starts_with("install ")).unwrap();
        assert!(pin_at < install_at);
    }

    #[test]
    fn flutter_plugin_at_another_ref_is_replaced() {
        let runner = FakeRunner::default().reply(
            "plugins ls --urls --refs",
            "vfox-jdx-vfox-flutter  https://github.com/jdx/vfox-flutter  HEAD 2b8eaef\n",
        );
        let mgr = MiseToolManager::with_runner(runner);
        mgr.ensure_flutter_plugin().unwrap();
        let calls = mgr.runner.calls.lock().unwrap();
        assert!(calls.contains(&"plugins uninstall vfox-jdx-vfox-flutter".to_string()));
        assert!(calls.iter().any(|c| c.starts_with("plugins install ")));
    }

    #[test]
    fn flutter_plugin_already_pinned_is_left_alone() {
        let listing = format!(
            "vfox-jdx-vfox-flutter  https://github.com/jdx/vfox-flutter  HEAD {}\n",
            &pins::VFOX_FLUTTER_PLUGIN_SHA[..7]
        );
        let mgr = MiseToolManager::with_runner(FakeRunner::default().reply("plugins ls --urls --refs", &listing));
        mgr.ensure_flutter_plugin().unwrap();
        assert_eq!(*mgr.runner.calls.lock().unwrap(), vec!["plugins ls --urls --refs".to_string()]);
    }

    fn zip_with_exe(exe: &[u8]) -> Vec<u8> {
        let mut buf = std::io::Cursor::new(Vec::new());
        let mut zip = zip::ZipWriter::new(&mut buf);
        zip.start_file("mise/bin/mise.exe", zip::write::SimpleFileOptions::default()).unwrap();
        std::io::Write::write_all(&mut zip, exe).unwrap();
        zip.finish().unwrap();
        buf.into_inner()
    }

    fn pins_for(zip: &[u8], exe: &[u8]) -> (String, String) {
        (sha256_hex(zip), sha256_hex(exe))
    }

    #[test]
    fn a_good_existing_mise_is_used_without_downloading() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("mise.exe"), b"real-mise").unwrap();
        let (z, e) = pins_for(b"unused", b"real-mise");
        let pins = MisePins { zip_sha256: &z, exe_sha256: &e };
        let exe = verified_mise(dir.path(), &pins, || panic!("should not download")).unwrap();
        assert_eq!(std::fs::read(exe).unwrap(), b"real-mise");
    }

    #[test]
    fn a_damaged_existing_mise_is_replaced() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("mise.exe"), b"half-writ").unwrap();
        let zip = zip_with_exe(b"real-mise");
        let (z, e) = pins_for(&zip, b"real-mise");
        let pins = MisePins { zip_sha256: &z, exe_sha256: &e };
        let exe = verified_mise(dir.path(), &pins, || Ok(zip.clone())).unwrap();
        assert_eq!(std::fs::read(exe).unwrap(), b"real-mise");
        assert!(!dir.path().join("mise.exe.partial").exists());
    }

    #[test]
    fn a_download_with_the_wrong_hash_leaves_no_mise_behind() {
        let dir = tempfile::tempdir().unwrap();
        let zip = zip_with_exe(b"tampered");
        let (_, e) = pins_for(&zip, b"real-mise");
        let pins = MisePins { zip_sha256: "0000", exe_sha256: &e };
        assert!(verified_mise(dir.path(), &pins, || Ok(zip.clone())).is_err());
        assert!(!dir.path().join("mise.exe").exists());
    }

    #[test]
    fn an_exe_that_does_not_match_its_pin_is_not_installed() {
        let dir = tempfile::tempdir().unwrap();
        let zip = zip_with_exe(b"other-build");
        let (z, e) = pins_for(&zip, b"real-mise");
        let pins = MisePins { zip_sha256: &z, exe_sha256: &e };
        assert!(verified_mise(dir.path(), &pins, || Ok(zip.clone())).is_err());
        assert!(!dir.path().join("mise.exe").exists());
    }

    #[test]
    fn git_cannot_be_installed() {
        let mgr = MiseToolManager::with_runner(FakeRunner::default());
        assert!(mgr.install(ToolKind::Git, "2.55.0").is_err());
        assert!(mgr.runner.calls.lock().unwrap().is_empty());
    }
}
