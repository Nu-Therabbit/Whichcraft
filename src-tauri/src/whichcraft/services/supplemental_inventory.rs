use serde::Serialize;

use crate::error::EnvarlyError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonLauncherLine {
    pub tag: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonSupplementalView {
    pub launcher_lines: Vec<PythonLauncherLine>,
    pub store_stub: Option<String>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadOnlyInventorySection {
    pub title: String,
    pub items: Vec<String>,
}

pub fn python_supplemental() -> Result<PythonSupplementalView, EnvarlyError> {
    let output = std::process::Command::new("py")
        .args(["-0p"])
        .output()
        .map_err(|e| EnvarlyError::InvalidInput(format!("py launcher: {e}")))?;
    let text = String::from_utf8_lossy(&output.stdout);
    let launcher_lines = text
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| PythonLauncherLine {
            tag: l.to_string(),
            path: l.to_string(),
        })
        .collect();
    Ok(PythonSupplementalView {
        launcher_lines,
        store_stub: Some(
            "Microsoft Store Python stub (if present) is separate from PATH python.exe".into(),
        ),
        note: "py launcher does not see Whichcraft-managed Python installs (E-5).".into(),
    })
}

pub fn android_read_only() -> ReadOnlyInventorySection {
    let sdk = std::env::var("ANDROID_HOME")
        .or_else(|_| std::env::var("ANDROID_SDK_ROOT"))
        .unwrap_or_else(|_| "(not set)".into());
    ReadOnlyInventorySection {
        title: "Android SDK (read-only)".into(),
        items: vec![format!("SDK root: {sdk}")],
    }
}

pub fn msvc_read_only() -> ReadOnlyInventorySection {
    ReadOnlyInventorySection {
        title: "MSVC / Windows SDK (read-only)".into(),
        items: vec![
            "Use Visual Studio Installer for installed MSVC/SDK components.".into(),
        ],
    }
}
