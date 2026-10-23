use std::sync::Mutex;

use crate::whichcraft::ports::operation_ids::OperationIds;

/// Fixed or scripted IDs and timestamps for application tests.
pub struct FakeOperationIds {
    apply_id: Mutex<String>,
    uninstall_id: Mutex<String>,
    now: Mutex<String>,
}

impl FakeOperationIds {
    pub fn fixed(apply_id: &str, uninstall_id: &str, now_rfc3339: &str) -> Self {
        Self {
            apply_id: Mutex::new(apply_id.into()),
            uninstall_id: Mutex::new(uninstall_id.into()),
            now: Mutex::new(now_rfc3339.into()),
        }
    }
}

impl OperationIds for FakeOperationIds {
    fn new_apply_id(&self) -> String {
        self.apply_id.lock().unwrap().clone()
    }

    fn new_uninstall_id(&self) -> String {
        self.uninstall_id.lock().unwrap().clone()
    }

    fn now_rfc3339(&self) -> String {
        self.now.lock().unwrap().clone()
    }
}
