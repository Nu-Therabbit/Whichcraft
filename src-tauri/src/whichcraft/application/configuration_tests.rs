use super::configuration::ConfigurationApp;
use crate::whichcraft::ports::configuration::*;
use crate::whichcraft::{adapters::configuration::NativeConfigurationIo, domain::configuration::*};
use std::{collections::HashMap, fs, path::Path};

struct Fixture {
    root: tempfile::TempDir,
    app: ConfigurationApp,
    io: NativeConfigurationIo,
}
impl Fixture {
    fn new() -> Self {
        let root = tempfile::tempdir().unwrap();
        let git = std::process::Command::new("where.exe")
            .arg("git.exe")
            .output()
            .unwrap();
        let git = String::from_utf8(git.stdout)
            .unwrap()
            .lines()
            .next()
            .unwrap()
            .to_owned();
        let mut env: HashMap<String, String> = std::env::vars()
            .filter(|(k, _)| !k.to_ascii_uppercase().starts_with("GIT_"))
            .collect();
        for key in ["HOME", "USERPROFILE", "XDG_CONFIG_HOME"] {
            env.insert(key.into(), root.path().display().to_string());
        }
        for (key, file) in [
            ("GIT_CONFIG_SYSTEM", "system"),
            ("GIT_CONFIG_GLOBAL", "global"),
        ] {
            let path = root.path().join(file);
            fs::write(&path, "").unwrap();
            env.insert(key.into(), path.display().to_string());
        }
        let io = NativeConfigurationIo::isolated(env, git, root.path().join("journal"));
        Self {
            root,
            app: ConfigurationApp::new(Box::new(io.clone())),
            io,
        }
    }
    fn file(&self, name: &str, text: &str) {
        fs::write(self.root.path().join(name), text).unwrap();
    }
    fn repo(&self, name: &str) -> String {
        let path = self.root.path().join(name);
        fs::create_dir(&path).unwrap();
        self.app.initialize_fixture_repository(&path).unwrap();
        path.display().to_string()
    }
    fn context(&self, repository: String) -> ConfigurationContext {
        ConfigurationContext {
            repository: Some(repository),
            git: None,
            ssh_client: None,
        }
    }
}

#[test]
fn configuration_api_reads_native_precedence_origins_and_helper_resets() {
    let f = Fixture::new();
    f.file(
        "system",
        "[user]\nname = System\nemail = system@example.test\n[credential]\nhelper = manager\n",
    );
    f.file(
        "global",
        "[user]\nname = Personal\n[include]\npath = work\n[credential]\nhelper =\nhelper = cache\n",
    );
    f.file("work", "[user]\nemail = work@example.test\n");
    let repo = f.repo("repo");
    fs::write(
        Path::new(&repo).join(".git/config"),
        "[core]\nrepositoryformatversion = 0\n[user]\nemail = local@example.test\n",
    )
    .unwrap();
    let view = f.app.inspect(&f.context(repo)).unwrap();
    assert_eq!(view.git.identity.name.as_ref().unwrap().value, "Personal");
    let email = view.git.identity.email.as_ref().unwrap();
    assert_eq!(email.value, "local@example.test");
    assert_eq!(email.scope, "local");
    assert_eq!(
        view.git
            .occurrences
            .iter()
            .filter(|x| x.key == "credential.helper")
            .map(|x| x.value.as_str())
            .collect::<Vec<_>>(),
        ["manager", "", "cache"]
    );
    assert!(view.git.sources.iter().any(|s| s.path.ends_with("work")));
}

#[test]
fn configuration_api_reads_and_edits_the_repository_local_config_where_git_keeps_it() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    let local = Path::new(&repo).join(".git").join("config");
    let original = fs::read_to_string(&local).unwrap();
    fs::write(
        &local,
        format!("{original}[user]\n\temail = local@example.test\n[includeIf \"gitdir:~/work/\"]\n\tpath = ~/work.gitconfig\n"),
    )
    .unwrap();
    // Git names local config relative to the folder it ran in; Whichcraft runs elsewhere.
    let context = f.context(repo.clone());
    let view = f.app.inspect(&context).unwrap();
    let email = view.git.identity.email.clone().unwrap();
    assert_eq!(email.scope, "local");
    assert!(email.editable, "{email:?}");
    assert_eq!(email.source, local.display().to_string());
    assert!(
        view.git
            .sources
            .iter()
            .any(|s| s.scope == "local" && Path::new(&s.path) == local),
        "{:?}",
        view.git.sources.iter().map(|s| &s.path).collect::<Vec<_>>()
    );
    let rule = view
        .git
        .rules
        .iter()
        .find(|r| r.condition == "gitdir:~/work/")
        .expect("the local conditional include is listed");
    assert!(!rule.editable);

    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: email.id,
                value: "changed@example.test".into(),
            },
        })
        .unwrap();
    let outcome = f.app.apply(&plan.id).unwrap();
    assert_eq!(outcome.status, "written", "{outcome:?}");
    assert!(fs::read_to_string(&local)
        .unwrap()
        .contains("changed@example.test"));
}

#[test]
fn configuration_api_edits_default_home_global_identity_without_a_config_override() {
    let f = Fixture::new();
    let original =
        "# keep\r\n[user]\r\nname = Sample Developer\r\nemail = personal@example.test\r\n";
    f.file(".gitconfig", original);
    let mut runtime = f.io.runtime().unwrap();
    runtime
        .environment
        .retain(|key, _| !key.eq_ignore_ascii_case("GIT_CONFIG_GLOBAL"));
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            runtime: Some(runtime),
            ..Default::default()
        })),
    }));
    let context = ConfigurationContext::default();
    for (key, value) in [
        ("user.name", "Updated Developer"),
        ("user.email", "updated@example.test"),
    ] {
        let view = app.inspect(&context).unwrap();
        let occurrence = view.git.occurrences.iter().find(|o| o.key == key).unwrap();
        assert!(occurrence.editable, "{occurrence:?}");
        assert_eq!(occurrence.scope, "global");
        assert_eq!(
            Path::new(&occurrence.source),
            f.root.path().join(".gitconfig")
        );
        let plan = app
            .plan(&ConfigurationPlanRequest {
                inspection: view.id.clone(),
                intent: ConfigurationIntent::GitValue {
                    occurrence: occurrence.id.clone(),
                    value: value.into(),
                },
            })
            .unwrap();
        assert_eq!(
            fs::read(f.root.path().join(".gitconfig")).unwrap(),
            original.as_bytes()
        );
        let written = app.apply(&plan.id).unwrap();
        assert_eq!(written.status, "written", "{written:?}");
        assert_eq!(written.readback, "verified");
        let readback = app.inspect(&context).unwrap();
        assert_eq!(
            readback
                .git
                .occurrences
                .iter()
                .find(|o| o.key == key)
                .unwrap()
                .value,
            value
        );
        let undone = app.undo(&written.operation.unwrap().id).unwrap();
        assert_eq!(undone.status, "restored", "{undone:?}");
        assert_eq!(
            fs::read(f.root.path().join(".gitconfig")).unwrap(),
            original.as_bytes()
        );
    }
}

