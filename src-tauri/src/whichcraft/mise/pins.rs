pub const MISE_VERSION: &str = "v2026.10.17";
pub const MISE_WINDOWS_X64_SHA256: &str =
    "32bcfda5f72bf7cb189e18ba93c2798bffcb4a678fd004e3127780363f2d8c8c";

pub const VFOX_FLUTTER_PLUGIN_SHA: &str = "835840d23e05bfe0de18ef85cfead412e33c3039";

pub fn mise_download_url() -> String {
    format!(
        "https://github.com/jdx/mise/releases/download/{MISE_VERSION}/mise-{MISE_VERSION}-windows-x64.zip"
    )
}
