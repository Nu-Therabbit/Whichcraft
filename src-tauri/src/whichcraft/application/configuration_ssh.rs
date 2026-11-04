use super::*;
use base64::{engine::general_purpose::STANDARD, Engine};

#[derive(Default)]
struct Evaluation {
    active: bool,
    dynamic: bool,
    values: Vec<ConfigOccurrence>,
    unresolved: Vec<String>,
}
#[derive(Clone, Copy)]
struct SshEvaluationContext<'a> {
    base: &'a Path,
    host: &'a str,
    runtime: &'a ConfigurationRuntime,
    documents: &'a [Document],
}
impl ConfigurationApp {
    pub(super) fn inspect_ssh(
        &self,
        context: &ConfigurationContext,
        runtime: &ConfigurationRuntime,
        git: &GitInspection,
        documents: &mut Vec<Document>,
    ) -> ConfigResult<SshInspection> {
        let shell_command = env_value(&runtime.environment, "GIT_SSH_COMMAND")
            .map(str::to_owned)
            .or_else(|| {
                git.occurrences
                    .iter()
                    .rev()
                    .find(|o| o.key == "core.sshcommand")
                    .map(|o| o.value.clone())
            });
        // GIT_SSH_COMMAND and core.sshCommand are split like a shell would; GIT_SSH is one program
        // path taking no arguments, spaces and all.
        let (command, tokens) = match shell_command {
            Some(command) => {
                let tokens = words(&command);
                (Some(command), tokens)
            }
            None => {
                let program = env_value(&runtime.environment, "GIT_SSH").map(str::to_owned);
                (program.clone(), program.into_iter().collect())
            }
        };
        let mut view = SshInspection {
            command: command.as_ref().map(|s| redact("sshcommand", s)),
            clients: runtime
                .ssh_clients
                .iter()
                .map(|c| c.executable.clone())
                .collect(),
            ..Default::default()
        };
        let selected = if let Some(path) = &context.ssh_client {
            runtime
                .ssh_clients
                .iter()
                .find(|c| &c.executable.path == path)
        } else if let Some(program) = tokens.first() {
            if program.eq_ignore_ascii_case("ssh") || program.eq_ignore_ascii_case("ssh.exe") {
                default_client(runtime, git)
            } else {
                runtime.ssh_clients.iter().find(|c| {
                    c.executable
                        .path
                        .replace('\\', "/")
                        .eq_ignore_ascii_case(&program.replace('\\', "/"))
                })
            }
        } else {
            default_client(runtime, git)
        };
        let Some(client) = selected.cloned() else {
            view.diagnostics.push("Git's SSH command is a wrapper or an unidentified client. Choose an SSH client to inspect its files.".into());
            return Ok(view);
        };
        let mut ssh_runtime = runtime.clone();
        if let Some(client_home) = client.user_config.parent().and_then(Path::parent) {
            ssh_runtime
                .environment
                .retain(|key, _| !key.eq_ignore_ascii_case("HOME"));
            ssh_runtime
                .environment
                .insert("HOME".into(), source_path(client_home));
        }
        let runtime = &ssh_runtime;
        view.client = Some(client.executable.path.clone());
        let mut user = client.user_config.clone();
        let mut system = Some(client.system_config.clone());
        let mut command_values = vec![];
        let mut index = 1;
        while index < tokens.len() {
            let token = &tokens[index];
            let (flag, arg, consumed) = if ["-F", "-i", "-p", "-o"].contains(&token.as_str()) {
                (token.as_str(), tokens.get(index + 1).cloned(), 2)
            } else if token.starts_with("-o") && token.len() > 2 {
                ("-o", Some(token[2..].into()), 1)
            } else {
                ("", None, 1)
            };
            if let Some(arg) = arg {
                match flag {
                    "-F" => {
                        let cwd = context
                            .repository
                            .as_deref()
                            .map(PathBuf::from)
                            .unwrap_or_else(|| home(&runtime.environment));
                        user = resolve_path(&arg, &cwd.join("command"), &runtime.environment);
                        system = None;
                    }
                    "-i" => command_values.push(command_occurrence("identityfile", &arg, index)),
                    "-p" => command_values.push(command_occurrence("port", &arg, index)),
                    "-o" => {
                        let mut pair = arg.splitn(2, ['=', ' ']);
                        let key = pair.next().unwrap().to_ascii_lowercase();
                        if let Some(value) = pair.next() {
                            command_values.push(command_occurrence(&key, value, index));
                        } else {
                            view.diagnostics
                                .push("Unresolved SSH command option".into());
                        }
                    }
                    _ => {}
                }
            } else if token != "-T" && token != "-v" && token != "-vv" && token != "-vvv" {
                view.diagnostics.push("SSH command contains options outside the static inspector; result may be incomplete".into());
            }
            index += consumed;
        }
        // OpenSSH looks for a relative Include of any user configuration file, an -F one too, in
        // the client's ~/.ssh.
        let user_root = client
            .user_config
            .parent()
            .unwrap_or(Path::new("."))
            .to_path_buf();
        let mut seen = HashSet::new();
        self.ssh_documents(
            &user,
            "user",
            None,
            &user_root,
            runtime,
            SourceWalk {
                documents,
                seen: &mut seen,
                depth: 0,
            },
        )?;
        if let Some(system) = &system {
            self.ssh_documents(
                system,
                "system",
                None,
                system.parent().unwrap_or(Path::new(".")),
                runtime,
                SourceWalk {
                    documents,
                    seen: &mut seen,
                    depth: 0,
                },
            )?;
        }
        let mut names = vec![];
        for d in documents
            .iter()
            .filter(|d| d.ssh)
            .flat_map(|d| d.syntax.directives.iter())
            .filter(|d| d.key == "host")
        {
            for pattern in words(&d.value).into_iter().filter(|p| !p.starts_with('!')) {
                if !names.contains(&pattern) {
                    names.push(pattern);
                }
            }
        }
        for remote in git
            .occurrences
            .iter()
            .filter(|o| o.key.starts_with("remote.") && o.key.ends_with(".url"))
        {
            if let Some(host) = remote_host(&remote.value) {
                if !names.contains(&host) {
                    names.push(host);
                }
            }
        }
        for name in names {
            let mut evaluation = Evaluation {
                active: true,
                values: command_values.clone(),
                ..Default::default()
            };
            self.evaluate_ssh(
                &user,
                SshEvaluationContext {
                    base: &user_root,
                    host: &name,
                    runtime,
                    documents,
                },
                &mut evaluation,
                0,
            )?;
            if let Some(system) = &system {
                evaluation.active = true;
                evaluation.dynamic = false;
                self.evaluate_ssh(
                    system,
                    SshEvaluationContext {
                        base: system.parent().unwrap_or(Path::new(".")),
                        host: &name,
                        runtime,
                        documents,
                    },
                    &mut evaluation,
                    0,
                )?;
            }
            view.hosts.push(SshHost {
                name,
                values: evaluation.values,
                unresolved: evaluation.unresolved,
            });
        }
        let mut paths = HashMap::<String, bool>::new();
        let command_anchor = context
            .repository
            .as_deref()
            .map(PathBuf::from)
            .unwrap_or_else(|| home(&runtime.environment))
            .join("command");
        for value in documents
            .iter()
            .filter(|d| d.ssh)
            .flat_map(|d| d.syntax.directives.iter())
            .filter(|d| d.key == "identityfile")
            .map(|d| &d.value)
            .chain(
                command_values
                    .iter()
                    .filter(|o| o.key == "identityfile")
                    .map(|o| &o.value),
            )
        {
            if value == "none" {
                continue;
            }
            if value.contains('%') || value.contains("${") {
                view.diagnostics.push(format!(
                    "IdentityFile token requires host context: {}",
                    redact("path", value)
                ));
                continue;
            }
            // OpenSSH opens a relative IdentityFile from its working folder, which is where Git
            // runs it, whether the value came from a config file or the command.
            let path = resolve_path(value, &command_anchor, &runtime.environment);
            let path = self
                .io
                .canonical(&path)
                .unwrap_or_else(|_| path.components().collect());
            paths.insert(source_path(&path), true);
        }
        for path in self.io.glob(&source_path(&user_root.join("*.pub")))? {
            let path = source_path(&path.components().collect::<PathBuf>());
            let private = path.strip_suffix(".pub").unwrap_or(&path).to_owned();
            paths.entry(private).or_insert(false);
        }
        for (path, referenced) in paths {
            let public = if path.ends_with(".pub") {
                PathBuf::from(&path)
            } else {
                PathBuf::from(format!("{path}.pub"))
            };
            let mut info = PublicKeyInfo {
                exists: self.io.exists(Path::new(&path)),
                path,
                referenced,
                algorithm: None,
                fingerprint: None,
            };
            // Only .pub files are ever opened. A reference to a private key is checked by metadata.
            if let Some(bytes) = self.io.read(&public)? {
                if let Ok(text) = std::str::from_utf8(&bytes) {
                    let mut fields = text.split_whitespace();
                    if let (Some(algorithm), Some(encoded)) = (fields.next(), fields.next()) {
                        if let Ok(blob) = STANDARD.decode(encoded) {
                            if blob.len() > 4 {
                                let len =
                                    u32::from_be_bytes(blob[..4].try_into().unwrap()) as usize;
                                if blob.get(4..4 + len) == Some(algorithm.as_bytes()) {
                                    info.algorithm = Some(algorithm.into());
                                    info.fingerprint = Some(format!(
                                        "SHA256:{}",
                                        STANDARD.encode(Sha256::digest(blob)).trim_end_matches('=')
                                    ));
                                }
                            }
                        }
                    }
                }
            }
            view.keys.push(info);
        }
        view.keys.sort_by(|a, b| a.path.cmp(&b.path));
        view.sources = documents
            .iter()
            .filter(|d| d.ssh)
            .map(|d| {
                let mut source = d.source.clone();
                source.content = redact_source(&source.content, true);
                source
            })
            .collect();
        for host in &mut view.hosts {
            for occurrence in &mut host.values {
                occurrence.value = redact(&occurrence.key, &occurrence.value);
            }
        }
        Ok(view)
    }
    fn ssh_documents(
        &self,
        path: &Path,
        scope: &str,
        parent: Option<String>,
        base: &Path,
        runtime: &ConfigurationRuntime,
        walk: SourceWalk<'_>,
    ) -> ConfigResult<()> {
        let SourceWalk {
            documents,
            seen,
            depth,
        } = walk;
        if depth > 20 || documents.len() > 100 {
            return Err(problem("SSH include limit reached"));
        }
        let identity = self
            .io
            .canonical(path)
            .map(|p| source_path(&p))
            .unwrap_or_else(|_| source_path(path));
        if !seen.insert(identity.clone()) {
            return Ok(());
        }
        let Some(document) = self.read_document(path, scope, parent, true)? else {
            return Ok(());
        };
        let includes = document
            .syntax
            .directives
            .iter()
            .filter(|d| d.key == "include")
            .flat_map(|d| words(&d.value))
            .collect::<Vec<_>>();
        documents.push(document);
        for pattern in includes {
            let path = ssh_include(&pattern, base, &runtime.environment);
            for target in self.io.glob(&source_path(&path))? {
                self.ssh_documents(
                    &target,
                    scope,
                    Some(identity.clone()),
                    base,
                    runtime,
                    SourceWalk {
                        documents,
                        seen,
                        depth: depth + 1,
                    },
                )?;
            }
        }
        Ok(())
    }
    fn evaluate_ssh(
        &self,
        path: &Path,
        context: SshEvaluationContext<'_>,
        result: &mut Evaluation,
        depth: usize,
    ) -> ConfigResult<()> {
        let SshEvaluationContext {
            base,
            host,
            runtime,
            documents,
        } = context;
        if depth > 20 {
            result
                .unresolved
                .push("SSH include cycle or depth limit".into());
            return Ok(());
        }
        let Some(document) = documents
            .iter()
            .find(|d| d.ssh && Path::new(&d.source.path) == path)
        else {
            return Ok(());
        };
        for d in &document.syntax.directives {
            match d.key.as_str() {
                "host" => {
                    result.active = host_patterns(&d.value, host);
                    result.dynamic = false;
                }
                "match" => {
                    if d.value.eq_ignore_ascii_case("all") {
                        result.active = true;
                        result.dynamic = false;
                    } else {
                        result.active = false;
                        result.dynamic = true;
                        let reason = format!(
                            "Unresolved Match condition at {}:{}; no commands were executed",
                            document.source.path, d.line
                        );
                        if !result.unresolved.contains(&reason) {
                            result.unresolved.push(reason);
                        }
                    }
                }
                "include" => {
                    if result.active && !result.dynamic {
                        for pattern in words(&d.value) {
                            let path = ssh_include(&pattern, base, &runtime.environment);
                            let targets = self.io.glob(&source_path(&path))?;
                            if targets.is_empty() {
                                result
                                    .unresolved
                                    .push(format!("Missing include: {}", source_path(&path)));
                            }
                            for target in targets {
                                self.evaluate_ssh(
                                    &target,
                                    SshEvaluationContext {
                                        base,
                                        host,
                                        runtime,
                                        documents,
                                    },
                                    result,
                                    depth + 1,
                                )?;
                            }
                        }
                    }
                }
                _ if result.active && !result.dynamic => {
                    let accumulating = [
                        "identityfile",
                        "certificatefile",
                        "localforward",
                        "remoteforward",
                        "sendenv",
                    ]
                    .contains(&d.key.as_str());
                    if accumulating || !result.values.iter().any(|o| o.key == d.key) {
                        let editable = d.key == "identityfile"
                            && document.source.writable
                            && !d.value.contains(['%', '\n'])
                            && !d.value.contains("${");
                        result.values.push(ConfigOccurrence {
                            id: format!("ssh:{}:{}", document.source.path, d.line),
                            key: d.key.clone(),
                            value: d.value.clone(),
                            source: document.source.path.clone(),
                            scope: document.source.scope.clone(),
                            line: Some(d.line),
                            editable,
                            reason: if editable {
                                None
                            } else {
                                Some("Static inspection only".into())
                            },
                        });
                    }
                    if ["canonicalizehostname", "proxycommand", "proxyjump"]
                        .contains(&d.key.as_str())
                    {
                        let message=format!("{} is preserved and not executed; connection behavior may depend on it",d.key);
                        if !result.unresolved.contains(&message) {
                            result.unresolved.push(message);
                        }
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }
}
fn command_occurrence(key: &str, value: &str, index: usize) -> ConfigOccurrence {
    ConfigOccurrence {
        id: format!("ssh-command:{index}"),
        key: key.into(),
        value: value.into(),
        source: "Git SSH command".into(),
        scope: "command".into(),
        line: None,
        editable: false,
        reason: Some("Command override; edit its Git source".into()),
    }
}
fn default_client<'a>(
    runtime: &'a ConfigurationRuntime,
    git: &GitInspection,
) -> Option<&'a ConfigurationSshClient> {
    runtime
        .ssh_clients
        .iter()
        .find(|c| {
            Path::new(&git.executable)
                .ancestors()
                .skip(1)
                .take(3)
                .any(|p| Path::new(&c.executable.path).starts_with(p))
        })
        .or_else(|| runtime.ssh_clients.first())
}
fn ssh_include(pattern: &str, base: &Path, env: &HashMap<String, String>) -> PathBuf {
    resolve_path(pattern, &base.join("config"), env)
}
fn words(text: &str) -> Vec<String> {
    let mut result = vec![];
    let mut word = String::new();
    let mut quote = None;
    for ch in text.chars() {
        if Some(ch) == quote {
            quote = None;
        } else if quote.is_none() && (ch == '"' || ch == '\'') {
            quote = Some(ch);
        } else if quote.is_none() && ch.is_whitespace() {
            if !word.is_empty() {
                result.push(std::mem::take(&mut word));
            }
        } else {
            word.push(ch);
        }
    }
    if !word.is_empty() {
        result.push(word);
    }
    result
}
fn host_patterns(patterns: &str, host: &str) -> bool {
    let mut matched = false;
    for pattern in words(patterns) {
        if let Some(negative) = pattern.strip_prefix('!') {
            if wildcard(negative, host) {
                return false;
            }
        } else if wildcard(&pattern, host) {
            matched = true;
        }
    }
    matched
}
fn wildcard(pattern: &str, host: &str) -> bool {
    let pattern = pattern.to_ascii_lowercase();
    let host = host.to_ascii_lowercase();
    let p = pattern.as_bytes();
    let h = host.as_bytes();
    let mut previous = vec![false; h.len() + 1];
    previous[0] = true;
    for c in p {
        let mut next = vec![false; h.len() + 1];
        if *c == b'*' {
            next[0] = previous[0];
        }
        for i in 1..=h.len() {
            next[i] = if *c == b'*' {
                previous[i] || next[i - 1]
            } else {
                (*c == b'?' || *c == h[i - 1]) && previous[i - 1]
            };
        }
        previous = next;
    }
    previous[h.len()]
}
fn remote_host(url: &str) -> Option<String> {
    if url == "[redacted]" {
        return None;
    }
    let authority = if let Some((_, rest)) = url.split_once("://") {
        rest.split('/').next()?
    } else {
        url.split(':').next()?
    };
    let host = authority.rsplit('@').next()?.split(':').next()?;
    if host.is_empty() || host.contains(['\\', ' ']) {
        None
    } else {
        Some(host.into())
    }
}
