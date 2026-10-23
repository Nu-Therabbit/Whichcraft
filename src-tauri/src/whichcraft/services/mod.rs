pub mod elevation;
pub mod java_inventory;
pub mod path_cleanup;
pub mod path_plan;
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

/// Expands `%NAME%` the way a new process would: from the registry values (User over System, as
/// Windows builds the environment), then this process for names the registry does not hold
/// (USERPROFILE, LOCALAPPDATA). This process's own copy of JAVA_HOME and the like goes stale as
/// soon as Whichcraft changes them, so it must not decide what `%JAVA_HOME%\bin` means.
pub fn registry_expander<'a>(
    user: &'a HashMap<String, EnvValue>,
    system: &'a HashMap<String, EnvValue>,
) -> impl Fn(&str) -> String + 'a {
    move |raw| expand_vars(raw, &|name| {
        get_var(user, name)
            .or_else(|| get_var(system, name))
            .map(|v| v.value.clone())
            .or_else(|| std::env::var(name).ok())
    }, 0)
}

fn expand_vars(raw: &str, lookup: &dyn Fn(&str) -> Option<String>, depth: u8) -> String {
    let mut out = String::new();
    let mut rest = raw;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let Some(end) = after.find('%') else {
            out.push('%');
            rest = after;
            continue;
        };
        let name = &after[..end];
        match lookup(name).filter(|_| !name.is_empty()) {
            // A value can itself hold variables (REG_EXPAND_SZ); a few levels is plenty and stops loops.
            Some(value) if depth < 4 => out.push_str(&expand_vars(&value, lookup, depth + 1)),
            Some(value) => out.push_str(&value),
            None => {
                out.push('%');
                out.push_str(name);
                out.push('%');
            }
        }
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars(pairs: &[(&str, &str)]) -> HashMap<String, EnvValue> {
        pairs.iter().map(|(k, v)| ((*k).to_string(), EnvValue::typed((*v).to_string(), crate::model::EnvValueKind::ExpandString))).collect()
    }

    #[test]
    fn registry_values_win_over_this_process() {
        let user = vars(&[("JAVA_HOME", "C:\\jdk21")]);
        let system = vars(&[("JAVA_HOME", "C:\\jdk17"), ("TOOLS", "%SystemDrive%\\tools")]);
        let expand = registry_expander(&user, &system);
        assert_eq!(expand("%java_home%\\bin"), "C:\\jdk21\\bin");
        assert_eq!(expand("%TOOLS%\\x"), format!("{}\\tools\\x", std::env::var("SystemDrive").unwrap()));
        assert_eq!(expand("%NOT_DEFINED_ANYWHERE_42%\\bin"), "%NOT_DEFINED_ANYWHERE_42%\\bin");
        assert_eq!(expand("50%"), "50%");
    }
}

/// Looks up an environment variable the way Windows does: names are case-insensitive.
pub fn get_var<'a>(map: &'a HashMap<String, EnvValue>, name: &str) -> Option<&'a EnvValue> {
    map.get(name).or_else(|| {
        map.iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v)
    })
}
