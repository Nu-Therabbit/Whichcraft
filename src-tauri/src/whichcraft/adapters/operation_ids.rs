use chrono::Utc;

use crate::whichcraft::ports::operation_ids::OperationIds;

/// Production time and IDs from the system clock; formatting matches persisted journal ids.
pub struct SystemOperationIds;

impl OperationIds for SystemOperationIds {
    fn new_apply_id(&self) -> String {
        format!("apply-{}", Utc::now().format("%Y%m%dT%H%M%S%.3fZ"))
    }

    fn new_uninstall_id(&self) -> String {
        format!("uninstall-{}", Utc::now().format("%Y%m%dT%H%M%S%.3fZ"))
    }

    fn now_rfc3339(&self) -> String {
        Utc::now().to_rfc3339()
    }
}
