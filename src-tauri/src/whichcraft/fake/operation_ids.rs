use crate::whichcraft::ports::operation_ids::OperationIds;

/// Fixed IDs and timestamps for application tests.
pub struct FakeOperationIds {
    apply_id: String,
    uninstall_id: String,
    now: String,
}

impl FakeOperationIds {
    pub fn fixed(apply_id: &str, uninstall_id: &str, now_rfc3339: &str) -> Self {
        Self {
            apply_id: apply_id.into(),
            uninstall_id: uninstall_id.into(),
            now: now_rfc3339.into(),
        }
    }
}

impl OperationIds for FakeOperationIds {
    fn new_apply_id(&self) -> String {
        self.apply_id.clone()
    }

    fn new_uninstall_id(&self) -> String {
        self.uninstall_id.clone()
    }

    fn now_rfc3339(&self) -> String {
        self.now.clone()
    }
}
