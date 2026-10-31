//! Profiles: named sets of pinned tool versions, and which installation a pin means (F-4, F-5).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::EnvarlyError;

use super::installation::{ToolInstallation, ToolInstallationView};
use super::tool::ToolKind;
use super::versions::{release_numbers, RemoteVersion};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileToolPin {
    pub tool: ToolKind,
    pub vendor: String,
    pub version: String,
    pub preferred_root: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolProfile {
    pub id: String,
    pub name: String,
    pub tools: Vec<ProfileToolPin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileMatchStatus {
    pub profile: ToolProfile,
    pub matches_effective: bool,
    pub unavailable: Vec<ProfileToolPin>,
}

/// A pin with no installation on this machine, and what Whichcraft could install for it (F-3).
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MissingPin {
    pub pin: ProfileToolPin,
    /// The version to install, as the remote list spells it; `None` when Whichcraft cannot.
    pub install_version: Option<String>,
    pub download_bytes: Option<u64>,
}

/// The remote release a pin means. Whichcraft installs Temurin only, so other Java vendors are
/// not installable; a four-part MSI version such as 17.0.20.1 matches the 17.0.20 release.
pub fn remote_for_pin(pin: &ProfileToolPin, remote: &[RemoteVersion]) -> Option<String> {
    if pin.tool == ToolKind::Git {
        return None;
    }
    if pin.tool == ToolKind::Java {
        let vendor = pin.vendor.to_ascii_lowercase();
        if !vendor.contains("adoptium") && !vendor.contains("temurin") {
            return None;
        }
    }
    let wanted = release_numbers(pin.tool, &pin.version)?;
    let numbered: Vec<(Vec<u64>, &String)> = remote
        .iter()
        .filter_map(|r| Some((release_numbers(pin.tool, &r.version)?, &r.version)))
        .collect();
    numbered
        .iter()
        .find(|(n, _)| *n == wanted)
        .or_else(|| {
            numbered
                .iter()
                .filter(|(n, _)| n.len() >= 3 && wanted.starts_with(n))
                .max_by(|a, b| a.0.cmp(&b.0))
        })
        .map(|(_, v)| (*v).clone())
}

/// Missing pins of a profile with what to install for each.
pub fn missing_pins(
    unavailable: &[ProfileToolPin],
    remote: impl Fn(ToolKind) -> Result<Vec<RemoteVersion>, EnvarlyError>,
    size: impl Fn(ToolKind, &str) -> Option<u64>,
) -> Result<Vec<MissingPin>, EnvarlyError> {
    unavailable
        .iter()
        .map(|pin| {
            let install_version = if pin.tool == ToolKind::Git {
                None
            } else {
                remote_for_pin(pin, &remote(pin.tool)?)
            };
            Ok(MissingPin {
                download_bytes: install_version.as_deref().and_then(|v| size(pin.tool, v)),
                pin: pin.clone(),
                install_version,
            })
        })
        .collect()
}

/// Whether a pin refers to this installation: same tool, vendor and full version, and either no
/// remembered root or that one.
pub fn pin_means(pin: &ProfileToolPin, inst: &ToolInstallation) -> bool {
    pin.tool == inst.tool
        && pin.vendor.eq_ignore_ascii_case(&inst.vendor)
        && pin.version == inst.version
        && pin.preferred_root.as_ref().is_none_or(|r| *r == inst.root)
}

/// Names of the profiles with a pin that means `inst` (F-5).
pub fn profiles_using(profiles: &[ToolProfile], inst: &ToolInstallation) -> Vec<String> {
    profiles
        .iter()
        .filter(|p| p.tools.iter().any(|pin| pin_means(pin, inst)))
        .map(|p| p.name.clone())
        .collect()
}

/// Points every pin that means `from` at `to` instead (F-5). Returns the names of the profiles
/// that changed.
pub fn repoint_profiles(
    profiles: &mut [ToolProfile],
    from: &ToolInstallation,
    to: &ToolInstallation,
) -> Vec<String> {
    let mut changed = Vec::new();
    for profile in profiles.iter_mut() {
        let mut touched = false;
        for pin in profile.tools.iter_mut() {
            if pin_means(pin, from) {
                *pin = ProfileToolPin {
                    tool: to.tool,
                    vendor: to.vendor.clone(),
                    version: to.version.clone(),
                    preferred_root: Some(to.root.clone()),
                };
                touched = true;
            }
        }
        if touched {
            changed.push(profile.name.clone());
        }
    }
    changed
}

/// Finds the installation a pin means: same vendor and full version, preferring the remembered
/// root when several match. Anything else counts as unavailable; there is no fallback.
pub fn resolve_pin(
    installs: &[ToolInstallationView],
    pin: &ProfileToolPin,
) -> Option<ToolInstallationView> {
    let matching: Vec<&ToolInstallationView> = installs
        .iter()
        .filter(|v| {
            v.available
                && v.installation.vendor.eq_ignore_ascii_case(&pin.vendor)
                && v.installation.version == pin.version
        })
        .collect();
    pin.preferred_root
        .as_ref()
        .and_then(|root| matching.iter().find(|v| &v.installation.root == root))
        .or_else(|| matching.first())
        .map(|v| (*v).clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pin(tool: ToolKind, vendor: &str, version: &str, root: Option<PathBuf>) -> ProfileToolPin {
        ProfileToolPin {
            tool,
            vendor: vendor.into(),
            version: version.into(),
            preferred_root: root,
        }
    }
    fn remote(versions: &[&str]) -> Vec<RemoteVersion> {
        versions
            .iter()
            .map(|v| RemoteVersion {
                version: (*v).into(),
                download_bytes: None,
                install_bytes: None,
            })
            .collect()
    }

    #[test]
    fn missing_pins_map_to_the_release_whichcraft_would_install() {
        let java = remote(&["17.0.20+8", "21.0.12+101.0.LTS"]);
        assert_eq!(
            remote_for_pin(
                &pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", None),
                &java
            )
            .as_deref(),
            Some("21.0.12+101.0.LTS")
        );
        assert_eq!(
            remote_for_pin(
                &pin(ToolKind::Java, "Eclipse Adoptium", "17.0.20.1", None),
                &java
            )
            .as_deref(),
            Some("17.0.20+8")
        );
        assert_eq!(
            remote_for_pin(
                &pin(ToolKind::Java, "JetBrains s.r.o.", "21.0.12", None),
                &java
            ),
            None,
            "only Temurin installs"
        );
        assert_eq!(
            remote_for_pin(
                &pin(ToolKind::Node, "Node.js", "20.19.0", None),
                &remote(&["20.19.0", "22.23.4"])
            )
            .as_deref(),
            Some("20.19.0")
        );
        assert_eq!(
            remote_for_pin(
                &pin(ToolKind::Node, "Node.js", "20.19.9", None),
                &remote(&["20.19.0"])
            ),
            None
        );

        let unavailable = vec![
            pin(ToolKind::Node, "Node.js", "20.19.0", None),
            pin(ToolKind::Git, "Git", "2.55.0", None),
        ];
        let missing = missing_pins(
            &unavailable,
            |_| Ok(remote(&["20.19.0"])),
            |_, _| Some(30_000_000),
        )
        .unwrap();
        assert_eq!(missing[0].install_version.as_deref(), Some("20.19.0"));
        assert_eq!(missing[0].download_bytes, Some(30_000_000));
        assert_eq!(missing[1].install_version, None, "Git is switch-only");
        assert_eq!(missing[1].download_bytes, None);
    }

    #[test]
    fn repointing_moves_only_pins_that_mean_the_old_installation() {
        let old = ToolInstallation {
            tool: ToolKind::Java,
            vendor: "Eclipse Adoptium".into(),
            version: "21.0.12".into(),
            root: "C:\\old".into(),
            managed: true,
        };
        let new = ToolInstallation {
            tool: ToolKind::Java,
            vendor: "Eclipse Adoptium".into(),
            version: "21.0.13".into(),
            root: "C:\\new".into(),
            managed: true,
        };
        let mut profiles = vec![
            ToolProfile {
                id: "a".into(),
                name: "Android".into(),
                tools: vec![pin(ToolKind::Java, "Eclipse Adoptium", "21.0.12", None)],
            },
            ToolProfile {
                id: "b".into(),
                name: "Other copy".into(),
                tools: vec![pin(
                    ToolKind::Java,
                    "Eclipse Adoptium",
                    "21.0.12",
                    Some("C:\\elsewhere".into()),
                )],
            },
            ToolProfile {
                id: "c".into(),
                name: "Web".into(),
                tools: vec![pin(ToolKind::Node, "Node.js", "22.23.4", None)],
            },
        ];
        assert_eq!(
            profiles_using(&profiles, &old),
            vec!["Android"],
            "a pin at another root means another copy"
        );
        let changed = repoint_profiles(&mut profiles, &old, &new);
        assert_eq!(changed, vec!["Android"]);
        assert_eq!(
            profiles[0].tools[0],
            pin(
                ToolKind::Java,
                "Eclipse Adoptium",
                "21.0.13",
                Some("C:\\new".into())
            )
        );
        assert_eq!(profiles[1].tools[0].version, "21.0.12");
    }
}
