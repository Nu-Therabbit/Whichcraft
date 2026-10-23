use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::persistence::whichcraft_data_dir;
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::services::tool_apply::{apply_tool_plan, create_tool_plan};
use crate::whichcraft::services::tool_inventory::list_tool_installations;
use crate::whichcraft::services::tool_plan::ToolApplyPlan;

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

fn profiles_path() -> Result<PathBuf, EnvarlyError> {
    Ok(whichcraft_data_dir()?.join("profiles.json"))
}

pub fn load_profiles() -> Result<Vec<ToolProfile>, EnvarlyError> {
    let path = profiles_path()?;
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| EnvarlyError::Snapshot(format!("read profiles: {e}")))?;
    serde_json::from_str(&raw).map_err(|e| EnvarlyError::Snapshot(format!("parse profiles: {e}")))
}

pub fn save_profiles(profiles: &[ToolProfile]) -> Result<(), EnvarlyError> {
    let path = profiles_path()?;
    std::fs::write(
        &path,
        serde_json::to_string_pretty(profiles)
            .map_err(|e| EnvarlyError::Snapshot(format!("serialize profiles: {e}")))?,
    )
    .map_err(|e| EnvarlyError::Snapshot(format!("write profiles: {e}")))?;
    Ok(())
}

pub fn profile_status<B: EnvBackend>(
    backend: &B,
    profile: &ToolProfile,
) -> Result<ProfileMatchStatus, EnvarlyError> {
    let mut unavailable = Vec::new();
    let mut all_match = true;
    for pin in &profile.tools {
        let installs = list_tool_installations(backend, pin.tool, None)?;
        let chosen = resolve_pin(&installs, pin);
        let Some(view) = chosen else {
            unavailable.push(pin.clone());
            all_match = false;
            continue;
        };
        if !view.available {
            unavailable.push(pin.clone());
            all_match = false;
            continue;
        }
        if !view.effective {
            all_match = false;
        }
    }
    Ok(ProfileMatchStatus {
        profile: profile.clone(),
        matches_effective: all_match && unavailable.is_empty(),
        unavailable,
    })
}

pub fn plan_profile_apply<B: EnvBackend>(
    backend: &B,
    profile: &ToolProfile,
) -> Result<Vec<ToolApplyPlan>, EnvarlyError> {
    let mut plans = Vec::new();
    for pin in &profile.tools {
        let installs = list_tool_installations(backend, pin.tool, None)?;
        let Some(view) = resolve_pin(&installs, pin) else {
            return Err(EnvarlyError::InvalidInput(format!(
                "profile tool unavailable: {:?}",
                pin.tool
            )));
        };
        if !view.available {
            return Err(EnvarlyError::InvalidInput(format!(
                "installation unavailable for {:?}",
                pin.tool
            )));
        }
        plans.push(create_tool_plan(backend, &view.installation)?);
    }
    Ok(plans)
}

pub fn apply_profile<B: EnvBackend>(
    backend: &B,
    profile: &ToolProfile,
) -> Result<Vec<crate::whichcraft::services::tool_apply::ApplyToolResult>, EnvarlyError> {
    let plans = plan_profile_apply(backend, profile)?;
    let mut results = Vec::new();
    for plan in plans {
        results.push(apply_tool_plan(backend, &plan)?);
    }
    Ok(results)
}

fn resolve_pin(
    installs: &[crate::whichcraft::services::tool_inventory::ToolInstallationView],
    pin: &ProfileToolPin,
) -> Option<crate::whichcraft::services::tool_inventory::ToolInstallationView> {
    if let Some(root) = &pin.preferred_root {
        return installs
            .iter()
            .find(|v| v.installation.root == *root)
            .cloned();
    }
    installs
        .iter()
        .find(|v| {
            v.installation.vendor.eq_ignore_ascii_case(&pin.vendor)
                && v.installation.version == pin.version
        })
        .cloned()
        .or_else(|| installs.first().cloned())
}

pub fn merge_profile_pins(
    existing: &HashMap<ToolKind, ProfileToolPin>,
    profile: &ToolProfile,
) -> HashMap<ToolKind, ProfileToolPin> {
    let mut out = existing.clone();
    for pin in &profile.tools {
        out.insert(pin.tool, pin.clone());
    }
    out
}