#[test]
fn configuration_api_previews_applies_and_undoes_only_the_selected_occurrence() {
    let f = Fixture::new();
    let original="\u{feff}# keep\r\n[user]\r\n\tname = First\r\n\temail = old@example.test  # keep too\r\n[unknown]\nthing = yes\r\n";
    f.file("global", original);
    let context = f.context(f.repo("repo"));
    let inspection = f.app.inspect(&context).unwrap();
    let email = inspection.git.identity.email.unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: inspection.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: email.id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        original
    );
    assert_eq!(plan.impacts[0].status, "verified");
    assert_eq!(
        plan.impacts[0].after.email.as_ref().unwrap().value,
        "new@example.test"
    );
    let outcome = f.app.apply(&plan.id).unwrap();
    assert_eq!(outcome.status, "written", "{outcome:?}");
    assert_eq!(outcome.readback, "verified");
    assert!(f.app.apply(&plan.id).is_err());
    let expected = original.replace("old@example.test", "\"new@example.test\"");
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        expected
    );
    fs::write(
        f.root.path().join("global"),
        format!("{expected}# external edit\n"),
    )
    .unwrap();
    let undone = f.app.undo(&outcome.operation.unwrap().id).unwrap();
    assert_eq!(undone.status, "restored");
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        format!("{original}# external edit\n")
    );
}

#[test]
fn configuration_api_creates_and_edits_rules_with_native_impact_and_local_override() {
    let f = Fixture::new();
    f.file(
        "global",
        "# keep\r\n[user]\r\nname = Personal\r\nemail = personal@example.test\r\n",
    );
    f.file("work", "[user]\nemail = work@example.test\n");
    let repo = f.repo("repo");
    let local = Path::new(&repo).join(".git/config");
    fs::write(&local,"[remote \"upstream\"]\nurl = ssh://git@bitbucket.org/team/repo.git\n[user]\nemail = local@example.test\n").unwrap();
    let context = f.context(repo);
    let view = f.app.inspect(&context).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::IncludeRule {
                rule: None,
                source: f.root.path().join("global").display().to_string(),
                condition: "hasconfig:remote.*.url:ssh://git@bitbucket.org/**".into(),
                target: "work".into(),
            },
        })
        .unwrap();
    assert_eq!(plan.impacts[0].status, "verified");
    assert_eq!(plan.impacts[0].matched, Some(true));
    assert_eq!(
        plan.impacts[0].after.email.as_ref().unwrap().value,
        "local@example.test"
    );
    let op = f.app.apply(&plan.id).unwrap();
    assert_eq!(op.status, "written");
    let view = f.app.inspect(&context).unwrap();
    assert_eq!(view.git.rules.len(), 1);
    let rule = &view.git.rules[0];
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id.clone(),
            intent: ConfigurationIntent::IncludeRule {
                rule: Some(rule.id.clone()),
                source: rule.source.clone(),
                condition: "hasconfig:remote.*.url:git@github.com:*/**".into(),
                target: "work".into(),
            },
        })
        .unwrap();
    assert_eq!(plan.impacts[0].matched, Some(false));
    f.app.apply(&plan.id).unwrap();
    assert!(fs::read_to_string(f.root.path().join("global"))
        .unwrap()
        .starts_with("# keep\r\n[user]\r\n"));
}

#[test]
fn configuration_api_refuses_a_remote_rule_whose_target_sets_remote_urls_even_without_a_repository()
{
    let f = Fixture::new();
    f.file("global", "[user]\nemail = personal@example.test\n");
    f.file(
        "direct",
        "[remote \"origin\"]\nurl = git@github.com:team/repo.git\n",
    );
    f.file("indirect", "[include]\npath = remotes\n");
    f.file(
        "remotes",
        "[remote \"upstream\"]\nurl = https://example.test/repo.git\n",
    );
    // Loads its remote URL only inside a matching repository, so Git outside one never reads it.
    f.file(
        "conditional",
        "[includeIf \"gitdir:~/anywhere/\"]\npath = remotes\n",
    );
    f.file(
        "legacy",
        "[remote.origin]\nurl = https://example.test/repo.git\n",
    );
    // An empty remote name is still a remote URL to Git (remote..url).
    f.file(
        "unnamed",
        "[remote \"\"]\nurl = https://example.test/repo.git\n",
    );
    f.file("clean", "[user]\nemail = work@example.test\n");
    let context = ConfigurationContext {
        repository: None,
        git: None,
        ssh_client: None,
    };
    let rule = |condition: &str, target: &str| {
        let view = f.app.inspect(&context).unwrap();
        f.app.plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::IncludeRule {
                rule: None,
                source: f.root.path().join("global").display().to_string(),
                condition: condition.into(),
                target: target.into(),
            },
        })
    };
    let remote = "hasconfig:remote.*.url:git@github.com:*/**";
    for target in ["direct", "indirect", "conditional", "legacy", "unnamed"] {
        let error = rule(remote, target).expect_err(target).to_string();
        assert!(error.contains("remote URL"), "{target}: {error}");
    }
    assert!(rule(remote, "clean").is_ok());
    // Only a remote-URL condition forbids remote URLs in its target.
    assert!(rule("gitdir:~/work/", "direct").is_ok());
}

#[test]
fn configuration_api_marks_loaded_only_the_rules_git_matched_when_they_share_a_target() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    let pattern = format!("{}/", repo.replace('\\', "/"));
    f.file(
        "global",
        &format!("[includeIf \"gitdir/i:~/elsewhere/\"]\npath = work\n[includeIf \"gitdir/i:{pattern}\"]\npath = work\n"),
    );
    f.file("work", "[user]\nemail = work@example.test\n");
    let view = f.app.inspect(&f.context(repo)).unwrap();
    assert_eq!(
        view.git.rules.iter().map(|r| r.active).collect::<Vec<_>>(),
        [false, true],
        "{:?}",
        view.git.rules
    );
}

#[test]
fn configuration_api_marks_each_non_global_rule_from_its_own_native_match() {
    for scope in ["system", "local", "worktree"] {
        let f = Fixture::new();
        let repo = f.repo("repo");
        let target = f
            .root
            .path()
            .join("shared")
            .display()
            .to_string()
            .replace('\\', "/");
        f.file("shared", "[user]\nemail = work@example.test\n");
        let pattern = format!("{}/", repo.replace('\\', "/"));
        let rules = format!(
            "[includeIf \"gitdir/i:~/elsewhere/\"]\npath = {target}\n[includeIf \"gitdir/i:{pattern}\"]\npath = {target}\n"
        );
        match scope {
            "system" => f.file("system", &rules),
            "local" => {
                let local = Path::new(&repo).join(".git/config");
                let existing = fs::read_to_string(&local).unwrap();
                fs::write(local, format!("{existing}{rules}")).unwrap();
            }
            _ => {
                let local = Path::new(&repo).join(".git/config");
                let existing = fs::read_to_string(&local).unwrap();
                fs::write(
                    local,
                    format!("{existing}[extensions]\nworktreeConfig = true\n"),
                )
                .unwrap();
                fs::write(Path::new(&repo).join(".git/config.worktree"), &rules).unwrap();
            }
        }
        let view = f.app.inspect(&f.context(repo)).unwrap();
        assert_eq!(
            view.git.rules.iter().map(|r| r.active).collect::<Vec<_>>(),
            [false, true],
            "{scope}: {:?}",
            view.git.rules
        );
    }
}

#[test]
fn configuration_api_rule_activity_uses_the_actual_command_remote_before_redaction() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    f.file("global", "[includeIf \"hasconfig:remote.*.url:https://alice:secret@example.test/**\"]\npath = work\n");
    f.file("work", "[user]\nemail = work@example.test\n");
    let mut runtime = f.io.runtime().unwrap();
    runtime
        .environment
        .insert("GIT_CONFIG_COUNT".into(), "1".into());
    runtime
        .environment
        .insert("GIT_CONFIG_KEY_0".into(), "remote.origin.url".into());
    runtime.environment.insert(
        "GIT_CONFIG_VALUE_0".into(),
        "https://alice:secret@example.test/repo.git".into(),
    );
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            runtime: Some(runtime),
            ..Default::default()
        })),
    }));
    let view = app.inspect(&f.context(repo)).unwrap();
    assert_eq!(
        view.git.identity.email.as_ref().unwrap().value,
        "work@example.test"
    );
    assert!(view.git.rules[0].active, "{:?}", view.git.rules);
    assert!(!serde_json::to_string(&view).unwrap().contains("secret"));
}

