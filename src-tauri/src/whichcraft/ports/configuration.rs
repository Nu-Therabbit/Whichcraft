use crate::{error::WhichcraftError, whichcraft::domain::configuration::ConfigExecutable};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

pub type ConfigResult<T> = Result<T, WhichcraftError>;
#[derive(Debug, Clone)]
pub struct ConfigurationRuntime {
    pub environment: HashMap<String, String>,
    pub executables: Vec<ConfigExecutable>,
    pub recent: Vec<String>,
    pub ssh_clients: Vec<ConfigurationSshClient>,
}
#[derive(Debug, Clone)]
pub struct ConfigurationSshClient {
    pub executable: ConfigExecutable,
    pub user_config: PathBuf,
    pub system_config: PathBuf,
}
pub struct ConfigProcessOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}
pub trait ConfigurationTemporary: Send {
    fn path(&self, index: usize) -> PathBuf;
    fn write(&self, index: usize, bytes: &[u8]) -> ConfigResult<()>;
}
pub trait ConfigurationIo: Send + Sync {
    fn runtime(&self) -> ConfigResult<ConfigurationRuntime>;
    fn run(
        &self,
        executable: &str,
        args: &[String],
        env: &HashMap<String, String>,
        cwd: &Path,
    ) -> ConfigResult<ConfigProcessOutput>;
    fn read(&self, path: &Path) -> ConfigResult<Option<Vec<u8>>>;
    /// At most the first line of a file (a few dozen bytes), so a private key can be recognised
    /// by its header without reading the key itself.
    fn first_line(&self, path: &Path) -> ConfigResult<Option<String>>;
    fn canonical(&self, path: &Path) -> ConfigResult<PathBuf>;
    fn fingerprint(&self, path: &Path) -> ConfigResult<String>;
    fn operation_id(&self) -> String;
    fn exists(&self, path: &Path) -> bool;
    fn directory(&self, path: &Path) -> bool;
    fn writable(&self, path: &Path) -> bool;
    fn glob(&self, pattern: &str) -> ConfigResult<Vec<PathBuf>>;
    fn save_recent(&self, recent: &[String]) -> ConfigResult<()>;
    fn temporary(&self, count: usize) -> ConfigResult<Box<dyn ConfigurationTemporary>>;
    fn publish(&self, path: &Path, expected: &[u8], candidate: &[u8]) -> ConfigResult<()>;
    fn load_operation(&self) -> ConfigResult<Option<Vec<u8>>>;
    fn save_operation(&self, bytes: &[u8]) -> ConfigResult<()>;
}
