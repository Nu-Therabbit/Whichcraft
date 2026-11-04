//! One detection vocabulary shared with the Environment UI. Redaction runs before transport.
use regex::Regex;
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Rules {
    exact: std::collections::HashMap<String, serde_json::Value>,
    keywords: Vec<String>,
    value_patterns: Vec<ValuePattern>,
    configuration_keywords: Vec<String>,
    credential_arguments: Vec<String>,
}
#[derive(Deserialize)]
struct ValuePattern {
    pattern: String,
}
fn rules() -> &'static Rules {
    static RULES: OnceLock<Rules> = OnceLock::new();
    RULES.get_or_init(|| {
        serde_json::from_str(include_str!("../../../../src/lib/secretRules.json"))
            .expect("bundled secret rules")
    })
}
pub fn redact(key: &str, value: &str) -> String {
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    static USERINFO: OnceLock<Regex> = OnceLock::new();
    let rules = rules();
    let key = key.to_ascii_uppercase();
    // credential.helper is an ordered public setting; its command still goes through value checks.
    let helper = key == "CREDENTIAL.HELPER";
    let secret_key = rules.exact.contains_key(&key)
        || rules
            .keywords
            .iter()
            .chain(rules.configuration_keywords.iter())
            .any(|s| key.contains(s) && !(helper && s == "CREDENTIAL"));
    let patterns = PATTERNS.get_or_init(|| {
        rules
            .value_patterns
            .iter()
            .map(|p| Regex::new(&p.pattern).expect("bundled token pattern"))
            .collect()
    });
    let userinfo =
        USERINFO.get_or_init(|| Regex::new(r"(?i)([a-z][a-z0-9+.-]*)://([^/\s]*)@").unwrap());
    let sensitive_userinfo = userinfo.captures_iter(value).any(|capture| {
        let user = &capture[2];
        user != "*" && !(capture[1].eq_ignore_ascii_case("ssh") && !user.contains(':'))
    });
    let upper = value.to_ascii_uppercase();
    let credential_argument = rules.credential_arguments.iter().any(|keyword| {
        upper.contains(&format!("{keyword}="))
            || upper.contains(&format!("--{}", keyword.replace('_', "-")))
            || upper.contains(&format!("{keyword}:"))
    });
    let embedded_token = value
        .split(|c: char| c.is_whitespace() || ['"', '\'', '=', ';', ','].contains(&c))
        .any(|word| patterns.iter().any(|p| p.is_match(word)));
    if secret_key || sensitive_userinfo || credential_argument || embedded_token {
        "[redacted]".into()
    } else {
        value.into()
    }
}
