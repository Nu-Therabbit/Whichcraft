use std::path::{Path, PathBuf};

use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::tools::fs_util::is_reparse_point;

pub fn probe_tool_root(tool: ToolKind, root: &Path, managed: bool) -> Option<ToolInstallation> {
    if is_reparse_point(root) {
        return None;
    }
    match tool {
        ToolKind::Java => {
            let inst = crate::whichcraft::java::probe_java_root(root, managed)?;
            Some(ToolInstallation {
                tool: ToolKind::Java,
                vendor: inst.vendor,
                version: inst.version,
                root: inst.root,
                managed: inst.managed,
            })
        }
        ToolKind::Node => probe_node(root, managed),
        ToolKind::Python => probe_python(root, managed),
        ToolKind::Go => probe_go(root, managed),
        ToolKind::Flutter => probe_flutter(root, managed),
        ToolKind::Git => probe_git(root, managed),
    }
}

fn probe_node(root: &Path, managed: bool) -> Option<ToolInstallation> {
    let node_exe = root.join("node.exe");
    if is_reparse_point(&node_exe) || !node_exe.is_file() {
        return None;
    }
    let version = run_version_cmd(&node_exe, &["-p", "process.version"]).unwrap_or_else(|| "unknown".into());
    Some(ToolInstallation {
        tool: ToolKind::Node,
        vendor: "Node.js".into(),
        version: version.trim_matches('\"').to_string(),
        root: root.to_path_buf(),
        managed,
    })
}

fn probe_python(root: &Path, managed: bool) -> Option<ToolInstallation> {
    let python_exe = root.join("python.exe");
    let lib = root.join("Lib");
    if is_reparse_point(&python_exe) || !python_exe.is_file() || !lib.is_dir() {
        return None;
    }
    let version = run_version_cmd(&python_exe, &["--version"])
        .map(|s| s.trim_start_matches("Python ").to_string())
        .unwrap_or_else(|| "unknown".into());
    Some(ToolInstallation {
        tool: ToolKind::Python,
        vendor: "Python".into(),
        version,
        root: root.to_path_buf(),
        managed,
    })
}

fn probe_go(root: &Path, managed: bool) -> Option<ToolInstallation> {
    let version_file = root.join("VERSION");
    let go_exe = root.join("bin").join("go.exe");
    if is_reparse_point(&go_exe) || !go_exe.is_file() {
        return None;
    }
    let version = std::fs::read_to_string(version_file)
        .ok()
        .map(|s| {
            s.lines()
                .next()
                .unwrap_or("unknown")
                .trim()
                .trim_start_matches("go")
                .to_string()
        })
        .unwrap_or_else(|| "unknown".into());
    Some(ToolInstallation {
        tool: ToolKind::Go,
        vendor: "Go".into(),
        version,
        root: root.to_path_buf(),
        managed,
    })
}

fn probe_flutter(root: &Path, managed: bool) -> Option<ToolInstallation> {
    let flutter_bat = root.join("bin").join("flutter.bat");
    let version_json = root.join("bin").join("cache").join("flutter.version.json");
    if is_reparse_point(&flutter_bat) || !flutter_bat.is_file() || !version_json.is_file() {
        return None;
    }
    let version = std::fs::read_to_string(version_json)
        .ok()
        .and_then(|text| {
            let v: serde_json::Value = serde_json::from_str(&text).ok()?;
            v.get("frameworkVersion")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "unknown".into());
    Some(ToolInstallation {
        tool: ToolKind::Flutter,
        vendor: "Flutter".into(),
        version,
        root: root.to_path_buf(),
        managed,
    })
}

fn probe_git(root: &Path, managed: bool) -> Option<ToolInstallation> {
    let git_exe = root.join("bin").join("git.exe");
    if is_reparse_point(&git_exe) || !git_exe.is_file() {
        return None;
    }
    let version = run_version_cmd(&git_exe, &["--version"])
        .map(|s| {
            s.strip_prefix("git version ")
                .unwrap_or(&s)
                .split_whitespace()
                .next()
                .unwrap_or("unknown")
                .to_string()
        })
        .unwrap_or_else(|| "unknown".into());
    Some(ToolInstallation {
        tool: ToolKind::Git,
        vendor: "Git".into(),
        version,
        root: root.to_path_buf(),
        managed,
    })
}

fn run_version_cmd(exe: &Path, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new(exe).args(args).output().ok()?;
    if !output.status.success() && output.stdout.is_empty() {
        return None;
    }
    let text = if output.stdout.is_empty() {
        String::from_utf8_lossy(&output.stderr).into_owned()
    } else {
        String::from_utf8_lossy(&output.stdout).into_owned()
    };
    Some(text.trim().to_string())
}

pub fn command_search_dirs(tool: ToolKind) -> &'static [&'static str] {
    match tool {
        ToolKind::Java => &["bin"],
        ToolKind::Node => &["."],
        ToolKind::Python => &["."],
        ToolKind::Go => &["bin"],
        ToolKind::Flutter => &["bin"],
        ToolKind::Git => &["bin", "cmd"],
    }
}

pub fn command_name(tool: ToolKind) -> &'static str {
    match tool {
        ToolKind::Java => "java",
        ToolKind::Node => "node",
        ToolKind::Python => "python",
        ToolKind::Go => "go",
        ToolKind::Flutter => "flutter",
        ToolKind::Git => "git",
    }
}

pub fn infer_root_from_command_dir(tool: ToolKind, dir: &Path) -> Option<PathBuf> {
    match tool {
        ToolKind::Java => dir.parent().map(|p| p.to_path_buf()),
        ToolKind::Node | ToolKind::Python => Some(dir.to_path_buf()),
        ToolKind::Go => dir.parent().and_then(|p| p.parent()).map(|p| p.to_path_buf()),
        ToolKind::Flutter => dir.parent().and_then(|p| p.parent()).map(|p| p.to_path_buf()),
        ToolKind::Git => {
            if dir.file_name().is_some_and(|n| n.eq_ignore_ascii_case("cmd")) {
                dir.parent().map(|p| p.to_path_buf())
            } else {
                dir.parent().and_then(|p| p.parent()).map(|p| p.to_path_buf())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn probe_go_reads_version_file() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("bin")).unwrap();
        fs::write(root.join("VERSION"), "go1.27.0\n").unwrap();
        fs::write(root.join("bin").join("go.exe"), b"").unwrap();
        let inst = probe_go(root, false).unwrap();
        assert_eq!(inst.version, "1.27.0");
    }

    #[test]
    fn probe_flutter_reads_version_json() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("bin").join("cache")).unwrap();
        fs::write(root.join("bin").join("flutter.bat"), b"").unwrap();
        fs::write(
            root.join("bin").join("cache").join("flutter.version.json"),
            r#"{"frameworkVersion":"3.32.4"}"#,
        )
        .unwrap();
        let inst = probe_flutter(root, false).unwrap();
        assert_eq!(inst.version, "3.32.4");
    }
}
