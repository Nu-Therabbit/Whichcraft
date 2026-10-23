mod probe;
mod release;

pub use probe::{probe_java_root, JavaInstallation};
pub use release::parse_release_file;
