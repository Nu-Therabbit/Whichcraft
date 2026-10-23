//! Environment variables as Windows reads them: names ignore case, values may hold `%NAME%`.

use std::collections::HashMap;

use crate::model::EnvValue;

/// Looks up an environment variable the way Windows does: names are case-insensitive.
pub fn get_var<'a>(map: &'a HashMap<String, EnvValue>, name: &str) -> Option<&'a EnvValue> {
    map.get(name).or_else(|| {
        map.iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v)
    })
}

/// Expands `%NAME%` with `lookup`; unknown names stay as written.
pub fn expand_vars(raw: &str, lookup: &dyn Fn(&str) -> Option<String>, depth: u8) -> String {
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
