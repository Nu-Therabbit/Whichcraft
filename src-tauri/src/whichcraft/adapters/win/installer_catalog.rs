use std::path::{Path, PathBuf};

use msi::{Expr, Select, Value};
use winreg::enums::*;
use winreg::RegKey;

use crate::error::EnvarlyError;
use crate::whichcraft::ports::installer_catalog::{CatalogEntry, InstallerCatalog, InstallerKind};

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

fn product_code_from_uninstall(uninstall: Option<&str>) -> Option<String> {
    let text = uninstall?;
    let start = text.find('{')?;
    let end = text.find('}')?;
    Some(text[start..=end].to_string())
}

fn resolve_msi_install_root(product_code: &str) -> Option<PathBuf> {
    let local_package = msi_product_info(product_code)?;
    let msi_path = PathBuf::from(local_package);
    let exe_name = guess_primary_exe(&msi_path)?;
    let dir = msi_primary_executable_dir(&msi_path, &exe_name)?;
    if exe_name.eq_ignore_ascii_case("go.exe") {
        dir.parent().map(|p| p.to_path_buf())
    } else {
        Some(dir)
    }
}

fn guess_primary_exe(msi_path: &Path) -> Option<String> {
    let name = msi_path.file_stem()?.to_string_lossy().to_ascii_lowercase();
    if name.contains("node") {
        Some("node.exe".into())
    } else if name.contains("go") {
        Some("go.exe".into())
    } else {
        None
    }
}

fn msi_primary_executable_dir(msi_path: &Path, file_name: &str) -> Option<PathBuf> {
    let mut pkg = msi::open(msi_path).ok()?;
    let query = Select::table("File")
        .with(Expr::col("FileName").eq(Expr::string(file_name)));
    let mut rows = pkg.select_rows(query).ok()?;
    let row = rows.next()?;
    let component = match &row["Component_"] {
        Value::Str(s) => s.clone(),
        _ => return None,
    };
    let query = Select::table("Component")
        .with(Expr::col("Component").eq(Expr::string(component)));
    let mut rows = pkg.select_rows(query).ok()?;
    let row = rows.next()?;
    let directory_id = match &row["Directory_"] {
        Value::Str(s) => s.clone(),
        _ => return None,
    };
    resolve_msi_directory(&mut pkg, &directory_id)
}

fn resolve_msi_directory(
    pkg: &mut msi::Package<std::fs::File>,
    directory_id: &str,
) -> Option<PathBuf> {
    let mut parts: Vec<String> = Vec::new();
    let mut current = directory_id.to_string();
    loop {
        let query = Select::table("Directory")
            .with(Expr::col("Directory").eq(Expr::string(&current)));
        let mut rows = pkg.select_rows(query).ok()?;
        let row = rows.next()?;
        let default_dir = match &row["DefaultDir"] {
            Value::Str(s) => s.clone(),
            _ => String::new(),
        };
        let parent = match &row["Directory_Parent"] {
            Value::Str(s) => s.clone(),
            _ => String::new(),
        };
        if !default_dir.is_empty() && default_dir != "." {
            parts.push(default_dir.trim_end_matches(':').replace('|', "\\"));
        }
        if parent.is_empty() || parent == current {
            break;
        }
        current = parent;
    }
    parts.reverse();
    let mut path = PathBuf::new();
    for part in parts {
        path.push(part);
    }
    Some(path)
}

fn msi_product_info(product_code: &str) -> Option<String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::ApplicationInstallationAndServicing::{
        MsiGetProductInfoW, INSTALLPROPERTY_LOCALPACKAGE,
    };

    let wide_product: Vec<u16> = OsStr::new(product_code)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut buf = vec![0u16; 512];
    let mut len = buf.len() as u32;
    let rc = unsafe {
        MsiGetProductInfoW(
            wide_product.as_ptr(),
            INSTALLPROPERTY_LOCALPACKAGE,
            buf.as_mut_ptr(),
            &mut len,
        )
    };
    if rc != 0 {
        return None;
    }
    let text = String::from_utf16_lossy(&buf[..len as usize]);
    Some(text.trim_end_matches('\0').to_string())
}

fn normalize_path(path: &Path) -> PathBuf {
    PathBuf::from(
        path.to_string_lossy()
            .trim_end_matches(['\\', '/'])
            .to_string(),
    )
}

pub fn catalog_for_root(root: &Path) -> Result<Vec<CatalogEntry>, EnvarlyError> {
    let catalog = WinInstallerCatalog::load()?;
    catalog.entries_for_root(root)
}

pub fn installer_kind_for_root(root: &Path) -> Result<InstallerKind, EnvarlyError> {
    let entries = catalog_for_root(root)?;
    if entries.is_empty() {
        return Ok(InstallerKind::FolderOnly);
    }
    Ok(entries[0].kind.clone())
}
