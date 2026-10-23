use std::path::{Path, PathBuf};
use std::process::Command;

use sha2::{Digest, Sha256};

use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::mise::pins::{self, MISE_VERSION};
use crate::whichcraft::persistence::{load_settings, save_settings, WhichcraftSettings};
use crate::whichcraft::ports::tool_manager::{RemoteVersion, ToolManager};

pub struct MiseToolManager {
    settings: WhichcraftSettings,
}

impl MiseToolManager {
    pub fn new() -> Result<Self, EnvarlyError> {
        Ok(Self {
            settings: load_settings()?,
        })
    }

    pub fn ensure_mise(&self) -> Result<PathBuf, EnvarlyError> {
        let dir = mise_store_dir()?;
        let exe = dir.join("mise.exe");
        if exe.is_file() {
            return Ok(exe);
        }
        download_and_verify_mise(&dir)?;
        Ok(exe)
    }

    pub fn mise_env(&self, store: &Path) -> Vec<(String, String)> {
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

    fn run_mise(&self, args: &[&str]) -> Result<std::process::Output, EnvarlyError> {
        let exe = self.ensure_mise()?;
        let store = active_mise_store(&self.settings)?;
        let mut cmd = Command::new(&exe);
        for (k, v) in self.mise_env(&store) {
            cmd.env(k, v);
        }
        cmd.args(args);
        cmd.output()
            .map_err(|e| EnvarlyError::InvalidInput(format!("mise spawn failed: {e}")))
    }

    pub fn install(&self, tool: ToolKind, version: &str) -> Result<PathBuf, EnvarlyError> {
        let spec = mise_spec(tool, version)?;
        let output = self.run_mise(&["install", &spec])?;
        if !output.status.success() {
            return Err(EnvarlyError::InvalidInput(format!(
                "mise install failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        self.install_path(tool, version)
    }

    pub fn install_path(&self, tool: ToolKind, version: &str) -> Result<PathBuf, EnvarlyError> {
        let output = self.run_mise(&["ls", "--json"])?;
        if !output.status.success() {
            return Err(EnvarlyError::InvalidInput("mise ls failed".into()));
        }
        let entries: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout)
            .map_err(|e| EnvarlyError::InvalidInput(format!("parse mise ls: {e}")))?;
        for entry in entries {
            let v = entry.get("version").and_then(|x| x.as_str()).unwrap_or("");
            if v.contains(version) {
                if let Some(path) = entry.get("install_path").and_then(|x| x.as_str()) {
                    return Ok(PathBuf::from(path));
                }
            }
        }
        Err(EnvarlyError::InvalidInput(format!(
            "mise install path not found for {version}"
        )))
    }
}

impl ToolManager for MiseToolManager {
    fn list_installed(&self, _tool: ToolKind) -> Result<Vec<String>, EnvarlyError> {
        let output = self.run_mise(&["ls", "--json"])?;
        let entries: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout)
            .map_err(|e| EnvarlyError::InvalidInput(format!("parse mise ls: {e}")))?;
        Ok(entries
            .into_iter()
            .filter_map(|e| e.get("version").and_then(|v| v.as_str()).map(str::to_string))
            .collect())
    }

    fn list_remote(&self, tool: ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError> {
        let backend = mise_backend(tool);
        let output = self.run_mise(&["ls-remote", "--json", backend])?;
        if !output.status.success() {
            return Err(EnvarlyError::InvalidInput(format!(
                "mise ls-remote failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        let entries: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout)
            .map_err(|e| EnvarlyError::InvalidInput(format!("parse ls-remote: {e}")))?;
        Ok(entries
            .into_iter()
            .filter_map(|e| {
                Some(RemoteVersion {
                    version: e.get("version")?.as_str()?.to_string(),
                    download_bytes: e.get("size").and_then(|s| s.as_u64()),
                    install_bytes: None,
                })
            })
            .collect())
    }
}

fn mise_store_dir() -> Result<PathBuf, EnvarlyError> {
    Ok(crate::whichcraft::persistence::whichcraft_data_dir()?
        .join("mise")
        .join(MISE_VERSION.trim_start_matches('v')))
}

fn active_mise_store(settings: &WhichcraftSettings) -> Result<PathBuf, EnvarlyError> {
    Ok(settings.install_store.join("_mise"))
}

fn download_and_verify_mise(dir: &Path) -> Result<(), EnvarlyError> {
    std::fs::create_dir_all(dir)
        .map_err(|e| EnvarlyError::InvalidInput(format!("create mise dir: {e}")))?;
    let url = pins::mise_download_url();
    let bytes = reqwest::blocking::get(&url)
        .map_err(|e| EnvarlyError::InvalidInput(format!("download mise: {e}")))?
        .bytes()
        .map_err(|e| EnvarlyError::InvalidInput(format!("read mise body: {e}")))?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let digest = format!("{:x}", hasher.finalize());
    if digest != pins::MISE_WINDOWS_X64_SHA256 {
        return Err(EnvarlyError::InvalidInput(
            "mise download SHA256 mismatch".into(),
        ));
    }
    let cursor = std::io::Cursor::new(bytes);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| EnvarlyError::InvalidInput(format!("zip: {e}")))?;
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| EnvarlyError::InvalidInput(format!("zip entry: {e}")))?;
        if file.name().ends_with("mise.exe") {
            let out_path = dir.join("mise.exe");
            let mut out = std::fs::File::create(&out_path)
                .map_err(|e| EnvarlyError::InvalidInput(format!("write mise: {e}")))?;
            std::io::copy(&mut file, &mut out)
                .map_err(|e| EnvarlyError::InvalidInput(format!("extract mise: {e}")))?;
            return Ok(());
        }
    }
    Err(EnvarlyError::InvalidInput("mise.exe not found in zip".into()))
}

fn mise_backend(tool: ToolKind) -> &'static str {
    match tool {
        ToolKind::Java => "temurin",
        ToolKind::Node => "node",
        ToolKind::Python => "python",
        ToolKind::Go => "go",
        ToolKind::Flutter => "vfox:jdx/vfox-flutter",
        ToolKind::Git => "git",
    }
}

fn mise_spec(tool: ToolKind, version: &str) -> Result<String, EnvarlyError> {
    match tool {
        ToolKind::Java => Ok(format!("temurin@{version}")),
        ToolKind::Node => Ok(format!("node@{version}")),
        ToolKind::Python => Ok(format!("python@{version}")),
        ToolKind::Go => Ok(format!("go@{version}")),
        ToolKind::Flutter => Ok(format!("vfox:jdx/vfox-flutter@{version}")),
        ToolKind::Git => Err(EnvarlyError::InvalidInput(
            "Git install via Whichcraft is out of scope".into(),
        )),
    }
}

pub fn set_install_store(path: PathBuf) -> Result<(), EnvarlyError> {
    let mut settings = load_settings()?;
    settings.install_store = path;
    save_settings(&settings)
}
