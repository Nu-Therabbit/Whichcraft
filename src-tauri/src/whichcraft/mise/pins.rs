pub const MISE_VERSION: &str = "v2026.10.17";
pub const MISE_WINDOWS_X64_SHA256: &str =
    "32bcfda5f72bf7cb189e18ba93c2798bffcb4a678fd004e3127780363f2d8c8c";
/// SHA-256 of the `mise.exe` inside that zip, so an extracted copy can be re-checked later.
pub const MISE_WINDOWS_X64_EXE_SHA256: &str =
    "d38bd78b63ca1e913e1d55cbd1633b45e9b01f2735ac81b1915f84f75a3eb5cd";

pub const VFOX_FLUTTER_PLUGIN_SHA: &str = "835840d23e05bfe0de18ef85cfead412e33c3039";

pub fn mise_download_url() -> String {
    format!(
        "https://github.com/jdx/mise/releases/download/{MISE_VERSION}/mise-{MISE_VERSION}-windows-x64.zip"
    )
}
