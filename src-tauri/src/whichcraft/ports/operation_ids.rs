//! Plan, journal and uninstall identifiers plus recorded timestamps (ADR-0005).

pub trait OperationIds: Send + Sync {
    /// `apply-…` id shared by tool plans and journal records.
    fn new_apply_id(&self) -> String;
    /// `uninstall-…` id for uninstall audit records.
    fn new_uninstall_id(&self) -> String;
    /// RFC 3339 timestamp for journals and uninstall records.
    fn now_rfc3339(&self) -> String;
}
