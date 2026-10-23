use crate::error::EnvarlyError;
use crate::whichcraft::api::ToolKind;
use crate::whichcraft::ports::environment_resolver::{EnvironmentResolver, ResolvedTool};

#[derive(Default)]
pub struct FakeEnvironmentResolver;

impl EnvironmentResolver for FakeEnvironmentResolver {
    fn resolve_effective(&self, tool: ToolKind) -> Result<ResolvedTool, EnvarlyError> {
        Ok(ResolvedTool {
            tool,
            executable_path: None,
        })
    }
}