#[test]
fn configuration_api_keeps_a_native_local_root_found_first_through_an_inactive_include() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    let local = Path::new(&repo).join(".git/config");
    let existing = fs::read_to_string(&local).unwrap();
    let local_path = local.display().to_string().replace('\\', "/");
    let target = f
        .root
        .path()
        .join("work")
        .display()
        .to_string()
        .replace('\\', "/");
    let pattern = format!("{}/", repo.replace('\\', "/"));
    fs::write(
        &local,
        format!("{existing}[includeIf \"gitdir/i:{pattern}\"]\npath = {target}\n"),
    )
    .unwrap();
    f.file("work", "[user]\nemail = work@example.test\n");
    f.file(
        "global",
        &format!("[includeIf \"gitdir/i:~/elsewhere/\"]\npath = {local_path}\n"),
    );
    let view = f.app.inspect(&f.context(repo)).unwrap();
    assert_eq!(
        view.git.identity.email.as_ref().unwrap().value,
        "work@example.test"
    );
    assert_eq!(
        view.git.rules.iter().map(|r| r.active).collect::<Vec<_>>(),
        [false, true],
        "{:?}",
        view.git.rules
    );
}

#[test]
fn configuration_api_lists_rules_in_the_order_git_reads_them_through_includes() {
    let f = Fixture::new();
    f.file(
        "global",
        "[include]\npath = first\n[includeIf \"gitdir:~/a/\"]\npath = a\n",
    );
    f.file("first", "[includeIf \"gitdir:~/b/\"]\npath = b\n");
    let view = f.app.inspect(&f.context(f.repo("repo"))).unwrap();
    assert_eq!(
        view.git
            .rules
            .iter()
            .map(|r| r.condition.as_str())
            .collect::<Vec<_>>(),
        ["gitdir:~/b/", "gitdir:~/a/"]
    );
}

#[test]
fn configuration_api_skips_private_keys_an_include_glob_matches_without_reading_them() {
    let f = Fixture::new();
    fs::create_dir_all(f.root.path().join(".ssh/keys")).unwrap();
    f.file(".ssh/config", "Include keys/*\n");
    f.file(".ssh/keys/extra.conf", "Host extra\n User git\n");
    f.file(
        ".ssh/keys/work_ed25519",
        "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n",
    );
    f.file(
        ".ssh/keys/laptop.ppk",
        "PuTTY-User-Key-File-3: ssh-ed25519\nEncryption: none\n",
    );
    let context = f.context(f.repo("repo"));
    // Reading either key in full fails the inspection.
    for unreadable in ["work_ed25519", "laptop.ppk"] {
        let app = ConfigurationApp::new(Box::new(FaultIo {
            native: f.io.clone(),
            faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
                unreadable: Some(unreadable.into()),
                ..Default::default()
            })),
        }));
        app.inspect(&context).unwrap();
    }

    let view = f.app.inspect(&context).unwrap();

    assert!(view.ssh.hosts.iter().any(|h| h.name == "extra"));
    assert!(
        view.ssh
            .sources
            .iter()
            .all(|s| !s.path.ends_with("work_ed25519") && !s.path.ends_with("laptop.ppk")),
        "{:?}",
        view.ssh.sources.iter().map(|s| &s.path).collect::<Vec<_>>()
    );
}

#[test]
fn configuration_api_inspects_ssh_statically_and_edits_one_identity_reference() {
    let f = Fixture::new();
    fs::create_dir(f.root.path().join(".ssh")).unwrap();
    f.file(".ssh/config", "# keep\r\nInclude work.conf\r\nHost github-personal\r\n HostName github.com\r\n User git\r\n IdentityFile ~/.ssh/id_personal\r\nHost * !excluded\r\n Port 2222\r\n IdentityFile ~/.ssh/id_backup\r\nMatch exec \"echo unsafe > sentinel\"\r\n User dynamic\r\n");
    f.file(".ssh/work.conf","Host github-*\n User first\n IdentityFile ~/.ssh/id_first # retain\n IdentityFile ~/.ssh/id_second\n");
    let context = f.context(f.repo("repo"));
    let view = f.app.inspect(&context).unwrap();
    let host = view
        .ssh
        .hosts
        .iter()
        .find(|h| h.name == "github-personal")
        .unwrap();
    assert_eq!(
        host.values.iter().find(|o| o.key == "user").unwrap().value,
        "first"
    );
    let paths = host
        .values
        .iter()
        .filter(|o| o.key == "identityfile")
        .map(|o| o.value.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        paths,
        [
            "~/.ssh/id_first",
            "~/.ssh/id_second",
            "~/.ssh/id_personal",
            "~/.ssh/id_backup"
        ]
    );
    assert!(!host.unresolved.is_empty());
    assert!(!f.root.path().join("sentinel").exists());
    let identity = host
        .values
        .iter()
        .find(|o| o.key == "identityfile")
        .unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::SshIdentity {
                occurrence: identity.id.clone(),
                value: "~/.ssh/new_key".into(),
            },
        })
        .unwrap();
    let result = f.app.apply(&plan.id).unwrap();
    assert_eq!(result.status, "written");
    assert_eq!(fs::read_to_string(f.root.path().join(".ssh/work.conf")).unwrap(),"Host github-*\n User first\n IdentityFile \"~/.ssh/new_key\" # retain\n IdentityFile ~/.ssh/id_second\n");
    f.app.undo(&result.operation.unwrap().id).unwrap();
    assert!(fs::read_to_string(f.root.path().join(".ssh/work.conf"))
        .unwrap()
        .contains("IdentityFile ~/.ssh/id_first # retain"));
}

#[test]
fn configuration_api_blocks_stale_dependencies_and_previous_repository_plans() {
    let f = Fixture::new();
    f.file(
        "global",
        "[user]\nemail = first@example.test\n[include]\npath = later\n",
    );
    let context = f.context(f.repo("first"));
    let view = f.app.inspect(&context).unwrap();
    let request = ConfigurationPlanRequest {
        inspection: view.id,
        intent: ConfigurationIntent::GitValue {
            occurrence: view.git.identity.email.unwrap().id,
            value: "changed@example.test".into(),
        },
    };
    let plan = f.app.plan(&request).unwrap();
    f.file("later", "[user]\nemail = external@example.test\n");
    assert!(
        f.app.apply(&plan.id).is_err(),
        "A newly created include changes the reviewed result"
    );
    let view = f.app.inspect(&context).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "changed@example.test".into(),
            },
        })
        .unwrap();
    f.app.inspect(&f.context(f.repo("second"))).unwrap();
    assert!(
        f.app.apply(&plan.id).is_err(),
        "Changing repository invalidates the reviewed plan"
    );
}

#[test]
fn configuration_api_restores_latest_operation_after_restart_and_detects_conflicts() {
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let view = f.app.inspect(&f.context(f.repo("repo"))).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    let op = f.app.apply(&plan.id).unwrap().operation.unwrap();
    let restarted = ConfigurationApp::new(Box::new(f.io.clone()));
    assert_eq!(restarted.operation().unwrap().unwrap().id, op.id);
    f.file("global", "[user]\nemail = external@example.test\n");
    assert!(restarted.undo(&op.id).is_err());
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        "[user]\nemail = external@example.test\n"
    );
}

