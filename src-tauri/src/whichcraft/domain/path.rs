//! PATH as text: entries, prepending, and what changed between two values.

/// Returns a new PATH with `dir` prepended, or `None` if already present (anywhere).
pub fn compute_prepend(current: &str, dir: &str) -> Option<String> {
    let dir_norm = dir.trim().trim_end_matches(['\\', '/']).to_lowercase();
    if dir_norm.is_empty() {
        return None;
    }
    if current
        .split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .any(|p| {
            p.trim_end_matches(['\\', '/'])
                .eq_ignore_ascii_case(&dir_norm)
        })
    {
        return None;
    }
    let trimmed = current.trim().trim_end_matches(';');
    Some(if trimmed.is_empty() {
        dir.to_string()
    } else {
        format!("{dir};{trimmed}")
    })
}

pub fn path_entries(raw: &str) -> Vec<String> {
    raw.split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

pub fn path_entry_diff(before: &str, after: &str) -> (Vec<String>, Vec<String>) {
    let before_set: Vec<String> = path_entries(before);
    let after_set: Vec<String> = path_entries(after);
    let mut added = Vec::new();
    for e in &after_set {
        if !before_set.iter().any(|b| b.eq_ignore_ascii_case(e)) {
            added.push(e.clone());
        }
    }
    let mut removed = Vec::new();
    for e in &before_set {
        if !after_set.iter().any(|a| a.eq_ignore_ascii_case(e)) {
            removed.push(e.clone());
        }
    }
    (added, removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prepend_adds_to_front() {
        assert_eq!(
            compute_prepend("C:\\old", "C:\\jdk\\bin").as_deref(),
            Some("C:\\jdk\\bin;C:\\old")
        );
    }

    #[test]
    fn prepend_noop_when_present() {
        assert_eq!(
            compute_prepend("C:\\jdk\\bin;C:\\old", "C:\\jdk\\bin"),
            None
        );
    }
}
