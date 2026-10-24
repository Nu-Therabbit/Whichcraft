use chrono::Utc;

use crate::whichcraft::ports::operation_ids::OperationIds;

/// Production time and IDs from the system clock; formatting matches persisted journal ids.
pub struct SystemOperationIds;

/// `<prefix>-<UTC timestamp to the millisecond>`, the shape stored journal and uninstall ids have.
fn timestamped_id(prefix: &str) -> String {
    format!("{prefix}-{}", Utc::now().format("%Y%m%dT%H%M%S%.3fZ"))
}

impl OperationIds for SystemOperationIds {
    fn new_apply_id(&self) -> String {
        timestamped_id("apply")
    }

    fn new_uninstall_id(&self) -> String {
        timestamped_id("uninstall")
    }

    fn now_rfc3339(&self) -> String {
        Utc::now().to_rfc3339()
    }
}