#[test]
fn configuration_api_redacts_secrets_before_transport_including_keys_sources_and_commands() {
    let f = Fixture::new();
    f.file("global","[user]\nname = Sample\n[http]\nextraHeader = Bearer sensitive-header\n[remote \"origin\"]\nurl = https://user:private-token@example.test/repo\n[core]\nsshCommand = ssh -o ProxyCommand=proxy --password hidden-command\n[alias]\ntoken=hidden-value\n");
    let view = f.app.inspect(&f.context(f.repo("repo"))).unwrap();
    let transport = serde_json::to_string(&view).unwrap();
    for secret in [
        "sensitive-header",
        "private-token",
        "hidden-command",
        "hidden-value",
    ] {
        assert!(!transport.contains(secret), "leaked {secret}");
    }
}

#[test]
fn configuration_api_remote_rules_use_every_remote_and_preserve_native_include_order() {
    for (url, pattern) in [
        ("git@bitbucket.org:team/repo.git", "git@bitbucket.org:*/**"),
        (
            "ssh://git@bitbucket.org/team/repo.git",
            "ssh://git@bitbucket.org/**",
        ),
        (
            "https://bitbucket.org/team/repo.git",
            "https://bitbucket.org/**",
        ),
        (
            "https://someone@bitbucket.org/team/repo.git",
            "https://*@bitbucket.org/**",
        ),
    ] {
        let f = Fixture::new();
        f.file("global",&format!("[user]\nemail = personal@example.test\n[includeIf \"hasconfig:remote.*.url:{pattern}\"]\npath = first\n[includeIf \"hasconfig:remote.*.url:{pattern}\"]\npath = last\n"));
        f.file("first", "[user]\nemail = first@example.test\n");
        f.file("last", "[user]\nemail = last@example.test\n");
        let repo = f.repo("repo");
        f.file("repo/.git/config",&format!("[remote \"origin\"]\nurl = git@github.com:sample/other.git\n[remote \"upstream\"]\nurl = {url}\n"));
        let view = f.app.inspect(&f.context(repo)).unwrap();
        assert_eq!(view.git.identity.email.unwrap().value, "last@example.test");
        assert_eq!(
            view.git
                .occurrences
                .iter()
                .filter(|o| o.key == "user.email")
                .map(|o| o.value.as_str())
                .collect::<Vec<_>>(),
            [
                "personal@example.test",
                "first@example.test",
                "last@example.test"
            ]
        );
    }
}

#[test]
fn configuration_api_previews_relative_home_and_dot_folder_conditions_with_original_origins() {
    let f = Fixture::new();
    fs::create_dir_all(f.root.path().join("nested")).unwrap();
    f.file(
        "global",
        "[include]\npath = nested/identity\n[includeIf \"gitdir:./repo/\"]\npath = ~/folder\n",
    );
    f.file("nested/identity", "[user]\nname = Original\n");
    f.file("folder", "[user]\nemail = folder@example.test\n");
    let context = f.context(f.repo("repo"));
    let view = f.app.inspect(&context).unwrap();
    assert_eq!(
        view.git.identity.email.as_ref().unwrap().value,
        "folder@example.test"
    );
    assert!(view.git.rules[0].active, "{:?}", view.git.rules);
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.name.unwrap().id,
                value: "Changed".into(),
            },
        })
        .unwrap();
    let after = &plan.impacts[0].after;
    assert_eq!(plan.impacts[0].status, "verified");
    assert_eq!(after.name.as_ref().unwrap().value, "Changed");
    assert!(
        after
            .name
            .as_ref()
            .unwrap()
            .source
            .ends_with("nested/identity")
            || after
                .name
                .as_ref()
                .unwrap()
                .source
                .ends_with("nested\\identity")
    );
    assert_eq!(after.email.as_ref().unwrap().value, "folder@example.test");
    f.app.apply(&plan.id).unwrap();
    let actual = f.app.inspect(&context).unwrap();
    assert_eq!(
        actual.git.identity.name.unwrap().value,
        after.name.as_ref().unwrap().value
    );
}

#[test]
fn configuration_api_recent_repositories_survive_restart_are_bounded_and_removable() {
    let f = Fixture::new();
    for n in 0..22 {
        let path = f.root.path().join(format!("repo-{n}"));
        let view = f
            .app
            .inspect(&f.context(path.display().to_string()))
            .unwrap();
        assert!(view.recent_repositories.len() <= 20);
    }
    let app = ConfigurationApp::new(Box::new(f.io.clone()));
    let view = app.inspect(&ConfigurationContext::default()).unwrap();
    assert_eq!(view.recent_repositories.len(), 20);
    assert!(!view.recent_repositories[0].available);
    let removed = view.recent_repositories[0].path.clone();
    app.forget_repository(&removed).unwrap();
    assert_eq!(
        app.inspect(&ConfigurationContext::default())
            .unwrap()
            .recent_repositories
            .len(),
        19
    );
}

#[derive(Clone, Default)]
struct Faults {
    publish: bool,
    readback: bool,
    after_publish: bool,
    version: Option<String>,
    dubious: bool,
    runtime: Option<ConfigurationRuntime>,
    completion_journal: bool,
    /// A file name whose whole content must never be read.
    unreadable: Option<String>,
}
struct FaultIo {
    native: NativeConfigurationIo,
    faults: std::sync::Arc<std::sync::Mutex<Faults>>,
}
impl ConfigurationIo for FaultIo {
    fn fingerprint(&self, path: &Path) -> ConfigResult<String> {
        self.native.fingerprint(path)
    }
    fn operation_id(&self) -> String {
        self.native.operation_id()
    }
    fn runtime(&self) -> ConfigResult<ConfigurationRuntime> {
        if let Some(runtime) = &self.faults.lock().unwrap().runtime {
            Ok(runtime.clone())
        } else {
            self.native.runtime()
        }
    }
    fn run(
        &self,
        exe: &str,
        args: &[String],
        env: &HashMap<String, String>,
        cwd: &Path,
    ) -> ConfigResult<ConfigProcessOutput> {
        let faults = self.faults.lock().unwrap().clone();
        if args == ["--version"] {
            if let Some(version) = faults.version {
                return Ok(ConfigProcessOutput {
                    success: true,
                    stdout: version,
                    stderr: String::new(),
                });
            }
        }
        if faults.dubious && args.first().is_some_and(|a| a == "rev-parse") {
            return Ok(ConfigProcessOutput {
                success: false,
                stdout: String::new(),
                stderr: "fatal: detected dubious ownership\nowner: fixture-owner".into(),
            });
        }
        self.native.run(exe, args, env, cwd)
    }
    fn read(&self, path: &Path) -> ConfigResult<Option<Vec<u8>>> {
        let faults = self.faults.lock().unwrap();
        if faults.readback && faults.after_publish {
            return Err(super::configuration::problem("Injected failed readback"));
        }
        assert!(
            faults
                .unreadable
                .as_ref()
                .is_none_or(|name| !path.ends_with(name)),
            "read {}",
            path.display()
        );
        drop(faults);
        self.native.read(path)
    }
    fn first_line(&self, path: &Path) -> ConfigResult<Option<String>> {
        self.native.first_line(path)
    }
    fn canonical(&self, path: &Path) -> ConfigResult<std::path::PathBuf> {
        self.native.canonical(path)
    }
    fn exists(&self, path: &Path) -> bool {
        self.native.exists(path)
    }
    fn directory(&self, path: &Path) -> bool {
        self.native.directory(path)
    }
    fn writable(&self, path: &Path) -> bool {
        self.native.writable(path)
    }
    fn glob(&self, pattern: &str) -> ConfigResult<Vec<std::path::PathBuf>> {
        self.native.glob(pattern)
    }
    fn save_recent(&self, recent: &[String]) -> ConfigResult<()> {
        self.native.save_recent(recent)
    }
    fn temporary(&self, count: usize) -> ConfigResult<Box<dyn ConfigurationTemporary>> {
        self.native.temporary(count)
    }
    fn publish(&self, path: &Path, expected: &[u8], candidate: &[u8]) -> ConfigResult<()> {
        let mut faults = self.faults.lock().unwrap();
        if faults.publish {
            return Err(super::configuration::problem(
                "Injected publication failure",
            ));
        }
        self.native.publish(path, expected, candidate)?;
        faults.after_publish = true;
        Ok(())
    }
    fn load_operation(&self) -> ConfigResult<Option<Vec<u8>>> {
        self.native.load_operation()
    }
    fn save_operation(&self, bytes: &[u8]) -> ConfigResult<()> {
        let faults = self.faults.lock().unwrap();
        if faults.completion_journal && faults.after_publish {
            return Err(super::configuration::problem(
                "Injected completion journal failure",
            ));
        }
        drop(faults);
        self.native.save_operation(bytes)
    }
}

