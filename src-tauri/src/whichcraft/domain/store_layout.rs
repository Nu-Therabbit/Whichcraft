//! Where Whichcraft keeps the tools it installs inside an install store (ADR-0002).

use std::path::{Path, PathBuf};

use super::tool::ToolKind;

/// Where mise puts one tool's versions inside an install store, e.g. `<store>\_mise\data\installs\node`.
pub fn mise_installs_dir(install_store: &Path, tool: ToolKind) -> Option<PathBuf> {
    let name = match tool {
        ToolKind::Java => "java",
        ToolKind::Node => "node",
        ToolKind::Python => "python",
        ToolKind::Go => "go",
        // mise turns the `vfox:jdx/vfox-flutter` backend into this directory name.
        ToolKind::Flutter => "vfox-jdx-vfox-flutter",
        ToolKind::Git => return None,
    };
    Some(install_store.join("_mise").join("data").join("installs").join(name))
}
