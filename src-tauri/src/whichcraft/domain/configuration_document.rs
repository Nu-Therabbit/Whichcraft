//! Conservative UTF-8 source spans. Native Git remains the configuration resolver.
use std::ops::Range;

#[derive(Debug, Clone)]
pub struct Directive {
    pub key: String,
    pub value: String,
    pub span: Range<usize>,
    pub line: usize,
    pub section: String,
    pub condition: Option<String>,
    pub condition_span: Option<Range<usize>>,
}
#[derive(Debug, Clone, Default)]
pub struct SourceSyntax {
    pub directives: Vec<Directive>,
    pub editable: bool,
}

pub fn decode_git(raw: &str) -> Option<String> {
    let mut value = String::new();
    let mut quoted = false;
    let mut escaped = false;
    for ch in raw.chars() {
        if escaped {
            value.push(match ch {
                'n' => '\n',
                't' => '\t',
                'b' => '\u{8}',
                '"' => '"',
                '\\' => '\\',
                _ => return None,
            });
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if ch == '"' {
            quoted = !quoted;
        } else {
            value.push(ch);
        }
    }
    if quoted || escaped {
        None
    } else {
        Some(value)
    }
}
pub fn quote_git(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
            .replace('\t', "\\t")
            .replace('\u{8}', "\\b")
    )
}

pub fn parse_document(text: &str, ssh: bool) -> SourceSyntax {
    let mut result = SourceSyntax {
        editable: !text.contains('\0'),
        ..Default::default()
    };
    let mut offset = 0;
    let mut section = String::new();
    let mut condition = None;
    let mut condition_span = None;
    for (index, physical) in text.split_inclusive('\n').enumerate() {
        let line = physical.trim_end_matches(['\r', '\n']);
        let body = line.trim_start_matches('\u{feff}').trim_start();
        let body_start = offset + line.len() - body.len();
        if body.is_empty() || body.starts_with(['#', ';']) {
            offset += physical.len();
            continue;
        }
        if !ssh && body.starts_with('[') {
            if let Some(end) = body.find(']') {
                let heading = &body[1..end];
                let split = heading.find(char::is_whitespace).unwrap_or(heading.len());
                section = heading[..split].to_ascii_lowercase();
                condition = None;
                condition_span = None;
                let tail = heading[split..].trim();
                if !tail.is_empty() {
                    if tail.starts_with('"') && tail.ends_with('"') {
                        condition = decode_git(tail);
                        let start = body_start + 1 + heading.find('"').unwrap();
                        condition_span = Some(start..body_start + end);
                    } else {
                        result.editable = false;
                    }
                }
                if !body[end + 1..].trim().is_empty()
                    && !body[end + 1..].trim().starts_with(['#', ';'])
                {
                    result.editable = false;
                }
            } else {
                result.editable = false;
            }
            offset += physical.len();
            continue;
        }
        let key_end = body
            .find(|c: char| c.is_whitespace() || c == '=')
            .unwrap_or(body.len());
        let name = body[..key_end].to_ascii_lowercase();
        if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            result.editable = false;
            offset += physical.len();
            continue;
        }
        let rest = &body[key_end..];
        let rest = rest.trim_start();
        let rest = rest.strip_prefix('=').unwrap_or(rest).trim_start();
        let start = body_start + body.len() - rest.len();
        let mut end = rest.len();
        let mut quoted = false;
        let mut escaped = false;
        for (pos, ch) in rest.char_indices() {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == '"' {
                quoted = !quoted;
            }
            if !quoted && (ch == '#' || (!ssh && ch == ';')) {
                end = pos;
                break;
            }
        }
        let raw = rest[..end].trim_end();
        let value = if ssh {
            if raw.starts_with('"') && raw.ends_with('"') {
                raw[1..raw.len() - 1].to_owned()
            } else {
                raw.to_owned()
            }
        } else {
            decode_git(raw).unwrap_or_else(|| {
                result.editable = false;
                raw.to_owned()
            })
        };
        // Continuations and compact [section] key=value syntax are readable through Git, not editable here.
        if escaped || quoted || raw.ends_with('\\') || (!ssh && section.is_empty()) {
            result.editable = false;
        }
        if ssh && (name == "host" || name == "match") {
            section = name.clone();
            condition = Some(value.clone());
            condition_span = Some(start..start + raw.len());
        }
        let key = if ssh {
            name
        } else {
            format!(
                "{}.{}{}",
                section,
                condition
                    .as_ref()
                    .map(|c| format!("{c}."))
                    .unwrap_or_default(),
                name
            )
        };
        result.directives.push(Directive {
            key,
            value,
            span: start..start + raw.len(),
            line: index + 1,
            section: section.clone(),
            condition: condition.clone(),
            condition_span: condition_span.clone(),
        });
        offset += physical.len();
    }
    result
}
