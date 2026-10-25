//! Download sizes for the install screen. `mise ls-remote --json` reports none, so the size is
//! read from the archive's own download URL with a HEAD request.

use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;

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
    // A HEAD response has an empty body, so reqwest's body size hint is zero even
    // when the archive's advertised Content-Length is present.
    Ok(response
        .headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|bytes| *bytes > 0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn head_uses_archive_header_and_leaves_missing_or_empty_sizes_unknown() {
        fn lookup(reply: &'static str) -> Option<u64> {
            use std::io::{Read, Write};
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                socket.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
                let mut request = [0; 4096];
                let count = socket.read(&mut request).unwrap();
                assert!(request[..count].starts_with(b"HEAD "));
                socket.write_all(reply.as_bytes()).unwrap();
            });
            let result = http_content_length(&format!("http://{address}/archive.zip")).unwrap();
            server.join().unwrap();
            result
        }
        assert_eq!(lookup("HTTP/1.1 200 OK\r\nContent-Length: 35604229\r\nConnection: close\r\n\r\n"), Some(35_604_229));
        assert_eq!(lookup("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n"), None);
        assert_eq!(lookup("HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), None);
        assert_eq!(lookup("HTTP/1.1 404 Not Found\r\nContent-Length: 12\r\nConnection: close\r\n\r\n"), None);
    }

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