#[test]
fn configuration_api_reports_a_failed_write_as_failed_and_leaves_nothing_to_recover() {
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let faults = std::sync::Arc::new(std::sync::Mutex::new(Faults::default()));
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: faults.clone(),
    }));
    let context = f.context(f.repo("repo"));
    let edit = |value: &str| {
        let view = app.inspect(&context).unwrap();
        app.plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: value.into(),
            },
        })
        .unwrap()
    };

    faults.lock().unwrap().publish = true;
    let failed = app.apply(&edit("failed@example.test").id).unwrap();
    assert_eq!(failed.status, "failed", "{failed:?}");
    assert!(failed.operation.is_none());
    assert!(
        app.operation().unwrap().is_none(),
        "no recovery banner for a write that did not happen"
    );
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        "[user]\nemail = old@example.test\n"
    );

    faults.lock().unwrap().publish = false;
    let written = app.apply(&edit("new@example.test").id).unwrap();
    assert_eq!(written.status, "written", "{written:?}");
    let operation = written.operation.unwrap().id;

    faults.lock().unwrap().publish = true;
    let undo_failed = app.undo(&operation).unwrap();
    assert_eq!(undo_failed.status, "failed", "{undo_failed:?}");
    assert_eq!(
        app.operation().unwrap().unwrap().status,
        "applied",
        "the edit can still be undone"
    );

    faults.lock().unwrap().publish = false;
    assert_eq!(app.undo(&operation).unwrap().status, "restored");
}

#[test]
fn configuration_api_reports_capability_limits_and_dubious_ownership_without_bypassing_git() {
    let f = Fixture::new();
    f.file("global","[user]\nemail = global@example.test\n[includeIf \"hasconfig:remote.*.url:git@github.com:*/**\"]\npath = work\n");
    f.file("work", "[user]\nemail = work@example.test\n");
    let repo = f.repo("repo");
    f.file("repo/.git/config", "[user]\nemail = local@example.test\n");
    let faults = std::sync::Arc::new(std::sync::Mutex::new(Faults {
        version: Some("git version 2.31.0".into()),
        dubious: true,
        ..Default::default()
    }));
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults,
    }));
    let view = app.inspect(&f.context(repo)).unwrap();
    assert!(!view.git.remote_rules);
    assert!(!view.git.impact_preview);
    assert!(view.git.trust_command.unwrap().contains("safe.directory"));
    assert_eq!(
        view.git.identity.email.unwrap().value,
        "global@example.test"
    );
    assert!(!view.git.rules[0].editable);
    assert!(view
        .git
        .diagnostics
        .iter()
        .any(|d| d.contains("fixture-owner")));
    assert!(!fs::read_to_string(f.root.path().join("global"))
        .unwrap()
        .contains("safe.directory"));
}

#[test]
fn configuration_api_recovery_classifies_before_after_and_unexpected_without_overwriting() {
    // A publication that fails without writing leaves nothing to recover; that case is in
    // configuration_api_reports_a_failed_write_as_failed_and_leaves_nothing_to_recover.
    {
        let (publication_failure, readback_failure, expected) = (false, true, "after");
        let f = Fixture::new();
        f.file("global", "[user]\nemail = old@example.test\n");
        let context = f.context(f.repo("repo"));
        let faults = std::sync::Arc::new(std::sync::Mutex::new(Faults {
            publish: publication_failure,
            readback: readback_failure,
            ..Default::default()
        }));
        let app = ConfigurationApp::new(Box::new(FaultIo {
            native: f.io.clone(),
            faults,
        }));
        let view = app.inspect(&context).unwrap();
        let plan = app
            .plan(&ConfigurationPlanRequest {
                inspection: view.id,
                intent: ConfigurationIntent::GitValue {
                    occurrence: view.git.identity.email.unwrap().id,
                    value: "new@example.test".into(),
                },
            })
            .unwrap();
        let result = app.apply(&plan.id).unwrap();
        assert_eq!(result.readback, "unverified");
        let restarted = ConfigurationApp::new(Box::new(f.io.clone()));
        let op = restarted.operation().unwrap().unwrap();
        assert_eq!(op.recovery.as_deref(), Some(expected));
        let current = fs::read(f.root.path().join("global")).unwrap();
        restarted.acknowledge_recovery(&op.id).unwrap();
        assert_eq!(fs::read(f.root.path().join("global")).unwrap(), current);
        if expected == "after" {
            restarted.undo(&op.id).unwrap();
            assert_eq!(
                fs::read_to_string(f.root.path().join("global")).unwrap(),
                "[user]\nemail = old@example.test\n"
            );
        }
    }
}

#[test]
fn configuration_api_preserves_file_bytes_duplicates_and_unsupported_encodings() {
    for text in ["[user]\nemail=first@example.test\nemail=old@example.test # comment\n[future]\nunknown = yes\n","\u{feff}[user]\r\nemail = old@example.test\r\n# untouched\n","[user]\nemail = old@example.test"] {
        let f=Fixture::new();f.file("global",text);let view=f.app.inspect(&f.context(f.repo("repo"))).unwrap();
        let plan=f.app.plan(&ConfigurationPlanRequest{inspection:view.id,intent:ConfigurationIntent::GitValue{occurrence:view.git.identity.email.unwrap().id,value:"new@example.test".into()}}).unwrap();
        let op=f.app.apply(&plan.id).unwrap();assert_eq!(op.status,"written");assert_eq!(fs::read_to_string(f.root.path().join("global")).unwrap(),text.replace("old@example.test","\"new@example.test\""));
        f.app.undo(&op.operation.unwrap().id).unwrap();assert_eq!(fs::read_to_string(f.root.path().join("global")).unwrap(),text);
    }
    let f = Fixture::new();
    let utf16 = [255, 254, 91, 0, 117, 0, 115, 0, 101, 0, 114, 0, 93, 0];
    let repo = f.repo("repo");
    fs::write(f.root.path().join("global"), utf16).unwrap();
    let view = f.app.inspect(&f.context(repo)).unwrap();
    assert!(view
        .git
        .sources
        .iter()
        .filter(|s| s.scope == "global")
        .all(|s| !s.writable));
}

