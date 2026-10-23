#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JavaRelease {
    pub implementor: String,
    pub version: String,
}

/// Parse a JDK `release` file (key=value lines, values may be quoted).
pub fn parse_release_file(content: &str) -> Option<JavaRelease> {
    let mut implementor = None;
    let mut version = None;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = line.split_once('=')?;
        let value = value.trim().trim_matches('"');
        match key.trim() {
            "IMPLEMENTOR" => implementor = Some(value.to_string()),
            "JAVA_VERSION" => version = Some(value.to_string()),
            _ => {}
        }
    }
    Some(JavaRelease {
        implementor: implementor?,
        version: version?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_adoptium_release() {
        let content = r#"
IMPLEMENTOR="Eclipse Adoptium"
JAVA_VERSION="21.0.12.1"
OS_NAME="Windows"
"#;
        let parsed = parse_release_file(content).expect("parse");
        assert_eq!(parsed.implementor, "Eclipse Adoptium");
        assert_eq!(parsed.version, "21.0.12.1");
    }
}
