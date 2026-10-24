use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use msi::{Expr, Select, Value};
use winreg::enums::*;
use winreg::RegKey;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::installer_catalog::{CatalogEntry, InstallerCatalog};
use crate::whichcraft::domain::{InstallerKind};

pub struct WinInstallerCatalog {
    index: Vec<UninstallRow>,
}

#[derive(Debug, Clone)]
struct UninstallRow {
    install_root: Option<PathBuf>,
    display_name: String,
    uninstall_command: Option<String>,
    windows_installer: bool,
    kind: InstallerKind,
}

impl WinInstallerCatalog {
    pub fn load() -> Result<Self, EnvarlyError> {
        let mut rows = Vec::new();
        for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
            let root = RegKey::predef(hive);
            for subpath in [
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            ] {
                if let Ok(uninstall) = root.open_subkey(subpath) {
                    collect_uninstall_keys(&uninstall, &mut rows);
                }
            }
        }
        for row in &mut rows {
            if row.install_root.is_none() && row.windows_installer {
                if let Some(code) = product_code_from_uninstall(row.uninstall_command.as_deref()) {
                    if let Some(root) = resolve_msi_install_root(&code) {
                        row.install_root = Some(root);
                    }
                }
            }
        }
        Ok(Self { index: rows })
    }

    fn match_root(&self, root: &Path) -> Vec<CatalogEntry> {
        let root_norm = normalize_path(root);
        self.index
            .iter()
            .filter(|row| {
                row.install_root.as_ref().is_some_and(|loc| {
                    let loc_norm = normalize_path(loc);
                    loc_norm == root_norm || root_norm.starts_with(&loc_norm)
                })
            })
            .map(|row| CatalogEntry {
                install_root: row.install_root.clone().unwrap_or_else(|| root.to_path_buf()),
                kind: row.kind.clone(),
                display_name: row.display_name.clone(),
                uninstall_command: row.uninstall_command.clone(),
            })
            .collect()
    }
}

/// Reading the uninstall keys and resolving MSI roots takes about 2 s, and one refresh after a
/// write lists every tool and profile (a dozen loads), so a snapshot is reused this long.
const CATALOG_REUSE: Duration = Duration::from_secs(15);

/// One process-wide catalog snapshot. Commands build a new `App` per call, so it cannot live there.
static CATALOG_CACHE: CatalogCache = CatalogCache::new();

/// The `InstallerCatalogSource` port: the uninstall keys, reused for `CATALOG_REUSE` unless
/// an install or uninstall invalidated them.
pub struct WinInstallerCatalogs;

impl crate::whichcraft::ports::installer_catalog::InstallerCatalogSource for WinInstallerCatalogs {
    fn load(&self) -> Result<Box<dyn InstallerCatalog>, EnvarlyError> {
        let catalog = CATALOG_CACHE.get_or_load(Instant::now(), CATALOG_REUSE, || {
            Ok(Arc::new(WinInstallerCatalog::load()?) as Arc<dyn InstallerCatalog>)
        })?;
        Ok(Box::new(SharedCatalog(catalog)))
    }

    fn invalidate(&self) {
        CATALOG_CACHE.clear();
    }
}

/// A loaded catalog and when it was read. The lock is held while loading, so calls that arrive
/// together wait for one read instead of each reading the registry.
struct CatalogCache(Mutex<Option<(Instant, Arc<dyn InstallerCatalog>)>>);

impl CatalogCache {
    const fn new() -> Self {
        Self(Mutex::new(None))
    }

    fn get_or_load(
        &self,
        now: Instant,
        reuse: Duration,
        load: impl FnOnce() -> Result<Arc<dyn InstallerCatalog>, EnvarlyError>,
    ) -> Result<Arc<dyn InstallerCatalog>, EnvarlyError> {
        let mut slot = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((read_at, catalog)) = slot.as_ref() {
            if now.saturating_duration_since(*read_at) < reuse {
                return Ok(catalog.clone());
            }
        }
        let catalog = load()?;
        *slot = Some((now, catalog.clone()));
        Ok(catalog)
    }

    fn clear(&self) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }
}

struct SharedCatalog(Arc<dyn InstallerCatalog>);

impl InstallerCatalog for SharedCatalog {
    fn entries_for_root(&self, root: &Path) -> Result<Vec<CatalogEntry>, EnvarlyError> {
        self.0.entries_for_root(root)
    }
}

impl InstallerCatalog for WinInstallerCatalog {
    fn entries_for_root(&self, root: &Path) -> Result<Vec<CatalogEntry>, EnvarlyError> {
        Ok(self.match_root(root))
    }
}

