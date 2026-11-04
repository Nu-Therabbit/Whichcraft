use std::path::{Path, PathBuf};

use crate::error::WhichcraftError;
use crate::whichcraft::domain::{InstallerKind, ToolKind};
use crate::whichcraft::tools::paths_equal;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogEntry {
    pub install_root: PathBuf,
    pub kind: InstallerKind,
    pub display_name: String,
    pub uninstall_command: Option<String>,
}

/// Reads the uninstall entries once; the catalog it returns answers from that snapshot.
/// A source may reuse a recent snapshot, so callers that change installed programs invalidate it.
pub trait InstallerCatalogSource: Send + Sync {
    fn load(&self) -> Result<Box<dyn InstallerCatalog>, WhichcraftError>;

    /// Forgets any reused snapshot: the next `load` reads the uninstall entries again.
    fn invalidate(&self) {}
}

pub trait InstallerCatalog: Send + Sync {
    fn entries_for_root(
        &self,
        root: &std::path::Path,
    ) -> Result<Vec<CatalogEntry>, WhichcraftError>;

    /// Every folder an uninstall entry names, so tools installed there can be found.
    fn install_roots(&self) -> Vec<PathBuf> {
        Vec::new()
    }

    /// How `tool` at `root` was installed: its uninstall entry's kind, or a plain folder.
    fn kind_for_root(&self, tool: ToolKind, root: &Path) -> InstallerKind {
        owning_entry(self, tool, root)
            .ok()
            .flatten()
            .map(|e| e.kind)
            .unwrap_or(InstallerKind::FolderOnly)
    }
}

/// The uninstall entry `root` belongs to. When that entry is a larger program holding the tool
/// in a subfolder (Android Studio and its `jbr`), its uninstaller would remove the whole program,
/// so the entry is marked `Bundled` instead.
pub fn owning_entry<C: InstallerCatalog + ?Sized>(
    catalog: &C,
    tool: ToolKind,
    root: &Path,
) -> Result<Option<CatalogEntry>, WhichcraftError> {
    let Some(mut entry) = catalog.entries_for_root(root)?.into_iter().next() else {
        return Ok(None);
    };
    if !paths_equal(&entry.install_root, root) && !names_tool(tool, &entry.display_name) {
        entry.kind = InstallerKind::Bundled;
    }
    Ok(Some(entry))
}

/// Whether an uninstall entry's name is the tool's own package rather than a program bundling it.
fn names_tool(tool: ToolKind, display_name: &str) -> bool {
    let name = display_name.to_ascii_lowercase();
    let words: &[&str] = match tool {
        ToolKind::Java => &[
            "jdk",
            "java",
            "openjdk",
            "temurin",
            "adoptium",
            "corretto",
            "zulu",
            "semeru",
            "sapmachine",
            "liberica",
            "graalvm",
        ],
        ToolKind::Node => &["node.js"],
        ToolKind::Python => &["python"],
        ToolKind::Go => &["go programming language"],
        ToolKind::Flutter => &["flutter"],
        ToolKind::Git => &["git version", "git for windows"],
    };
    words.iter().any(|w| name.contains(w)) || (tool == ToolKind::Git && name == "git")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::whichcraft::fake::FakeInstallerCatalog;

    fn entry(root: &str, name: &str) -> CatalogEntry {
        CatalogEntry {
            install_root: PathBuf::from(root),
            kind: InstallerKind::InnoSetup,
            display_name: name.into(),
            uninstall_command: Some("uninstall.exe".into()),
        }
    }

    fn kind(entries: Vec<CatalogEntry>, tool: ToolKind, root: &str) -> InstallerKind {
        FakeInstallerCatalog { entries }.kind_for_root(tool, Path::new(root))
    }

    #[test]
    fn a_runtime_inside_another_program_is_bundled_with_it() {
        let studio = entry(r"C:\Programs\Android Studio", "Android Studio");
        assert_eq!(
            kind(
                vec![studio],
                ToolKind::Java,
                r"C:\Programs\Android Studio\jbr"
            ),
            InstallerKind::Bundled
        );
    }

    #[test]
    fn a_jdk_whose_own_entry_names_a_parent_folder_keeps_its_installer() {
        let zulu = entry(
            r"C:\Program Files\Zulu",
            "Azul Zulu JDK 21.42.19 (21.0.7), 64-bit",
        );
        assert_eq!(
            kind(vec![zulu], ToolKind::Java, r"C:\Program Files\Zulu\zulu-21"),
            InstallerKind::InnoSetup
        );
    }

    #[test]
    fn an_entry_for_the_folder_itself_is_never_bundled() {
        let jdk = entry(r"C:\jdk\", "Something");
        assert_eq!(
            kind(vec![jdk], ToolKind::Java, r"C:\jdk"),
            InstallerKind::InnoSetup
        );
    }
}
