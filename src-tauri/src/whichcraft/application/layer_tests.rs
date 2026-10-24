//! Architecture tests for the application layer (ADR-0005).

#[cfg(test)]
mod tests {
    fn strip_cfg_test_mod(rest: &str) -> Option<&str> {
        let mut s = rest;
        while s.as_bytes().first().is_some_and(|b| b.is_ascii_whitespace()) {
            s = &s[1..];
        }
        loop {
            let mut advanced = false;
            for prefix in ["pub(crate)", "pub(super)", "pub"] {
                if s.starts_with(prefix) {
                    s = &s[prefix.len()..];
                    advanced = true;
                    break;
                }
            }
            if advanced {
                continue;
            }
            break;
        }
        while s.as_bytes().first().is_some_and(|b| b.is_ascii_whitespace()) {
            s = &s[1..];
        }
        if !s.starts_with("mod ") {
            return None;
        }
        s = &s["mod ".len()..];
        while s.as_bytes().first().is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'_') {
            s = &s[1..];
        }
        while s.as_bytes().first().is_some_and(|b| b.is_ascii_whitespace()) {
            s = &s[1..];
        }
        if s.starts_with(';') {
            return Some(&s[1..]);
        }
        if s.starts_with('{') {
            s = &s[1..];
            let mut depth = 1usize;
            for (i, b) in s.bytes().enumerate() {
                match b {
                    b'{' => depth += 1,
                    b'}' => {
                        depth -= 1;
                        if depth == 0 {
                            return Some(&s[i + 1..]);
                        }
                    }
                    _ => {}
                }
            }
        }
        None
    }

    /// Drops `#[cfg(test)]` modules so production code after an early test-only `mod` is still scanned.
    fn production_rust_source(source: &str) -> String {
        let mut out = String::new();
        let mut rest = source;
        while let Some(idx) = rest.find("#[cfg(test)]") {
            out.push_str(&rest[..idx]);
            rest = &rest[idx + "#[cfg(test)]".len()..];
            match strip_cfg_test_mod(rest) {
                Some(remainder) => rest = remainder,
                None => {
                    out.push_str("#[cfg(test)]");
                    out.push_str(rest);
                    break;
                }
            }
        }
        out.push_str(rest);
        out
    }

    /// Production application code must reach the outside world only through ports (ADR-0005).
    #[test]
    fn production_application_avoids_concrete_adapters_and_io() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/whichcraft/application");
        // `env_store`, `model`, `path_manage`, and registry/PATH helpers in `whichcraft::tools`
        // are the inherited adapter/type exception (ADR-0005).
        let forbidden = [
            "whichcraft::persistence",
            "whichcraft::mise",
            "whichcraft::adapters",
            "crate::commands",
            "chrono::",
            "reqwest",
            "winreg",
            "windows_sys",
        ];
        for entry in std::fs::read_dir(&dir).unwrap().flatten() {
            if entry.path().extension().and_then(|e| e.to_str()) != Some("rs") {
                continue;
            }
            if entry.file_name() == "layer_tests.rs" {
                continue;
            }
            let text = std::fs::read_to_string(entry.path()).unwrap();
            let code = production_rust_source(&text);
            for word in forbidden {
                assert!(!code.contains(word), "{} uses {word}", entry.path().display());
            }
        }
    }

    fn production_rust_files(dir: &std::path::Path, out: &mut Vec<std::path::PathBuf>) {
        for entry in std::fs::read_dir(dir).unwrap().flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            // Test-only modules: declared under #[cfg(test)] by their parents.
            if name == "fake" || name == "contract" || name.ends_with("_tests.rs") {
                continue;
            }
            if path.is_dir() {
                production_rust_files(&path, out);
            } else if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                out.push(path);
            }
        }
    }

    /// The GUI has no console, so a console program started without `CREATE_NO_WINDOW` pops up a
    /// window (a Windows Terminal window on Windows 11) — once per version probe. Background
    /// programs go through `background_command`; only the process adapter opens windows on purpose
    /// (the user's terminal, Explorer).
    #[test]
    fn background_programs_start_without_a_window() {
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        let allowed = ["tools/background.rs", "adapters/win/process.rs"];
        let mut files = Vec::new();
        production_rust_files(&src, &mut files);
        assert!(files.len() > 50, "scanned {} files", files.len());
        for path in files {
            let shown = path.to_string_lossy().replace('\\', "/");
            if allowed.iter().any(|a| shown.ends_with(a)) {
                continue;
            }
            let code = production_rust_source(&std::fs::read_to_string(&path).unwrap());
            assert!(
                !code.contains("Command::new("),
                "{shown} starts a program directly; use tools::background::background_command"
            );
        }
    }

    #[test]
    fn production_scan_keeps_code_after_an_early_test_only_module() {
        let sample = r#"
pub mod app;
#[cfg(test)]
mod app_tests;
pub fn registry_expander() {}
"#;
        assert!(production_rust_source(sample).contains("registry_expander"));
        assert!(!production_rust_source(sample).contains("app_tests"));
    }

    #[test]
    fn production_scan_strips_pub_crate_test_modules() {
        let sample = r#"
fn production() {}
#[cfg(test)]
pub(crate) mod test_support {
    use crate::whichcraft::persistence::FileStore;
}
#[cfg(test)]
mod tests {}
"#;
        let code = production_rust_source(sample);
        assert!(code.contains("production"));
        assert!(!code.contains("persistence"));
    }
}
