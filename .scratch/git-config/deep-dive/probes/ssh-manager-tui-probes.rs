use crate::config::{self, HostView, SshConfig};
use std::path::PathBuf;

fn path(name: &str) -> PathBuf {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures")
        .join(format!("{name}-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir.join("config")
}
fn parse(text: &str) -> SshConfig {
    config::parser::parse(PathBuf::from("fixture-only-not-saved"), text)
}

#[test]
fn uniform_crlf_one_field_edit_preserves_other_bytes() {
    let src = "# note\r\nHost  demo\r\n\tUser =alice\r\n\tPort=22\r\n";
    let mut cfg = parse(src);
    let (idx, mut view) = cfg.host_views().remove(0);
    view.port = Some("2222".into());
    cfg.apply_view(idx, &view).unwrap();
    assert_eq!(cfg.render(), src.replace("Port=22", "Port=2222"));
}
#[test]
fn bom_is_removed_before_any_edit() {
    let src = "\u{feff}Host demo\n  User alice\n";
    assert_eq!(parse(src).render(), "Host demo\n  User alice\n");
}
#[test]
fn mixed_endings_normalized_and_diff_does_not_show_it() {
    let src = "Host demo\r\n  User alice\n  Port 22\r\n";
    let rendered = parse(src).render();
    assert_ne!(rendered, src);
    assert_eq!(rendered, "Host demo\r\n  User alice\r\n  Port 22\r\n");
    assert_eq!(config::diff::stats(&config::diff::diff(src, &rendered)), (0,0));
    println!("mixed newline normalization produces zero content diff");
}
#[test]
fn multiple_identityfiles_preserve_order_and_unchanged_line_style() {
    let src = "Host demo\n\tIdentityFile = one.pub\n    identityfile two.pub\n";
    let mut cfg = parse(src);
    let (idx, mut view) = cfg.host_views().remove(0);
    assert_eq!(view.identity_files, ["one.pub", "two.pub"]);
    view.identity_files[1] = "three.pub".into();
    cfg.apply_view(idx, &view).unwrap();
    assert_eq!(cfg.render(), "Host demo\n\tIdentityFile = one.pub\n    identityfile three.pub\n");
}
#[test]
fn unchanged_unknown_repeated_options_and_full_comments_survive() {
    let src = "# owner\nHost demo\n  User alice\n  # detail\n  FutureOption x\n  FutureOption y\n\n";
    let mut cfg = parse(src);
    let (idx, mut view) = cfg.host_views().remove(0);
    view.user = Some("bob".into());
    cfg.apply_view(idx, &view).unwrap();
    assert_eq!(cfg.render(), src.replace("User alice", "User bob"));
}
#[test]
fn editing_field_drops_its_inline_comment() {
    let src = "Host demo\n  User alice # explanatory note\n";
    let mut cfg = parse(src);
    let (idx, mut view) = cfg.host_views().remove(0);
    assert_eq!(view.user.as_deref(), Some("alice # explanatory note"));
    view.user = Some("bob".into());
    cfg.apply_view(idx, &view).unwrap();
    assert_eq!(cfg.render(), "Host demo\n  User bob\n");
    println!("inline comment treated as part of field, removed on that field edit");
}
#[test]
fn editing_unrelated_field_collapses_duplicate_scalar_directive() {
    let src = "Host demo\n  User alice\n  User bob\n  Port 22\n";
    let mut cfg = parse(src);
    let (idx, mut view) = cfg.host_views().remove(0);
    view.port = Some("2222".into());
    cfg.apply_view(idx, &view).unwrap();
    assert_eq!(cfg.render(), "Host demo\n  User alice\n  Port 2222\n");
    println!("unrelated Port edit removed later duplicated User");
}
#[test]
fn include_file_retained_but_child_host_not_loaded() {
    let root = path("include");
    let child = root.with_file_name("child.conf");
    let child_text = "Host included\n  User child\n";
    std::fs::write(&child, child_text).unwrap();
    let text = format!("Include {}\nHost root\n  User parent\n", child.display());
    std::fs::write(&root, &text).unwrap();
    let cfg = SshConfig::load(root).unwrap();
    assert_eq!(cfg.render(), text);
    assert_eq!(cfg.host_views().len(), 1);
    assert_eq!(cfg.host_views()[0].1.alias(), "root");
    assert_eq!(std::fs::read_to_string(child).unwrap(), child_text);
}
#[test]
fn match_exec_preserved_opaque_without_any_execution() {
    let root = path("match-exec");
    let marker = root.with_file_name("must-not-exist");
    let src = format!("Match exec \"echo touched > {}\"\n  User scoped\nHost demo\n  User alice\n", marker.display());
    let cfg = config::parser::parse(root, &src);
    assert_eq!(cfg.render(), src);
    assert_eq!(cfg.host_views().len(), 1);
    assert!(!marker.exists());
}
#[test]
fn first_stale_save_overwrites_external_edit_and_backup_captures_it() {
    let target = path("external-first");
    let initial = "Host demo\n  User alice\n";
    std::fs::write(&target, initial).unwrap();
    let mut cfg = SshConfig::load(target.clone()).unwrap();
    let (idx, mut view) = cfg.host_views().remove(0);
    view.user = Some("bob".into());
    cfg.apply_view(idx, &view).unwrap();
    let external = "Host demo\n  User carol\n  ExternalOption added\n";
    std::fs::write(&target, external).unwrap();
    cfg.save().unwrap();
    assert_eq!(std::fs::read_to_string(&target).unwrap(), "Host demo\n  User bob\n");
    assert_eq!(std::fs::read_to_string(target.with_extension("bak")).unwrap(), external);
    println!("stale save succeeds and overwrites external edits; first backup captures current disk");
}
#[test]
fn later_stale_save_overwrites_external_edit_without_rotating_backup() {
    let target = path("external-later");
    let initial = "Host demo\n  User alice\n";
    std::fs::write(&target, initial).unwrap();
    let mut cfg = SshConfig::load(target.clone()).unwrap();
    let (idx, mut view) = cfg.host_views().remove(0);
    view.user = Some("bob".into());
    cfg.apply_view(idx, &view).unwrap();
    cfg.save().unwrap();
    std::fs::write(&target, "Host demo\n  User carol\n  ExternalOption latest\n").unwrap();
    view.port = Some("2222".into());
    cfg.apply_view(idx, &view).unwrap();
    cfg.save().unwrap();
    assert_eq!(std::fs::read_to_string(&target).unwrap(), "Host demo\n  User bob\n    Port 2222\n".replace("    Port", "  Port"));
    assert_eq!(std::fs::read_to_string(target.with_extension("bak")).unwrap(), initial);
    println!("second stale save loses external changes from both target and one-time backup");
}
#[test]
fn host_projection_does_not_compute_global_inheritance() {
    let cfg = parse("Host *\n  User default\nHost demo\n  HostName example.test\n");
    assert_eq!(cfg.host_views()[1].1.user, None);
}
#[test]
fn domain_apply_does_not_validate_port_or_directive_syntax() {
    let mut cfg = parse("Host demo\n  Port 22\n");
    let (idx, mut view) = cfg.host_views().remove(0);
    view.port = Some("999999".into());
    cfg.apply_view(idx, &view).unwrap();
    assert!(cfg.render().contains("Port 999999"));
    let _ = HostView::default();
}
