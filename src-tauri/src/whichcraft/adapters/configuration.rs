//! Native process/file boundary. Tests supply an isolated environment, executables and storage.
use crate::{
    error::WhichcraftError,
    whichcraft::{
        domain::configuration::ConfigExecutable, ports::configuration::*,
        tools::background::background_command,
    },
};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
#[cfg(test)]
type PublicationHook = std::sync::Arc<dyn Fn(&Path) + Send + Sync>;

#[derive(Clone)]
pub struct NativeConfigurationIo {
    isolated: Option<ConfigurationRuntime>,
    pub journal: PathBuf,
    #[cfg(test)]
    pub before_commit: Option<PublicationHook>,
}
impl NativeConfigurationIo {
    #[cfg(test)]
    pub fn isolated(environment: HashMap<String, String>, git: String, journal: PathBuf) -> Self {
        let home = PathBuf::from(environment.get("HOME").unwrap());
        let ssh_clients = vec![ConfigurationSshClient {
            executable: ConfigExecutable {
                path: home.join("ssh.exe").display().to_string(),
                label: "Fixture OpenSSH".into(),
                effective: true,
            },
            user_config: home.join(".ssh/config"),
            system_config: home.join("ssh_system"),
        }];
        Self {
            isolated: Some(ConfigurationRuntime {
                environment,
                executables: vec![ConfigExecutable {
                    label: "Fixture Git".into(),
                    path: git,
                    effective: true,
                }],
                recent: vec![],
                ssh_clients,
            }),
            journal,
            before_commit: None,
        }
    }
    pub fn windows() -> Self {
        Self {
            #[cfg(test)]
            before_commit: None,
            isolated: None,
            journal: dirs_next::data_local_dir()
                .unwrap_or_default()
                .join("Whichcraft/configuration-operation"),
        }
    }
}
impl ConfigurationIo for NativeConfigurationIo {
    fn runtime(&self) -> ConfigResult<ConfigurationRuntime> {
        if let Some(runtime) = &self.isolated {
            let mut runtime = runtime.clone();
            if let Ok(bytes) = fs::read(self.journal.with_extension("recent")) {
                runtime.recent = serde_json::from_slice(&bytes)?;
            }
            return Ok(runtime);
        }
        use crate::whichcraft::{
            adapters::win::process::WinProcessRunner, compose::windows_app, domain::ToolKind,
            ports::process::ProcessRunner,
        };
        let app = windows_app();
        let mut executables = vec![];
        for installation in app.list_tools(ToolKind::Git)? {
            if !installation.available {
                continue;
            }
            for relative in ["cmd/git.exe", "bin/git.exe", "git.exe"] {
                let path = installation.installation.root.join(relative);
                if path.is_file() {
                    executables.push(ConfigExecutable {
                        path: path.display().to_string(),
                        label: format!(
                            "Git {} · {}",
                            installation.installation.version,
                            path.display()
                        ),
                        effective: installation.effective,
                    });
                    break;
                }
            }
        }
        let environment = WinProcessRunner.fresh_environment()?;
        let get = |key: &str| {
            environment
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| PathBuf::from(v))
        };
        let mut ssh_clients = vec![];
        if let (Some(windows), Some(profile), Some(program_data)) =
            (get("SystemRoot"), get("USERPROFILE"), get("ProgramData"))
        {
            let path = windows.join("System32/OpenSSH/ssh.exe");
            if path.is_file() {
                ssh_clients.push(ConfigurationSshClient {
                    executable: ConfigExecutable {
                        path: path.display().to_string(),
                        label: "Windows OpenSSH".into(),
                        effective: false,
                    },
                    user_config: profile.join(".ssh/config"),
                    system_config: program_data.join("ssh/ssh_config"),
                });
            }
        }
        for exe in &executables {
            for root in Path::new(&exe.path).ancestors().skip(1).take(3) {
                let path = root.join("usr/bin/ssh.exe");
                if path.is_file()
                    && !ssh_clients
                        .iter()
                        .any(|c| c.executable.path == path.display().to_string())
                {
                    ssh_clients.push(ConfigurationSshClient {
                        executable: ConfigExecutable {
                            path: path.display().to_string(),
                            label: format!("Git bundled SSH · {}", root.display()),
                            effective: exe.effective,
                        },
                        user_config: get("HOME")
                            .or_else(|| get("USERPROFILE"))
                            .unwrap_or_default()
                            .join(".ssh/config"),
                        system_config: root.join("etc/ssh/ssh_config"),
                    });
                    break;
                }
            }
        }
        Ok(ConfigurationRuntime {
            environment,
            executables,
            recent: app.settings()?.recent_repositories,
            ssh_clients,
        })
    }
    fn run(
        &self,
        executable: &str,
        args: &[String],
        env: &HashMap<String, String>,
        cwd: &Path,
    ) -> ConfigResult<ConfigProcessOutput> {
        let result = background_command(executable)
            .args(args)
            .env_clear()
            .envs(env)
            .current_dir(cwd)
            .output()?;
        Ok(ConfigProcessOutput {
            success: result.status.success(),
            stdout: String::from_utf8_lossy(&result.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&result.stderr).into_owned(),
        })
    }
    fn read(&self, path: &Path) -> ConfigResult<Option<Vec<u8>>> {
        match fs::metadata(path) {
            Ok(m) if m.len() > 4 * 1024 * 1024 => {
                return Err(WhichcraftError::InvalidInput(
                    "Configuration file exceeds 4 MiB".into(),
                ))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
            _ => {}
        }
        Ok(Some(fs::read(path)?))
    }
    fn first_line(&self, path: &Path) -> ConfigResult<Option<String>> {
        use std::io::Read;
        let file = match fs::File::open(path) {
            Ok(file) => file,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        let mut line = Vec::new();
        for byte in std::io::BufReader::new(file.take(FIRST_LINE_LIMIT)).bytes() {
            let byte = byte?;
            if byte == b'\n' {
                break;
            }
            line.push(byte);
        }
        Ok(Some(String::from_utf8_lossy(&line).into_owned()))
    }
    fn canonical(&self, path: &Path) -> ConfigResult<PathBuf> {
        Ok(fs::canonicalize(path)?)
    }
    fn fingerprint(&self, path: &Path) -> ConfigResult<String> {
        let metadata = fs::metadata(path)?;
        Ok(format!(
            "{}:{:?}:{:?}:{}",
            fs::canonicalize(path)?.display(),
            metadata.created()?,
            metadata.modified()?,
            metadata.len()
        ))
    }
    fn operation_id(&self) -> String {
        use crate::whichcraft::ports::operation_ids::OperationIds;
        static SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        format!(
            "config-{}-{}",
            crate::whichcraft::adapters::operation_ids::SystemOperationIds.new_apply_id(),
            SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        )
    }
    fn exists(&self, path: &Path) -> bool {
        path.exists()
    }
    fn directory(&self, path: &Path) -> bool {
        path.is_dir()
    }
    fn writable(&self, path: &Path) -> bool {
        use std::os::windows::fs::MetadataExt;
        fs::symlink_metadata(path).is_ok_and(|m| {
            m.is_file()
                && m.file_attributes() & (0x400 | 0x4000) == 0
                && !m.permissions().readonly()
        }) && fs::OpenOptions::new().write(true).open(path).is_ok()
    }
    fn glob(&self, pattern: &str) -> ConfigResult<Vec<PathBuf>> {
        let mut paths = glob::glob(pattern)
            .map_err(|_| WhichcraftError::InvalidInput("Invalid include glob".into()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| WhichcraftError::InvalidInput("Cannot read included path".into()))?;
        paths.sort();
        Ok(paths)
    }
    fn save_recent(&self, recent: &[String]) -> ConfigResult<()> {
        if self.isolated.is_some() {
            fs::write(
                self.journal.with_extension("recent"),
                serde_json::to_vec(recent)?,
            )?;
            return Ok(());
        }
        let app = crate::whichcraft::compose::windows_app();
        let mut settings = app.settings()?;
        settings.recent_repositories = recent.to_vec();
        app.save_settings(settings)
    }
    fn temporary(&self, _count: usize) -> ConfigResult<Box<dyn ConfigurationTemporary>> {
        Ok(Box::new(TemporaryFiles(tempfile::tempdir()?)))
    }
    fn publish(&self, path: &Path, expected: &[u8], candidate: &[u8]) -> ConfigResult<()> {
        #[cfg(test)]
        if let Some(hook) = &self.before_commit {
            return publish_guarded(path, expected, candidate, || hook(path));
        }
        publish_preserving_security(path, expected, candidate)
    }
    fn load_operation(&self) -> ConfigResult<Option<Vec<u8>>> {
        let Some(bytes) = self.read(&self.journal)? else {
            return Ok(None);
        };
        Ok(Some(crate::crypto::unprotect(&bytes)?))
    }
    fn save_operation(&self, bytes: &[u8]) -> ConfigResult<()> {
        use std::io::Write;
        let parent = self
            .journal
            .parent()
            .ok_or_else(|| WhichcraftError::InvalidInput("Missing journal folder".into()))?;
        fs::create_dir_all(parent)?;
        let bytes = crate::crypto::protect(bytes)?;
        let mut temp = tempfile::NamedTempFile::new_in(parent)?;
        temp.write_all(&bytes)?;
        temp.as_file().sync_all()?;
        let temp = temp.into_temp_path();
        if self.journal.exists() {
            replace(&temp, &self.journal)?;
        } else {
            temp.persist(&self.journal).map_err(|e| e.error)?;
        }
        Ok(())
    }
}

/// Long enough for any key header line (`-----BEGIN ENCRYPTED PRIVATE KEY-----`).
const FIRST_LINE_LIMIT: u64 = 80;

struct TemporaryFiles(tempfile::TempDir);
impl ConfigurationTemporary for TemporaryFiles {
    fn path(&self, index: usize) -> PathBuf {
        self.0.path().join(format!("config-{index}"))
    }
    fn write(&self, index: usize, bytes: &[u8]) -> ConfigResult<()> {
        fs::write(self.path(index), bytes)?;
        Ok(())
    }
}
fn security(path: &Path) -> ConfigResult<Vec<u8>> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Security::{
        GetFileSecurityW, DACL_SECURITY_INFORMATION, GROUP_SECURITY_INFORMATION,
        OWNER_SECURITY_INFORMATION,
    };
    let path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let flags = DACL_SECURITY_INFORMATION | OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION;
    let mut size = 0;
    unsafe { GetFileSecurityW(path.as_ptr(), flags, std::ptr::null_mut(), 0, &mut size) };
    if size == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    let mut buffer = vec![0u8; size as usize];
    if unsafe {
        GetFileSecurityW(
            path.as_ptr(),
            flags,
            buffer.as_mut_ptr().cast(),
            size,
            &mut size,
        )
    } == 0
    {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(buffer)
}
fn replace(replacement: &Path, target: &Path) -> ConfigResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::ReplaceFileW;
    let target: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    let replacement: Vec<u16> = replacement
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    if unsafe {
        ReplaceFileW(
            target.as_ptr(),
            replacement.as_ptr(),
            std::ptr::null(),
            0,
            std::ptr::null(),
            std::ptr::null(),
        )
    } == 0
    {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(())
}
fn publish_preserving_security(path: &Path, expected: &[u8], candidate: &[u8]) -> ConfigResult<()> {
    publish_guarded(path, expected, candidate, || {})
}
fn publish_guarded(
    path: &Path,
    expected: &[u8],
    candidate: &[u8],
    before_commit: impl FnOnce(),
) -> ConfigResult<()> {
    use std::{
        io::{Read, Seek, SeekFrom, Write},
        os::windows::{ffi::OsStrExt, fs::MetadataExt, io::FromRawHandle},
    };
    use windows_sys::Win32::{
        Foundation::{CloseHandle, GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE},
        Storage::FileSystem::{
            CommitTransaction, CreateFileTransactedW, CreateTransaction, RollbackTransaction,
            FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ, OPEN_EXISTING,
        },
    };
    struct Transaction(HANDLE);
    impl Drop for Transaction {
        fn drop(&mut self) {
            unsafe {
                RollbackTransaction(self.0);
                CloseHandle(self.0);
            }
        }
    }
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_file()
        || metadata.file_attributes() & 0x400 != 0
        || metadata.permissions().readonly()
    {
        return Err(WhichcraftError::InvalidInput(
            "Protected or redirected configuration target".into(),
        ));
    }
    let acl = security(path)?;
    // The transacted handle guards the target through comparison and atomic publication.
    // Unsupported file systems fail closed; never fall back to an unguarded replacement.
    let transaction = unsafe {
        CreateTransaction(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            std::ptr::null(),
        )
    };
    if transaction == INVALID_HANDLE_VALUE {
        return Err(std::io::Error::last_os_error().into());
    }
    let transaction = Transaction(transaction);
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let handle = unsafe {
        CreateFileTransactedW(
            wide.as_ptr(),
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            std::ptr::null_mut(),
            transaction.0,
            std::ptr::null(),
            std::ptr::null(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(WhichcraftError::InvalidInput(format!("Cannot acquire transactional configuration guard: {}. The file system must support guarded atomic writes.",std::io::Error::last_os_error())));
    }
    let mut file = unsafe { fs::File::from_raw_handle(handle) };
    let mut current = vec![];
    file.read_to_end(&mut current)?;
    if current != expected || security(path)? != acl {
        return Err(WhichcraftError::InvalidInput(
            "Source changed; refresh and review again".into(),
        ));
    }
    file.seek(SeekFrom::Start(0))?;
    file.write_all(candidate)?;
    file.set_len(candidate.len() as u64)?;
    file.sync_all()?;
    before_commit();
    drop(file);
    if unsafe { CommitTransaction(transaction.0) } == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    if security(path)? != acl {
        return Err(WhichcraftError::InvalidInput(
            "Written, but owner/ACL verification failed; inspect recovery status".into(),
        ));
    }
    Ok(())
}
