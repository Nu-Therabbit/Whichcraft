use crate::error::EnvarlyError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JournalEntryKind {
    ApplyStarted,
    ApplyCompleted,
    UndoStarted,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalEntry {
    pub kind: JournalEntryKind,
    pub detail: String,
}

pub trait Journal: Send + Sync {
    fn append(&mut self, entry: JournalEntry) -> Result<(), EnvarlyError>;
    fn latest(&self) -> Result<Option<JournalEntry>, EnvarlyError>;
}
