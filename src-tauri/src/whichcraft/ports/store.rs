use crate::error::EnvarlyError;
use crate::whichcraft::domain::journal::WhichcraftJournal;
use crate::whichcraft::domain::profiles::ToolProfile;
use crate::whichcraft::domain::selection::ToolSelection;
use crate::whichcraft::domain::settings::WhichcraftSettings;
use crate::whichcraft::domain::uninstall::UninstallRecord;
use crate::whichcraft::domain::ToolKind;

/// Everything Whichcraft remembers between runs: settings, the chosen installation per tool,
/// the journal of each apply, profiles, and the record of each uninstall.
pub trait Store: Send + Sync {
    /// Settings, with the default install store filled in when none was chosen.
    fn settings(&self) -> Result<WhichcraftSettings, EnvarlyError>;
    fn save_settings(&self, settings: &WhichcraftSettings) -> Result<(), EnvarlyError>;

    fn selection(&self, tool: ToolKind) -> Result<Option<ToolSelection>, EnvarlyError>;
    fn save_selection(&self, selection: &ToolSelection) -> Result<(), EnvarlyError>;

    fn save_journal(&self, journal: &WhichcraftJournal) -> Result<(), EnvarlyError>;
    fn journal(&self, id: &str) -> Result<WhichcraftJournal, EnvarlyError>;
    /// The newest apply that never finished, if any.
    fn incomplete_journal(&self) -> Result<Option<WhichcraftJournal>, EnvarlyError>;
    /// The newest completed apply that has not been undone, if any.
    fn last_completed_apply(&self) -> Result<Option<WhichcraftJournal>, EnvarlyError>;

    fn profiles(&self) -> Result<Vec<ToolProfile>, EnvarlyError>;
    fn save_profiles(&self, profiles: &[ToolProfile]) -> Result<(), EnvarlyError>;

    fn save_uninstall_record(&self, record: &UninstallRecord) -> Result<(), EnvarlyError>;
    /// Every recorded uninstall, newest first.
    fn uninstall_records(&self) -> Result<Vec<UninstallRecord>, EnvarlyError>;
}
