//! The `SdkProbe` port on this Windows machine.

use std::path::PathBuf;

use crate::whichcraft::ports::sdk::SdkProbe;
use crate::whichcraft::tools::background::background_command;

pub struct WinSdkProbe;

impl SdkProbe for WinSdkProbe {
    fn py_launcher_list(&self) -> Option<String> {
        let out = background_command("py").arg("-0p").output().ok()?;
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    }

    fn python_store_alias(&self) -> Option<PathBuf> {
        std::env::var_os("LOCALAPPDATA")
            .map(|l| PathBuf::from(l).join("Microsoft").join("WindowsApps").join("python.exe"))
            // An app execution alias is a reparse point that `exists()` does not follow.
            .filter(|p| std::fs::symlink_metadata(p).is_ok())
    }

    fn vswhere_json(&self) -> Option<String> {
        let exe = PathBuf::from(std::env::var_os("ProgramFiles(x86)")?)
            .join("Microsoft Visual Studio")
            .join("Installer")
            .join("vswhere.exe");
        if !exe.is_file() {
            return None;
        }
        let out = background_command(exe)
            .args(["-products", "*", "-format", "json", "-utf8"])
            .output()
            .ok()?;
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    }

    fn windows_kits_root(&self) -> Option<PathBuf> {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        let key = winreg::RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\Microsoft\Windows Kits\Installed Roots")
            .ok()?;
        key.get_value::<String, _>("KitsRoot10").ok().map(PathBuf::from)
    }
}
