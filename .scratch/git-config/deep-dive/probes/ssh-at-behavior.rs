use whichcraft_ssh_at_probe::config::{simple_parser::parse_ssh_config,serializer::serialize_ssh_config};
#[test]
fn plain_host_model_survives() {
 let c=parse_ssh_config("Host demo\n HostName demo.example\n User alice\n").unwrap();
 let round=parse_ssh_config(&serialize_ssh_config(&c).unwrap()).unwrap();
 assert_eq!(round.hosts[0].user.as_deref(),Some("alice"));
}
#[test]
fn no_op_roundtrip_drops_comments_and_crlf() {
 let text="# header\r\n\r\nHost demo\r\n\tUser alice\r\n";
 let rendered=serialize_ssh_config(&parse_ssh_config(text).unwrap()).unwrap();
 assert_ne!(rendered,text); assert!(!rendered.contains("# header")); assert!(!rendered.contains('\r'));
}
#[test]
fn repeated_identityfile_reduces_to_last() {
 let c=parse_ssh_config("Host demo\n IdentityFile first\n IdentityFile second\n").unwrap();
 assert_eq!(c.hosts[0].identity_file.as_ref().unwrap().to_str(),Some("second"));
 assert_eq!(serialize_ssh_config(&c).unwrap().matches("IdentityFile").count(),1);
}
#[test]
fn repeated_user_reduces_to_last() {
 let c=parse_ssh_config("Host demo\n User first\n User second\n").unwrap();
 assert_eq!(c.hosts[0].user.as_deref(),Some("second"));
}
#[test]
fn equals_assignment_is_skipped() {
 let c=parse_ssh_config("Host demo\n User=alice\n").unwrap();
 assert_eq!(c.hosts[0].user,None);
}
#[test]
fn match_body_overwrites_previous_host_model() {
 let c=parse_ssh_config("Host demo\n User alice\nMatch user nobody\n User bob\n").unwrap();
 assert_eq!(c.hosts.len(),1); assert_eq!(c.hosts[0].user.as_deref(),Some("bob"));
 assert_eq!(c.hosts[0].extra_options.get("Match").map(String::as_str),Some("user nobody"));
}
#[test]
fn include_is_flattened_and_not_serialized_as_directive() {
 let d=tempfile::tempdir().unwrap(); let child=d.path().join("child.conf");
 std::fs::write(&child,"Host child\n User worker\n").unwrap();
 let input=format!("Include {}\nHost parent\n User alice\n",child.display());
 let c=parse_ssh_config(&input).unwrap();
 assert_eq!(c.hosts.iter().map(|h|h.host.as_str()).collect::<Vec<_>>(),vec!["parent","child"]);
 let rendered=serialize_ssh_config(&c).unwrap();
 assert!(!rendered.contains("Include ")); assert!(rendered.contains("Host child"));
}
#[test]
fn duplicate_unknown_directive_is_collapsed() {
 let c=parse_ssh_config("Host demo\n CustomOption first\n CustomOption second\n").unwrap();
 assert_eq!(c.hosts[0].extra_options.len(),1);
 assert_eq!(c.hosts[0].extra_options.get("CustomOption").map(String::as_str),Some("second"));
}