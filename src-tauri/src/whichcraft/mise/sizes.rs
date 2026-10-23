//! Download sizes for the install screen. `mise ls-remote --json` reports none, so the size is
//! read from the archive's own download URL with a HEAD request.

use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;

/// The archive mise downloads for a version, when its URL can be predicted. Temurin and
/// python-build-standalone names carry build numbers and dates that the version alone does not
/// give, so they have none.
pub fn download_url(tool: ToolKind, version: &str) -> Option<String> {
    match tool {
        ToolKind::Node => Some(format!(
            "https://nodejs.org/dist/v{version}/node-v{version}-win-x64.zip"
        )),
        ToolKind::Go => Some(format!("https://go.dev/dl/go{version}.windows-amd64.zip")),
        ToolKind::Flutter => Some(format!(
            "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_{version}-stable.zip"
        )),
        ToolKind::Java | ToolKind::Python | ToolKind::Git => None,
    }
}

/// Size in bytes, or `None` when it cannot be known up front.
pub fn download_size(
    tool: ToolKind,
    version: &str,
    content_length: impl Fn(&str) -> Result<Option<u64>, EnvarlyError>,
) -> Result<Option<u64>, EnvarlyError> {
    match download_url(tool, version) {
        Some(url) => content_length(&url),
        None => Ok(None),
    }
}

/// `Content-Length` of a HEAD request, following redirects.
pub fn http_content_length(url: &str) -> Result<Option<u64>, EnvarlyError> {
    let response = reqwest::blocking::Client::new()
        .head(url)
        .send()
        .map_err(|e| EnvarlyError::InvalidInput(format!("size lookup failed: {e}")))?;
    if !response.status().is_success() {
        return Ok(None);
    }
    Ok(response.content_length())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_go_and_flutter_sizes_come_from_their_archive_urls() {
        let seen = std::sync::Mutex::new(Vec::new());
        let head = |url: &str| {
            seen.lock().unwrap().push(url.to_string());
            Ok(Some(42))
        };
        assert_eq!(download_size(ToolKind::Node, "22.23.4", head).unwrap(), Some(42));
        assert_eq!(download_size(ToolKind::Go, "1.26.10", head).unwrap(), Some(42));
        assert_eq!(download_size(ToolKind::Flutter, "3.47.7", head).unwrap(), Some(42));
        assert_eq!(
            *seen.lock().unwrap(),
            vec![
                "https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip",
                "https://go.dev/dl/go1.26.10.windows-amd64.zip",
                "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.47.7-stable.zip",
            ]
        );
    }

    #[test]
    fn tools_without_a_predictable_url_report_an_unknown_size() {
        let head = |_: &str| -> Result<Option<u64>, EnvarlyError> { panic!("no request expected") };
        assert_eq!(download_size(ToolKind::Java, "21.0.12+101.0.LTS", head).unwrap(), None);
        assert_eq!(download_size(ToolKind::Python, "3.13.17", head).unwrap(), None);
    }
}
