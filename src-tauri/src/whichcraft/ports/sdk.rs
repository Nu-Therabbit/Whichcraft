use std::path::PathBuf;

/// The Windows-specific places the read-only SDK inventory looks: the `py` launcher, the Store
/// alias, Visual Studio's own locator and the Windows Kits registry key.
pub trait SdkProbe: Send + Sync {
    /// What `py -0p` prints, or `None` when the launcher is not installed.
    fn py_launcher_list(&self) -> Option<String>;
    /// The Microsoft Store `python.exe` alias, when present.
    fn python_store_alias(&self) -> Option<PathBuf>;
    /// What `vswhere -products * -format json` prints, or `None` without Visual Studio's installer.
    fn vswhere_json(&self) -> Option<String>;
    /// The Windows 10/11 SDK root (`KitsRoot10`).
    fn windows_kits_root(&self) -> Option<PathBuf>;
}
