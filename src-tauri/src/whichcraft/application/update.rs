//! Updating within a version line (ticket 16): install the newer version next to the old one,
//! switch to it with the usual plan, then offer to uninstall the old one. Nothing is overwritten
//! in place (P-1).

use std::path::PathBuf;

use serde::Serialize;

use crate::env_store::EnvBackend;
use crate::error::EnvarlyError;
use crate::whichcraft::domain::ToolKind;
use crate::whichcraft::domain::ToolInstallation;
use crate::whichcraft::application::tool_apply::create_tool_plan;
use crate::whichcraft::domain::ToolApplyPlan;
use crate::whichcraft::ports::machine::Machine;
use crate::whichcraft::ports::operation_ids::OperationIds;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    pub installation: ToolInstallation,
    pub plan: ToolApplyPlan,
}

/// Installs `version` with `install` and plans the switch to it. The plan is shown and applied
/// like any other; the old installation is left alone.
pub fn install_and_plan<B: EnvBackend>(
    backend: &B,
    machine: &dyn Machine,
    ids: &dyn OperationIds,
    tool: ToolKind,
    version: &str,
    install: impl FnOnce(ToolKind, &str) -> Result<PathBuf, EnvarlyError>,
) -> Result<UpdateResult, EnvarlyError> {
    let root = install(tool, version)?;
    let installation = machine.probe(tool, &root, true).ok_or_else(|| {
        EnvarlyError::InvalidInput(format!("the new installation at {} was not recognised", root.display()))
    })?;
    let plan = create_tool_plan(backend, machine, &installation, ids)?;
    Ok(UpdateResult { installation, plan })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::whichcraft::adapters::local::LocalMachine;
    use crate::whichcraft::adapters::operation_ids::SystemOperationIds;
    use crate::env_store::MemBackend;

    #[test]
    fn update_installs_beside_the_old_one_and_plans_the_switch() {
        let dir = tempfile::tempdir().unwrap();
        crate::whichcraft::persistence::use_test_data_dir(dir.path());
        let old = dir.path().join("node-22.13.0");
        std::fs::create_dir_all(&old).unwrap();
        std::fs::write(old.join("node.exe"), b"").unwrap();
        let backend = MemBackend::new().with_user([("Path", "C:\\old-node")]);

        let new_root = dir.path().join("store").join("node").join("22.24.0");
        let result = install_and_plan(&backend, &LocalMachine, &SystemOperationIds, ToolKind::Node, "22.24.0", |tool, version| {
            assert_eq!((tool, version), (ToolKind::Node, "22.24.0"));
            std::fs::create_dir_all(&new_root).unwrap();
            std::fs::write(new_root.join("node.exe"), b"").unwrap();
            Ok(new_root.clone())
        })
        .unwrap();

        assert_eq!(result.installation.root, new_root);
        assert!(result.installation.managed);
        assert!(old.join("node.exe").exists(), "the old installation is not touched");
        let path = &result.plan.user_diffs.iter().find(|d| d.name.eq_ignore_ascii_case("Path")).unwrap().after;
        assert!(path.starts_with(&*new_root.to_string_lossy()), "{path}");
    }

    #[test]
    fn a_failed_install_plans_nothing() {
        let backend = MemBackend::new();
        let err =
            install_and_plan(&backend, &LocalMachine, &SystemOperationIds, ToolKind::Go, "1.27.1", |_, _| {
                Err(EnvarlyError::InvalidInput("offline".into()))
            });
        assert!(err.is_err());
    }
}
