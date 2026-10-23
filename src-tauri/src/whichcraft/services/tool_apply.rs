use crate::env_store::{self, EnvBackend};
use crate::error::EnvarlyError;
use crate::model::{EnvChange, VarScope};
use crate::whichcraft::persistence::{
    load_incomplete_journal, new_journal_id, save_journal, save_tool_selection, JournalStatus,
    MutationRecord, ToolSelection, WhichcraftJournal,
};
use crate::whichcraft::ports::installation_probe::ToolInstallation;
use crate::whichcraft::services::tool_plan::{
    build_tool_apply_plan, diff_to_env_value, plan_to_mutations, tool_plan_is_stale, ToolApplyPlan,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyToolResult {
    pub plan_id: String,
    pub stale: bool,
    pub needs_elevation: bool,
}

pub fn create_tool_plan<B: EnvBackend>(
    backend: &B,
    installation: &ToolInstallation,
) -> Result<ToolApplyPlan, EnvarlyError> {
    build_tool_apply_plan(backend, installation, new_journal_id())
}

pub fn apply_tool_plan<B: EnvBackend>(
    backend: &B,
    plan: &ToolApplyPlan,
) -> Result<ApplyToolResult, EnvarlyError> {
    if tool_plan_is_stale(plan, backend)? {
        return Ok(ApplyToolResult {
            plan_id: plan.plan_id.clone(),
            stale: true,
            needs_elevation: false,
        });
    }

    if plan.requires_uac && !backend.is_elevated() {
        return Ok(ApplyToolResult {
            plan_id: plan.plan_id.clone(),
            stale: false,
            needs_elevation: true,
        });
    }

    let mut mutations = Vec::new();
    let mut changes = Vec::new();

    for (diff, (path_added, path_removed)) in plan_to_mutations(plan) {
        let map = match diff.scope {
            VarScope::User => backend.read_user()?,
            VarScope::System => backend.read_system()?,
            VarScope::OtherUser => backend
                .read_other_user()?
                .ok_or_else(|| EnvarlyError::InvalidInput("no other-user account selected".into()))?,
        };
        let before = map.get(&diff.name).cloned();
        let after_value = diff_to_env_value(&diff);
        mutations.push(MutationRecord {
            name: diff.name.clone(),
            scope: diff.scope.clone(),
            before: before.clone(),
            after: Some(after_value.clone()),
            path_added,
            path_removed,
        });
        changes.push(EnvChange::Set {
            name: diff.name,
            value: diff.after,
            value_kind: diff.value_kind,
            scope: diff.scope,
        });
    }

    let journal = WhichcraftJournal {
        id: plan.plan_id.clone(),
        status: JournalStatus::Pending,
        kind: format!("{}_apply", tool_slug(plan.selected.tool)),
        created_at: chrono::Utc::now().to_rfc3339(),
        baseline: plan.baseline.clone(),
        mutations: mutations.clone(),
    };
    save_journal(&journal)?;

    if let Err(err) = env_store::apply_changes_with(backend, &changes, |_, _, _, _| {}) {
        let mut failed = journal;
        failed.status = JournalStatus::Failed;
        let _ = save_journal(&failed);
        return Err(err);
    }

    save_tool_selection(&ToolSelection {
        tool: plan.selected.tool,
        root: plan.selected.root.clone(),
        vendor: plan.selected.vendor.clone(),
        version: plan.selected.version.clone(),
    })?;

    let mut completed = journal;
    completed.status = JournalStatus::Completed;
    save_journal(&completed)?;

    Ok(ApplyToolResult {
        plan_id: plan.plan_id.clone(),
        stale: false,
        needs_elevation: false,
    })
}

fn tool_slug(tool: crate::whichcraft::api::ToolKind) -> &'static str {
    match tool {
        crate::whichcraft::api::ToolKind::Java => "java",
        crate::whichcraft::api::ToolKind::Node => "node",
        crate::whichcraft::api::ToolKind::Python => "python",
        crate::whichcraft::api::ToolKind::Go => "go",
        crate::whichcraft::api::ToolKind::Flutter => "flutter",
        crate::whichcraft::api::ToolKind::Git => "git",
    }
}

pub fn incomplete_apply_journal() -> Result<Option<WhichcraftJournal>, EnvarlyError> {
    load_incomplete_journal()
}