#[test]
fn configuration_api_keeps_owner_and_explicit_acl_after_apply_and_undo_and_refuses_a_locked_target()
{
    use std::os::windows::fs::OpenOptionsExt;
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let path = f.root.path().join("global");
    let runtime = f.io.runtime().unwrap();
    let acl =
        f.io.run(
            "icacls.exe",
            &[path.display().to_string(), "/inheritance:d".into()],
            &runtime.environment,
            f.root.path(),
        )
        .unwrap();
    assert!(acl.success);
    let acl_before =
        f.io.run(
            "icacls.exe",
            &[path.display().to_string()],
            &runtime.environment,
            f.root.path(),
        )
        .unwrap()
        .stdout;
    let view = f.app.inspect(&f.context(f.repo("repo"))).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    let op = f.app.apply(&plan.id).unwrap();
    assert_eq!(op.status, "written");
    assert_eq!(
        f.io.run(
            "icacls.exe",
            &[path.display().to_string()],
            &runtime.environment,
            f.root.path()
        )
        .unwrap()
        .stdout,
        acl_before
    );
    f.app.undo(&op.operation.unwrap().id).unwrap();
    assert_eq!(
        f.io.run(
            "icacls.exe",
            &[path.display().to_string()],
            &runtime.environment,
            f.root.path()
        )
        .unwrap()
        .stdout,
        acl_before
    );
    let view = f
        .app
        .inspect(&f.context(f.root.path().join("repo").display().to_string()))
        .unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "locked@example.test".into(),
            },
        })
        .unwrap();
    let _lock = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(1)
        .open(&path)
        .unwrap();
    // Refused before writing, or a write that failed: never "uncertain", since nothing changed.
    let result = f.app.apply(&plan.id);
    assert!(
        result.is_err() || result.as_ref().is_ok_and(|r| r.status == "failed"),
        "{result:?}"
    );
    assert_eq!(
        fs::read_to_string(path).unwrap(),
        "[user]\nemail = old@example.test\n"
    );
}

#[test]
fn configuration_api_does_not_journal_unrelated_lines_when_editing_a_rule() {
    let f = Fixture::new();
    f.file(
        "global",
        "[includeIf \"gitdir:./repo/\"]\n# unrelated-secret-sentinel\npath = first\n",
    );
    f.file("first", "[user]\nemail = first@example.test\n");
    f.file("second", "[user]\nemail = second@example.test\n");
    let view = f.app.inspect(&f.context(f.repo("repo"))).unwrap();
    let rule = &view.git.rules[0];
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id.clone(),
            intent: ConfigurationIntent::IncludeRule {
                rule: Some(rule.id.clone()),
                source: rule.source.clone(),
                condition: "gitdir/i:./repo/".into(),
                target: "second".into(),
            },
        })
        .unwrap();
    f.app.apply(&plan.id).unwrap();
    let journal = String::from_utf8(f.io.load_operation().unwrap().unwrap()).unwrap();
    assert!(!journal.contains("unrelated-secret-sentinel"));
}

#[test]
fn configuration_api_reads_linked_worktree_scopes_and_keeps_them_read_only() {
    let f = Fixture::new();
    f.file(
        "global",
        "[user]\nname = Global\nemail = global@example.test\n",
    );
    let repo = f.repo("main");
    let runtime = f.io.runtime().unwrap();
    let git = &runtime.executables[0].path;
    for args in [
        vec![
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "--allow-empty",
            "--no-verify",
            "--no-gpg-sign",
            "-m",
            "fixture",
        ],
        vec!["config", "extensions.worktreeConfig", "true"],
    ] {
        assert!(
            f.io.run(
                git,
                &args.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
                &runtime.environment,
                Path::new(&repo)
            )
            .unwrap()
            .success
        );
    }
    let linked = f.root.path().join("linked");
    assert!(
        f.io.run(
            git,
            &[
                "worktree".into(),
                "add".into(),
                "-b".into(),
                "fixture".into(),
                linked.display().to_string()
            ],
            &runtime.environment,
            Path::new(&repo)
        )
        .unwrap()
        .success
    );
    assert!(
        f.io.run(
            git,
            &[
                "config".into(),
                "--worktree".into(),
                "user.email".into(),
                "linked@example.test".into()
            ],
            &runtime.environment,
            &linked
        )
        .unwrap()
        .success
    );
    let view = f
        .app
        .inspect(&f.context(linked.display().to_string()))
        .unwrap();
    assert_ne!(view.git.git_directory, view.git.common_directory);
    let email = view.git.identity.email.unwrap();
    assert_eq!(email.value, "linked@example.test");
    assert_eq!(email.scope, "worktree");
    assert!(!email.editable);
}

#[test]
fn configuration_api_resolves_includes_of_an_ssh_dash_f_file_from_the_clients_ssh_folder() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    fs::create_dir_all(f.root.path().join(".ssh")).unwrap();
    fs::create_dir_all(f.root.path().join("custom")).unwrap();
    // OpenSSH: a relative Include in a user configuration file is in ~/.ssh, -F file or not.
    f.file("custom/config", "Include extra.conf\n");
    f.file(
        "custom/extra.conf",
        "Host sample\n User from-custom-folder\n",
    );
    f.file(".ssh/extra.conf", "Host sample\n User from-ssh-folder\n");
    let custom = f.root.path().join("custom/config").display().to_string();
    f.file(
        "global",
        &format!(
            "[core]\n\tsshCommand = ssh -F '{}'\n",
            custom.replace('\\', "/")
        ),
    );
    let view = f.app.inspect(&f.context(repo)).unwrap();
    let host = view.ssh.hosts.iter().find(|h| h.name == "sample").unwrap();
    assert_eq!(
        host.values.iter().find(|o| o.key == "user").unwrap().value,
        "from-ssh-folder"
    );
}

#[test]
fn configuration_api_finds_a_relative_identity_file_where_git_runs_ssh() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    fs::create_dir_all(f.root.path().join(".ssh")).unwrap();
    fs::create_dir_all(Path::new(&repo).join("keys")).unwrap();
    f.file(".ssh/config", "Host sample\n IdentityFile keys/id_repo\n");
    f.file("repo/keys/id_repo.pub", "ssh-ed25519 AAAA fixture\n");
    let view = f.app.inspect(&f.context(repo.clone())).unwrap();
    let key = view
        .ssh
        .keys
        .iter()
        .find(|k| k.referenced)
        .expect("the referenced key is listed");
    // OpenSSH opens a relative IdentityFile from its working folder, the repository Git runs in.
    assert_eq!(
        Path::new(&key.path),
        Path::new(&repo).join("keys").join("id_repo")
    );
}

#[test]
fn configuration_api_takes_git_ssh_as_one_program_path_even_with_spaces() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    fs::create_dir_all(f.root.path().join(".ssh")).unwrap();
    f.file(".ssh/config", "Host sample\nUser fixture\n");
    let mut runtime = f.io.runtime().unwrap();
    let client = r"C:\Program Files\OpenSSH\ssh.exe".to_owned();
    runtime.ssh_clients[0].executable.path = client.clone();
    runtime.environment.insert("GIT_SSH".into(), client.clone());
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            runtime: Some(runtime),
            ..Default::default()
        })),
    }));
    let view = app.inspect(&f.context(repo)).unwrap();
    assert_eq!(
        view.ssh.client.as_deref(),
        Some(client.as_str()),
        "{:?}",
        view.ssh.diagnostics
    );
}

