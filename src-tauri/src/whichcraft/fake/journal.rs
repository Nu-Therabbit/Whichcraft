use crate::error::EnvarlyError;
use crate::whichcraft::ports::journal::{Journal, JournalEntry};

#[derive(Default)]
pub struct FakeJournal {
    entries: Vec<JournalEntry>,
}

impl FakeJournal {
    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

impl Journal for FakeJournal {
    fn append(&mut self, entry: JournalEntry) -> Result<(), EnvarlyError> {
        self.entries.push(entry);
        Ok(())
    }

    fn latest(&self) -> Result<Option<JournalEntry>, EnvarlyError> {
        Ok(self.entries.last().cloned())
    }
}
