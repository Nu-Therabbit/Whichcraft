use std::path::{Path, PathBuf};

use crate::whichcraft::api::ToolKind;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstallation {
    pub vendor: String,
    pub version: String,
    pub root: PathBuf,
    pub managed: bool,
}

pub fn probe_java_root(root: &Path, managed: bool) -> Option<JavaInstallation> {
    if is_reparse_point(root) {
        return None;
    }
    let release_path = root.join("release");
    let java_exe = root.join("bin").join("java.exe");
    if is_reparse_point(&java_exe) {
        return None;
    }
    if !java_exe.is_file() {
        return None;
    }
    let release_text = std::fs::read_to_string(release_path).ok()?;
    let release = super::parse_release_file(&release_text)?;
    Some(JavaInstallation {
        vendor: release.implementor,
        version: release.version,
        root: root.to_path_buf(),
        managed,
    })
}

impl JavaInstallation {
    pub fn tool(&self) -> ToolKind {
        ToolKind::Java
    }
}

fn is_reparse_point(path: &Path) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide: Vec<u16> = path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let attrs =
            unsafe { windows_sys::Win32::Storage::FileSystem::GetFileAttributesW(wide.as_ptr()) };
        if attrs == u32::MAX {
            return false;
        }
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        attrs & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn probe_finds_jdk_layout() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(
            root.join("release"),
            "IMPLEMENTOR=\"Test Vendor\"\nJAVA_VERSION=\"17.0.1\"\n",
        )
        .unwrap();
        fs::create_dir_all(root.join("bin")).unwrap();
        fs::write(root.join("bin").join("java.exe"), b"").unwrap();
        let inst = probe_java_root(root, false).expect("probe");
        assert_eq!(inst.vendor, "Test Vendor");
        assert_eq!(inst.version, "17.0.1");
    }
}