#[test]
fn configuration_api_ssh_client_choice_honors_command_precedence_and_manual_selection() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    fs::create_dir_all(f.root.path().join(".ssh")).unwrap();
    f.file(".ssh/config", "Host sample\nUser fixture\n");
    f.file("global", "[core]\nsshCommand = ssh -i ~/.ssh/from_git\n");
    let base = f.io.runtime().unwrap();
    for (command, git_ssh, expected, identity) in [
        (Some("wrapper --option"), None, false, None),
        (
            Some("ssh -i ~/.ssh/from_environment"),
            Some("wrapper"),
            true,
            Some("~/.ssh/from_environment"),
        ),
        (None, Some("wrapper"), true, Some("~/.ssh/from_git")),
    ] {
        let mut runtime = base.clone();
        if let Some(command) = command {
            runtime
                .environment
                .insert("GIT_SSH_COMMAND".into(), command.into());
        }
        if let Some(command) = git_ssh {
            runtime.environment.insert("GIT_SSH".into(), command.into());
        }
        let faults = std::sync::Arc::new(std::sync::Mutex::new(Faults {
            runtime: Some(runtime.clone()),
            ..Default::default()
        }));
        let app = ConfigurationApp::new(Box::new(FaultIo {
            native: f.io.clone(),
            faults,
        }));
        let view = app.inspect(&f.context(repo.clone())).unwrap();
        assert_eq!(view.ssh.client.is_some(), expected);
        if let Some(identity) = identity {
            assert!(view.ssh.hosts[0]
                .values
                .iter()
                .any(|o| o.key == "identityfile" && o.value == identity));
        }
        if !expected {
            let mut context = f.context(repo.clone());
            context.ssh_client = Some(runtime.ssh_clients[0].executable.path.clone());
            assert!(app.inspect(&context).unwrap().ssh.client.is_some());
        }
    }
    f.file("global", "");
    let mut runtime = base;
    runtime
        .environment
        .insert("GIT_SSH".into(), "wrapper".into());
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            runtime: Some(runtime),
            ..Default::default()
        })),
    }));
    assert!(app.inspect(&f.context(repo)).unwrap().ssh.client.is_none());
}

#[test]
fn configuration_api_static_ssh_matches_identified_native_client_on_controlled_fixture() {
    let f = Fixture::new();
    let runtime = f.io.runtime().unwrap();
    let found =
        f.io.run(
            "where.exe",
            &["ssh.exe".into()],
            &runtime.environment,
            f.root.path(),
        )
        .unwrap();
    let ssh = found
        .stdout
        .lines()
        .next()
        .expect("native OpenSSH required for this acceptance test")
        .to_owned();
    fs::create_dir_all(f.root.path().join(".ssh/includes")).unwrap();
    f.file(".ssh/config","Include includes/*.conf\nHost oracle\nHostName example.test\nUser git\nPort 2222\nIdentityFile ~/.ssh/one\nHost * !excluded\nIdentityFile ~/.ssh/two\nIdentitiesOnly yes\n");
    f.file(".ssh/includes/a.conf", "Host oracle\nUser first\n");
    f.file(".ssh/includes/b.conf", "Host oracle\nPort 2200\n");
    // By full path: a shell such as Git Bash puts GNU whoami, which has no /user, first on PATH.
    let whoami = Path::new(&std::env::var("SystemRoot").unwrap())
        .join("System32")
        .join("whoami.exe");
    let who =
        f.io.run(
            &whoami.display().to_string(),
            &["/user".into(), "/fo".into(), "csv".into(), "/nh".into()],
            &runtime.environment,
            f.root.path(),
        )
        .unwrap();
    assert!(who.success, "{}", who.stderr);
    let sid = who
        .stdout
        .trim()
        .split(',')
        .next_back()
        .unwrap()
        .trim_matches('"');
    for file in [
        ".ssh/config",
        ".ssh/includes/a.conf",
        ".ssh/includes/b.conf",
    ] {
        let acl =
            f.io.run(
                "icacls.exe",
                &[
                    f.root.path().join(file).display().to_string(),
                    "/inheritance:r".into(),
                    "/grant:r".into(),
                    format!("*{sid}:(F)"),
                ],
                &runtime.environment,
                f.root.path(),
            )
            .unwrap();
        assert!(
            acl.success,
            "{file}: {} {} (sid {sid:?})",
            acl.stdout, acl.stderr
        );
    }
    let mut runtime = runtime;
    runtime.ssh_clients[0].executable.path = ssh.clone();
    let faults = std::sync::Arc::new(std::sync::Mutex::new(Faults {
        runtime: Some(runtime.clone()),
        ..Default::default()
    }));
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults,
    }));
    let view = app.inspect(&f.context(f.repo("repo"))).unwrap();
    assert_eq!(view.ssh.client.as_deref(), Some(ssh.as_str()));
    let host = view.ssh.hosts.iter().find(|h| h.name == "oracle").unwrap();
    let oracle =
        f.io.run(
            &ssh,
            &[
                "-G".into(),
                "-F".into(),
                f.root.path().join(".ssh/config").display().to_string(),
                "oracle".into(),
            ],
            &runtime.environment,
            f.root.path(),
        )
        .unwrap();
    assert!(oracle.success, "{}", oracle.stderr);
    for key in ["hostname", "user", "port", "identitiesonly"] {
        let expected = oracle
            .stdout
            .lines()
            .find_map(|line| line.strip_prefix(&format!("{key} ")))
            .unwrap();
        assert_eq!(
            host.values.iter().find(|o| o.key == key).unwrap().value,
            expected,
            "{key}"
        );
    }
    assert_eq!(
        host.values
            .iter()
            .filter(|o| o.key == "identityfile")
            .map(|o| o.value.as_str())
            .collect::<Vec<_>>(),
        ["~/.ssh/one", "~/.ssh/two"]
    );
}

#[test]
fn configuration_api_public_key_inventory_never_opens_private_files() {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::os::windows::fs::OpenOptionsExt;
    let f = Fixture::new();
    let repo = f.repo("repo");
    fs::create_dir_all(f.root.path().join(".ssh")).unwrap();
    f.file(
        ".ssh/config",
        "Host sample\nIdentityFile ~/.ssh/id_one\nIdentityFile ~/.ssh/missing\n",
    );
    f.file(".ssh/id_one", "private content must not be read");
    let mut blob = vec![0, 0, 0, 11];
    blob.extend_from_slice(b"ssh-ed25519");
    blob.extend_from_slice(&[0, 0, 0, 32]);
    blob.extend_from_slice(&[7; 32]);
    let public = format!("ssh-ed25519 {} fixture\n", STANDARD.encode(blob));
    f.file(".ssh/id_one.pub", &public);
    f.file(".ssh/unreferenced.pub", &public);
    let _lock = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(f.root.path().join(".ssh/id_one"))
        .unwrap();
    let view = f.app.inspect(&f.context(repo)).unwrap();
    let key = view
        .ssh
        .keys
        .iter()
        .find(|k| k.path.ends_with("id_one"))
        .unwrap();
    assert!(key.exists && key.referenced);
    assert_eq!(key.algorithm.as_deref(), Some("ssh-ed25519"));
    assert!(key.fingerprint.as_ref().unwrap().starts_with("SHA256:"));
    assert!(view.ssh.keys.iter().any(|k| k.referenced && !k.exists));
    assert!(view.ssh.keys.iter().any(|k| !k.referenced));
    assert!(!serde_json::to_string(&view)
        .unwrap()
        .contains("private content"));
}

#[test]
fn configuration_api_redacts_sensitive_include_rules_before_transport() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    f.file("global","[includeIf \"hasconfig:remote.*.url:https://person:rule-secret@example.test/**\"]\npath = work\n");
    f.file("work", "[user]\nname = Work\n");
    let view = f.app.inspect(&f.context(repo)).unwrap();
    assert!(!serde_json::to_string(&view)
        .unwrap()
        .contains("rule-secret"));
    assert_eq!(view.git.rules[0].condition, "[redacted]");
    assert!(!view.git.rules[0].editable);
}

