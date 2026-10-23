use crate::whichcraft::api::CorePortName;
use crate::whichcraft::WhichcraftCore;

#[test]
fn core_with_fakes_reports_all_ports() {
    let core = WhichcraftCore::with_fakes();
    let health = core.health();
    assert!(health.ready);
    assert_eq!(health.ports.len(), CorePortName::ALL.len());
}

#[test]
fn core_smoke_journal_through_fake_ports() {
    let mut core = WhichcraftCore::with_fakes();
    core.record_smoke_journal().expect("journal append");
    assert_eq!(core.ports().journal.len(), 1);
}