fn collect_uninstall_keys(uninstall: &RegKey, out: &mut Vec<UninstallRow>) {
    for name in uninstall.enum_keys().filter_map(Result::ok) {
        let Ok(key) = uninstall.open_subkey(&name) else {
            continue;
        };
        let display_name: String = key.get_value("DisplayName").unwrap_or_default();
        if display_name.is_empty() {
            continue;
        }
        let install_location: String = key.get_value("InstallLocation").unwrap_or_default();
        let uninstall_string: String = key.get_value("UninstallString").unwrap_or_default();
        let windows_installer: u32 = key.get_value("WindowsInstaller").unwrap_or(0);
        let is_msi = windows_installer == 1;
        let kind = classify_installer(&display_name, is_msi, &uninstall_string);
        let install_root = if install_location.trim().is_empty() {
            None
        } else {
            Some(PathBuf::from(install_location.trim()))
        };
        out.push(UninstallRow {
            install_root,
            display_name,
            uninstall_command: if uninstall_string.is_empty() {
                None
            } else {
                Some(uninstall_string)
            },
            windows_installer: is_msi,
            kind,
        });
    }
}

fn classify_installer(display_name: &str, is_msi: bool, uninstall: &str) -> InstallerKind {
    if is_msi {
        return InstallerKind::Msi;
    }
    let lower = display_name.to_ascii_lowercase();
    if lower.contains("python") && uninstall.to_ascii_lowercase().contains("pymanager") {
        return InstallerKind::PythonInstallManager;
    }
    if uninstall.to_ascii_lowercase().contains("unins") {
        return InstallerKind::InnoSetup;
    }
    if uninstall.is_empty() {
        return InstallerKind::ManagedByOtherTool;
    }
    InstallerKind::FolderOnly
}

/// The `{GUID}` in an MSI uninstall command such as `MsiExec.exe /I{285FFC48-…}`.
fn product_code_from_uninstall(uninstall: Option<&str>) -> Option<String> {
    let text = uninstall?;
    let start = text.find('{')?;
    let end = start + text[start..].find('}')?;
    Some(text[start..=end].to_string())
}

/// Executables whose folder tells where an MSI put a tool, and how far up its root is.
const PRIMARY_FILES: &[(&str, usize)] = &[("node.exe", 0), ("go.exe", 1), ("java.exe", 1), ("git.exe", 1)];

/// Where an MSI installed its product when the uninstall entry has no InstallLocation (Node, Go).
/// Finds a primary executable in the cached package's File table, then asks Windows Installer
/// where that component landed (spike 6).
fn resolve_msi_install_root(product_code: &str) -> Option<PathBuf> {
    let local_package = msi_product_info(product_code, "LocalPackage")?;
    let mut pkg = msi::open(&local_package).ok()?;
    for (file_name, levels_up) in PRIMARY_FILES {
        let Some(component_id) = component_id_for_file(&mut pkg, file_name) else {
            continue;
        };
        let file = PathBuf::from(msi_component_path(product_code, &component_id)?);
        let mut root = file.parent()?.to_path_buf();
        for _ in 0..*levels_up {
            root = root.parent()?.to_path_buf();
        }
        return Some(root);
    }
    None
}

/// MSI file names are stored as `SHORT~1.EXE|long-name.exe`; the long name is after the bar.
fn long_file_name(stored: &str) -> &str {
    stored.rsplit('|').next().unwrap_or(stored)
}

fn component_id_for_file(pkg: &mut msi::Package<std::fs::File>, file_name: &str) -> Option<String> {
    let component = pkg
        .select_rows(Select::table("File"))
        .ok()?
        .find_map(|row| match (&row["FileName"], &row["Component_"]) {
            (Value::Str(name), Value::Str(component))
                if long_file_name(name).eq_ignore_ascii_case(file_name) =>
            {
                Some(component.clone())
            }
            _ => None,
        })?;
    let query = Select::table("Component").with(Expr::col("Component").eq(Expr::string(component)));
    let row = pkg.select_rows(query).ok()?.next()?;
    match &row["ComponentId"] {
        Value::Str(id) => Some(id.clone()),
        _ => None,
    }
}