#[test]
fn configuration_api_invalidates_plans_when_any_previewed_repository_changes() {
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let first = f.repo("first");
    let second = f.repo("second");
    f.app.inspect(&f.context(second.clone())).unwrap();
    let view = f.app.inspect(&f.context(first)).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    assert_eq!(plan.impacts.len(), 2);
    fs::write(
        Path::new(&second).join(".git/config"),
        "[user]\nemail = external@example.test\n",
    )
    .unwrap();
    assert!(f.app.apply(&plan.id).is_err());
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        "[user]\nemail = old@example.test\n"
    );
}

#[test]
fn configuration_api_marks_shared_global_and_local_include_previews_unresolved() {
    let f = Fixture::new();
    f.file("global", "[include]\npath = shared\n");
    f.file("shared", "[user]\nemail = shared@example.test\n");
    let repo = f.repo("repo");
    fs::write(
        Path::new(&repo).join(".git/config"),
        format!(
            "[include]\npath = {}\n",
            crate::whichcraft::domain::configuration_document::quote_git(
                &f.root.path().join("shared").display().to_string()
            )
        ),
    )
    .unwrap();
    let view = f.app.inspect(&f.context(repo)).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    assert_eq!(plan.impacts[0].status, "unresolved");
    assert!(plan.impacts[0]
        .reason
        .as_ref()
        .unwrap()
        .contains("also loaded"));
}

#[test]
fn configuration_api_uses_selected_ssh_clients_home_for_tilde_expansion() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    let profile = f.root.path().join("windows");
    let git_home = f.root.path().join("git-home");
    fs::create_dir_all(profile.join(".ssh")).unwrap();
    fs::create_dir_all(&git_home).unwrap();
    fs::write(profile.join(".ssh/config"), "Include ~/.ssh/work.conf\n").unwrap();
    fs::write(
        profile.join(".ssh/work.conf"),
        "Host windows\nUser correct-profile\nIdentityFile ~/.ssh/id_windows\n",
    )
    .unwrap();
    fs::write(profile.join(".ssh/id_windows"), "never read private").unwrap();
    let mut runtime = f.io.runtime().unwrap();
    runtime
        .environment
        .insert("HOME".into(), git_home.display().to_string());
    runtime
        .environment
        .insert("USERPROFILE".into(), profile.display().to_string());
    runtime.ssh_clients[0].user_config = profile.join(".ssh/config");
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            runtime: Some(runtime),
            ..Default::default()
        })),
    }));
    let view = app.inspect(&f.context(repo)).unwrap();
    let host = view.ssh.hosts.iter().find(|h| h.name == "windows").unwrap();
    assert!(host
        .values
        .iter()
        .any(|o| o.key == "user" && o.value == "correct-profile"));
    assert!(view
        .ssh
        .keys
        .iter()
        .any(|key| Path::new(&key.path).starts_with(&profile)
            && Path::new(&key.path).file_name() == Some(std::ffi::OsStr::new("id_windows"))
            && key.exists));
}

#[test]
fn configuration_api_keeps_last_successful_undo_when_a_later_attempt_fails() {
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let context = f.context(f.repo("repo"));
    let view = f.app.inspect(&context).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "first@example.test".into(),
            },
        })
        .unwrap();
    let first = f.app.apply(&plan.id).unwrap().operation.unwrap();
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            publish: true,
            ..Default::default()
        })),
    }));
    let view = app.inspect(&context).unwrap();
    let plan = app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "second@example.test".into(),
            },
        })
        .unwrap();
    let failed = app.apply(&plan.id).unwrap();
    assert_eq!(failed.status, "failed", "{failed:?}");
    let restarted = ConfigurationApp::new(Box::new(f.io.clone()));
    assert_eq!(restarted.operation().unwrap().unwrap().id, first.id);
    restarted.undo(&first.id).unwrap();
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        "[user]\nemail = old@example.test\n"
    );
}

#[test]
fn configuration_api_holds_the_os_guard_through_the_publication_boundary() {
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let context = f.context(f.repo("repo"));
    let mut io = f.io.clone();
    io.before_commit = Some(std::sync::Arc::new(|path| {
        assert!(fs::write(path, "external direct write").is_err());
        let replacement = path.with_extension("other-editor");
        fs::write(&replacement, "external atomic write").unwrap();
        assert!(fs::rename(&replacement, path).is_err());
        fs::remove_file(replacement).unwrap();
    }));
    let app = ConfigurationApp::new(Box::new(io));
    let view = app.inspect(&context).unwrap();
    let plan = app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    let result = app.apply(&plan.id).unwrap();
    assert_eq!(result.status, "written");
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        "[user]\nemail = \"new@example.test\"\n"
    );
}

#[test]
fn configuration_api_inventories_keys_from_git_ssh_command_outside_the_ssh_folder() {
    let f = Fixture::new();
    let repo = f.repo("repo");
    f.file("outside-key", "private key contents never read");
    let key = f
        .root
        .path()
        .join("outside-key")
        .display()
        .to_string()
        .replace('\\', "/");
    f.file("global", &format!("[core]\nsshCommand = ssh -i {key}\n"));
    let view = f.app.inspect(&f.context(repo)).unwrap();
    assert!(view
        .ssh
        .keys
        .iter()
        .any(|k| k.path.ends_with("outside-key") && k.exists && k.referenced));
    assert!(!serde_json::to_string(&view)
        .unwrap()
        .contains("private key contents"));
}

#[test]
fn configuration_api_reports_undo_readback_uncertainty_and_recovers_without_a_second_undo() {
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let context = f.context(f.repo("repo"));
    let view = f.app.inspect(&context).unwrap();
    let plan = f
        .app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    let op = f.app.apply(&plan.id).unwrap().operation.unwrap();
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            readback: true,
            ..Default::default()
        })),
    }));
    let outcome = app.undo(&op.id).unwrap();
    assert_eq!(outcome.status, "uncertain");
    assert_eq!(outcome.readback, "unverified");
    assert_eq!(
        fs::read_to_string(f.root.path().join("global")).unwrap(),
        "[user]\nemail = old@example.test\n"
    );
    let restarted = ConfigurationApp::new(Box::new(f.io.clone()));
    let recovery = restarted.operation().unwrap().unwrap();
    assert_eq!(recovery.recovery.as_deref(), Some("after"));
    restarted.acknowledge_recovery(&recovery.id).unwrap();
    assert!(restarted.operation().unwrap().is_none());
    assert!(restarted.undo(&op.id).is_err());
}

#[test]
fn configuration_api_reports_written_file_when_completion_journal_fails() {
    let f = Fixture::new();
    f.file("global", "[user]\nemail = old@example.test\n");
    let context = f.context(f.repo("repo"));
    let app = ConfigurationApp::new(Box::new(FaultIo {
        native: f.io.clone(),
        faults: std::sync::Arc::new(std::sync::Mutex::new(Faults {
            completion_journal: true,
            ..Default::default()
        })),
    }));
    let view = app.inspect(&context).unwrap();
    let plan = app
        .plan(&ConfigurationPlanRequest {
            inspection: view.id,
            intent: ConfigurationIntent::GitValue {
                occurrence: view.git.identity.email.unwrap().id,
                value: "new@example.test".into(),
            },
        })
        .unwrap();
    let outcome = app.apply(&plan.id).unwrap();
    assert_eq!(outcome.status, "written");
    assert_eq!(outcome.readback, "unverified");
    assert!(fs::read_to_string(f.root.path().join("global"))
        .unwrap()
        .contains("new@example.test"));
    let restarted = ConfigurationApp::new(Box::new(f.io.clone()));
    let recovery = restarted.operation().unwrap().unwrap();
    assert_eq!(recovery.recovery.as_deref(), Some("after"));
    restarted.acknowledge_recovery(&recovery.id).unwrap();
    restarted.undo(&recovery.id).unwrap();
}
