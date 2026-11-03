use std::path::PathBuf;

use super::whichcraft_data_dir;
use crate::error::WhichcraftError;
use crate::whichcraft::domain::selection::ToolSelection;
use crate::whichcraft::domain::ToolKind;

fn selection_path() -> Result<PathBuf, WhichcraftError> {
    Ok(whichcraft_data_dir()?.join("selection.json"))
}

pub fn load_tool_selection(tool: ToolKind) -> Result<Option<ToolSelection>, WhichcraftError> {
    let path = selection_path()?;
    if !path.is_file() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot read selection: {e}")))?;
    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot parse selection: {e}")))?;
    let key = tool_key(tool);
    let Some(node) = parsed.get(key) else {
        return Ok(None);
    };
    Ok(Some(serde_json::from_value(node.clone()).map_err(|e| {
        WhichcraftError::Snapshot(format!("Cannot parse tool selection: {e}"))
    })?))
}

pub fn save_tool_selection(selection: &ToolSelection) -> Result<(), WhichcraftError> {
    let value = serde_json::to_value(selection)
        .map_err(|e| WhichcraftError::Snapshot(format!("Cannot serialize selection: {e}")))?;
    edit_selections(|obj| {
        obj.insert(tool_key(selection.tool).into(), value);
    })
}

pub fn clear_tool_selection(tool: ToolKind) -> Result<(), WhichcraftError> {
    edit_selections(|obj| {
        obj.remove(tool_key(tool));
    })
}

fn edit_selections(
    edit: impl FnOnce(&mut serde_json::Map<String, serde_json::Value>),
) -> Result<(), WhichcraftError> {
    let path = selection_path()?;
    let mut parsed: serde_json::Value = if path.is_file() {
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| WhichcraftError::Snapshot(format!("Cannot read selection: {e}")))?;
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    let obj = parsed
        .as_object_mut()
        .ok_or_else(|| WhichcraftError::Snapshot("selection file must be a JSON object".into()))?;
    edit(obj);
    std::fs::write(
        &path,
        serde_json::to_string_pretty(&parsed)
            .map_err(|e| WhichcraftError::Snapshot(format!("Cannot serialize selection: {e}")))?,
    )
    .map_err(|e| WhichcraftError::Snapshot(format!("Cannot write selection: {e}")))?;
    Ok(())
}

fn tool_key(tool: ToolKind) -> &'static str {
    match tool {
        ToolKind::Java => "java",
        ToolKind::Node => "node",
        ToolKind::Python => "python",
        ToolKind::Go => "go",
        ToolKind::Flutter => "flutter",
        ToolKind::Git => "git",
    }
}
