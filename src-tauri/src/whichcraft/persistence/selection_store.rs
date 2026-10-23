use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::whichcraft_data_dir;
use crate::error::EnvarlyError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JavaSelection {
    pub root: PathBuf,
    pub vendor: String,
    pub version: String,
}

fn selection_path() -> Result<PathBuf, EnvarlyError> {
    Ok(whichcraft_data_dir()?.join("selection.json"))
}

pub fn load_java_selection() -> Result<Option<JavaSelection>, EnvarlyError> {
    let path = selection_path()?;
    if !path.is_file() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| EnvarlyError::Snapshot(format!("Cannot read selection: {e}")))?;
    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| EnvarlyError::Snapshot(format!("Cannot parse selection: {e}")))?;
    let java = parsed
        .get("java")
        .ok_or_else(|| EnvarlyError::Snapshot("selection missing java key".into()))?;
    Ok(Some(
        serde_json::from_value(java.clone())
            .map_err(|e| EnvarlyError::Snapshot(format!("Cannot parse java selection: {e}")))?,
    ))
}

pub fn save_java_selection(selection: &JavaSelection) -> Result<(), EnvarlyError> {
    let path = selection_path()?;
    let body = serde_json::json!({ "java": selection });
    std::fs::write(
        &path,
        serde_json::to_string_pretty(&body)
            .map_err(|e| EnvarlyError::Snapshot(format!("Cannot serialize selection: {e}")))?,
    )
    .map_err(|e| EnvarlyError::Snapshot(format!("Cannot write selection: {e}")))?;
    Ok(())
}
