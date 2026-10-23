pub mod elevation;
pub mod java_inventory;
pub mod path_cleanup;
pub mod path_plan;
pub mod profiles;
pub mod recovery;
pub mod supplemental_inventory;
pub mod terminal;
pub mod tool_apply;
pub mod tool_inventory;
pub mod tool_plan;
pub mod undo;
pub mod update;
pub mod uninstall;

use std::collections::HashMap;

use crate::model::EnvValue;

/// Looks up an environment variable the way Windows does: names are case-insensitive.
pub fn get_var<'a>(map: &'a HashMap<String, EnvValue>, name: &str) -> Option<&'a EnvValue> {
    map.get(name).or_else(|| {
        map.iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v)
    })
}
