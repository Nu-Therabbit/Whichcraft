pub mod app;
#[cfg(test)]
mod app_tests;
#[cfg(test)]
mod layer_tests;
pub mod elevation;
pub mod java_inventory;
pub mod path_cleanup;
pub mod profiles;
pub mod recovery;
pub mod supplemental_inventory;
pub mod terminal;
pub mod tool_apply;
pub mod tool_inventory;
pub mod tool_plan;
pub mod undo;
pub mod update;
pub mod uninstall;

use std::collections::HashMap;

use crate::model::EnvValue;
use crate::whichcraft::domain::env::{expand_vars, get_var};
use crate::whichcraft::ports::machine::Machine;

/// Expands `%NAME%` the way a new process would: from the registry values (User over System, as
/// Windows builds the environment), then this process for names the registry does not hold
/// (USERPROFILE, LOCALAPPDATA). This process's own copy of JAVA_HOME and the like goes stale as
/// soon as Whichcraft changes them, so it must not decide what `%JAVA_HOME%\bin` means.
pub fn registry_expander<'a>(
    user: &'a HashMap<String, EnvValue>,
    system: &'a HashMap<String, EnvValue>,
    machine: &'a dyn Machine,
) -> impl Fn(&str) -> String + 'a {
    move |raw| expand_vars(raw, &|name| {
        get_var(user, name)
            .or_else(|| get_var(system, name))
            .map(|v| v.value.clone())
            .or_else(|| machine.env_var(name))
    }, 0)
}

#[cfg(test)]
mod tests {
    use crate::whichcraft::adapters::local::LocalMachine;
    use super::*;

    fn vars(pairs: &[(&str, &str)]) -> HashMap<String, EnvValue> {
        pairs.iter().map(|(k, v)| ((*k).to_string(), EnvValue::typed((*v).to_string(), crate::model::EnvValueKind::ExpandString))).collect()
    }

    #[test]
    fn registry_values_win_over_this_process() {
        let user = vars(&[("JAVA_HOME", "C:\\jdk21")]);
        let system = vars(&[("JAVA_HOME", "C:\\jdk17"), ("TOOLS", "%SystemDrive%\\tools")]);
        let expand = registry_expander(&user, &system, &LocalMachine);
        assert_eq!(expand("%java_home%\\bin"), "C:\\jdk21\\bin");
        assert_eq!(expand("%TOOLS%\\x"), format!("{}\\tools\\x", std::env::var("SystemDrive").unwrap()));
        assert_eq!(expand("%NOT_DEFINED_ANYWHERE_42%\\bin"), "%NOT_DEFINED_ANYWHERE_42%\\bin");
        assert_eq!(expand("50%"), "50%");
    }
}