fn wide(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

fn msi_product_info(product_code: &str, property: &str) -> Option<String> {
    use windows_sys::Win32::System::ApplicationInstallationAndServicing::MsiGetProductInfoW;
    let (product, property) = (wide(product_code), wide(property));
    let mut buf = vec![0u16; 1024];
    let mut len = buf.len() as u32;
    let rc = unsafe { MsiGetProductInfoW(product.as_ptr(), property.as_ptr(), buf.as_mut_ptr(), &mut len) };
    (rc == 0).then(|| String::from_utf16_lossy(&buf[..len as usize]))
}

fn msi_component_path(product_code: &str, component_id: &str) -> Option<String> {
    use windows_sys::Win32::System::ApplicationInstallationAndServicing::{
        MsiGetComponentPathW, INSTALLSTATE_LOCAL,
    };
    let (product, component) = (wide(product_code), wide(component_id));
    let mut buf = vec![0u16; 1024];
    let mut len = buf.len() as u32;
    let state = unsafe { MsiGetComponentPathW(product.as_ptr(), component.as_ptr(), buf.as_mut_ptr(), &mut len) };
    (state == INSTALLSTATE_LOCAL).then(|| String::from_utf16_lossy(&buf[..len as usize]))
}

fn normalize_path(path: &Path) -> PathBuf {
    PathBuf::from(
        path.to_string_lossy()
            .trim_end_matches(['\\', '/'])
            .to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Empty;

    impl InstallerCatalog for Empty {
        fn entries_for_root(&self, _root: &Path) -> Result<Vec<CatalogEntry>, EnvarlyError> {
            Ok(Vec::new())
        }
    }

    fn counting_load(loads: &std::cell::Cell<u32>) -> Result<Arc<dyn InstallerCatalog>, EnvarlyError> {
        loads.set(loads.get() + 1);
        Ok(Arc::new(Empty))
    }

    #[test]
    fn a_catalog_snapshot_is_reused_until_it_is_old_or_invalidated() {
        let cache = CatalogCache::new();
        let loads = std::cell::Cell::new(0);
        let start = Instant::now();
        let reuse = Duration::from_secs(15);

        cache.get_or_load(start, reuse, || counting_load(&loads)).unwrap();
        cache.get_or_load(start + Duration::from_secs(14), reuse, || counting_load(&loads)).unwrap();
        assert_eq!(loads.get(), 1, "a refresh's dozen lookups share one registry read");

        cache.get_or_load(start + Duration::from_secs(15), reuse, || counting_load(&loads)).unwrap();
        assert_eq!(loads.get(), 2, "an old snapshot is read again");

        cache.clear();
        cache.get_or_load(start + Duration::from_secs(16), reuse, || counting_load(&loads)).unwrap();
        assert_eq!(loads.get(), 3, "an install or uninstall forces a fresh read");
    }

    #[test]
    fn a_failed_load_is_not_cached() {
        let cache = CatalogCache::new();
        let now = Instant::now();
        let reuse = Duration::from_secs(15);
        assert!(cache.get_or_load(now, reuse, || Err(EnvarlyError::InvalidInput("registry".into()))).is_err());
        let loads = std::cell::Cell::new(0);
        cache.get_or_load(now, reuse, || counting_load(&loads)).unwrap();
        assert_eq!(loads.get(), 1);
    }

    #[test]
    fn product_code_is_the_first_braced_guid() {
        assert_eq!(
            product_code_from_uninstall(Some("MsiExec.exe /I{285FFC48-F0BE-425E-9496-8F5E267BC34D}")).as_deref(),
            Some("{285FFC48-F0BE-425E-9496-8F5E267BC34D}")
        );
        assert_eq!(product_code_from_uninstall(Some("\"C:\\Program Files\\Git\\unins001.exe\"")), None);
    }

    #[test]
    fn msi_file_names_use_the_long_part() {
        assert_eq!(long_file_name("NODE~1.EXE|node.exe"), "node.exe");
        assert_eq!(long_file_name("go.exe"), "go.exe");
    }

    #[test]
    fn installers_are_classified_like_spike_6() {
        assert_eq!(classify_installer("Node.js", true, "MsiExec.exe /I{X}"), InstallerKind::Msi);
        assert_eq!(classify_installer("Git", false, "\"C:\\Program Files\\Git\\unins001.exe\""), InstallerKind::InnoSetup);
        assert_eq!(
            classify_installer("Python 3.14.6", false, "pymanager.exe uninstall --yes --by-id \"pythoncore-3.14-64\""),
            InstallerKind::PythonInstallManager
        );
        assert_eq!(classify_installer("Android Studio", false, ""), InstallerKind::ManagedByOtherTool);
    }

    /// Reads this machine's real uninstall entries (no writes). Run with `cargo test -- --ignored`.
    #[test]
    #[ignore = "contract: reads the real registry and Windows Installer database"]
    fn contract_msi_products_without_install_location_resolve_to_their_folder() {
        let catalog = WinInstallerCatalog::load().unwrap();
        let program_files = std::env::var("ProgramFiles").unwrap();
        for folder in ["nodejs", "Go"] {
            let root = Path::new(&program_files).join(folder);
            if root.is_dir() {
                assert_eq!(catalog.kind_for_root(&root), InstallerKind::Msi, "{}", root.display());
            }
        }
    }
}
