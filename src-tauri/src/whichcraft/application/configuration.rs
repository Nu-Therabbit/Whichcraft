//! Repository-aware configuration use cases, using injected I/O ports.
use crate::{
    error::WhichcraftError,
    whichcraft::{
        domain::{configuration::*, configuration_document::*},
        ports::configuration::*,
    },
};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
#[path = "configuration_edits.rs"]
mod edits;
#[path = "configuration_ssh.rs"]
mod ssh;

pub(crate) fn problem(message: impl Into<String>) -> WhichcraftError {
    WhichcraftError::InvalidInput(message.into())
}
pub(crate) fn revision(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn env_value<'a>(env: &'a HashMap<String, String>, key: &str) -> Option<&'a str> {
    env.iter()
        .find(|(k, _)| k.eq_ignore_ascii_case(key))
        .map(|(_, v)| v.as_str())
}
fn home(env: &HashMap<String, String>) -> PathBuf {
    PathBuf::from(
        env_value(env, "HOME")
            .or_else(|| env_value(env, "USERPROFILE"))
            .unwrap_or("."),
    )
}
fn resolve_path(raw: &str, declaring: &Path, env: &HashMap<String, String>) -> PathBuf {
    if let Some(tail) = raw.strip_prefix("~/").or_else(|| raw.strip_prefix("~\\")) {
        home(env).join(tail)
    } else {
        let path = PathBuf::from(raw);
        if path.is_absolute() {
            path
        } else {
            declaring.parent().unwrap_or(declaring).join(path)
        }
    }
}
/// Where Git reads each conditional include, as (document, line) to position: depth first, an
/// included file's rules coming at the line that includes it.
fn read_order(
    documents: &[Document],
    env: &HashMap<String, String>,
) -> HashMap<(usize, usize), usize> {
    fn walk(
        doc: usize,
        documents: &[Document],
        env: &HashMap<String, String>,
        visited: &mut HashSet<usize>,
        order: &mut HashMap<(usize, usize), usize>,
    ) {
        if !visited.insert(doc) {
            return;
        }
        for d in &documents[doc].syntax.directives {
            let conditional = d.section == "includeif" && d.key.ends_with(".path");
            if !conditional && d.key != "include.path" {
                continue;
            }
            if conditional {
                let next = order.len();
                order.insert((doc, d.line), next);
            }
            let target = source_path(&resolve_path(
                &d.value,
                Path::new(&documents[doc].source.path),
                env,
            ));
            if let Some(child) = documents
                .iter()
                .position(|c| !c.ssh && c.source.path == target)
            {
                walk(child, documents, env, visited, order);
            }
        }
    }
    let mut visited = HashSet::new();
    let mut order = HashMap::new();
    for (index, doc) in documents.iter().enumerate() {
        if !doc.ssh && doc.source.included_from.is_none() {
            walk(index, documents, env, &mut visited, &mut order);
        }
    }
    order
}
/// PEM and OpenSSH keys (`-----BEGIN … PRIVATE KEY-----`) and PuTTY keys (`PuTTY-User-Key-File-`).
fn is_private_key_header(line: &str) -> bool {
    let line = line.trim_start_matches('\u{feff}').trim();
    (line.starts_with("-----BEGIN ") && line.contains("PRIVATE KEY"))
        || line.starts_with("PuTTY-User-Key-File-")
}
fn source_path(path: &Path) -> String {
    path.display()
        .to_string()
        .trim_start_matches("\\\\?\\")
        .to_owned()
}
fn global_roots(runtime: &ConfigurationRuntime) -> Vec<PathBuf> {
    if let Some(path) = env_value(&runtime.environment, "GIT_CONFIG_GLOBAL") {
        vec![PathBuf::from(path)]
    } else {
        vec![
            PathBuf::from(
                env_value(&runtime.environment, "XDG_CONFIG_HOME")
                    .map(str::to_owned)
                    .unwrap_or_else(|| {
                        home(&runtime.environment)
                            .join(".config")
                            .display()
                            .to_string()
                    }),
            )
            .join("git/config"),
            home(&runtime.environment).join(".gitconfig"),
        ]
    }
}

struct SourceWalk<'a> {
    documents: &'a mut Vec<Document>,
    seen: &'a mut HashSet<String>,
    depth: usize,
}

#[derive(Clone)]
struct Document {
    source: ConfigSource,
    bytes: Vec<u8>,
    syntax: SourceSyntax,
    ssh: bool,
    fingerprint: String,
}
#[derive(Clone)]
struct Inspection {
    view: ConfigurationInspection,
    runtime: ConfigurationRuntime,
    documents: Vec<Document>,
    executable_fingerprint: String,
}
#[derive(Default)]
struct Session {
    inspections: HashMap<String, Inspection>,
    plans: HashMap<String, edits::PendingPlan>,
    context: Option<ConfigurationContext>,
}
pub struct ConfigurationApp {
    io: Box<dyn ConfigurationIo>,
    state: Mutex<Session>,
    sequence: AtomicU64,
    inspection_sequence: AtomicU64,
}
impl ConfigurationApp {
    pub fn new(io: Box<dyn ConfigurationIo>) -> Self {
        Self {
            io,
            state: Mutex::new(Session::default()),
            sequence: AtomicU64::new(0),
            inspection_sequence: AtomicU64::new(0),
        }
    }
    fn id(&self, prefix: &str) -> String {
        format!("{prefix}-{}", self.sequence.fetch_add(1, Ordering::Relaxed))
    }
    fn git(
        &self,
        runtime: &ConfigurationRuntime,
        executable: &str,
        cwd: &Path,
        args: &[&str],
    ) -> ConfigResult<ConfigProcessOutput> {
        let mut env = runtime.environment.clone();
        env.insert("GIT_PAGER".into(), "cat".into());
        env.insert("GIT_TERMINAL_PROMPT".into(), "0".into());
        env.insert("GIT_OPTIONAL_LOCKS".into(), "0".into());
        self.io.run(
            executable,
            &args.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            &env,
            cwd,
        )
    }
    #[cfg(test)]
    pub fn initialize_fixture_repository(&self, path: &Path) -> ConfigResult<()> {
        let runtime = self.io.runtime()?;
        let result = self.git(
            &runtime,
            &runtime.executables[0].path,
            path,
            &["init", "--quiet"],
        )?;
        if result.success {
            Ok(())
        } else {
            Err(problem("Fixture initialization failed"))
        }
    }
    pub fn forget_repository(&self, path: &str) -> ConfigResult<()> {
        let runtime = self.io.runtime()?;
        self.io.save_recent(
            &runtime
                .recent
                .into_iter()
                .filter(|p| p != path)
                .collect::<Vec<_>>(),
        )
    }
    pub fn inspect(&self, context: &ConfigurationContext) -> ConfigResult<ConfigurationInspection> {
        let request = self.inspection_sequence.fetch_add(1, Ordering::SeqCst) + 1;
        let runtime = self.io.runtime()?;
        let executable = match &context.git {
            Some(path) => runtime.executables.iter().find(|x| &x.path == path),
            None => runtime
                .executables
                .iter()
                .find(|x| x.effective)
                .or_else(|| runtime.executables.first()),
        }
        .ok_or_else(|| problem("No discovered Git installation is available"))?
        .path
        .clone();
        let mut documents = vec![];
        let mut git = self.inspect_git(context, &runtime, &executable, &mut documents)?;
        self.mark_loaded_rules(&runtime, &executable, &documents, &mut git)?;
        let ssh = self.inspect_ssh(context, &runtime, &git, &mut documents)?;
        let mut recent = runtime.recent.clone();
        if let Some(path) = &context.repository {
            recent.retain(|p| p != path);
            recent.insert(0, path.clone());
            recent.truncate(20);
            self.io.save_recent(&recent)?;
        }
        let view = ConfigurationInspection {
            id: self.id("inspection"),
            context: context.clone(),
            executables: runtime.executables.clone(),
            recent_repositories: recent
                .into_iter()
                .map(|path| RecentRepository {
                    available: self.io.directory(Path::new(&path)),
                    path,
                })
                .collect(),
            git,
            ssh,
            operation: self.operation()?,
        };
        let mut state = self
            .state
            .lock()
            .map_err(|_| problem("Configuration session unavailable"))?;
        if request != self.inspection_sequence.load(Ordering::SeqCst) {
            return Err(problem("A newer configuration context was selected"));
        }
        if state.context.as_ref() != Some(context) {
            state.plans.clear();
            state.inspections.clear();
            state.context = Some(context.clone());
        }
        if state.inspections.len() >= 20 {
            state.inspections.clear();
        }
        state.inspections.insert(
            view.id.clone(),
            Inspection {
                executable_fingerprint: self.io.fingerprint(Path::new(&view.git.executable))?,
                view: view.clone(),
                runtime,
                documents,
            },
        );
        Ok(view)
    }
    /// Asks Git which rules it loaded here. A temporary wrapper includes copies of every
    /// loaded root in native order; each rule points through its own marker before its target.
    /// Git evaluates conditions in the original repository, without changing live configuration.
    fn mark_loaded_rules(
        &self,
        runtime: &ConfigurationRuntime,
        executable: &str,
        documents: &[Document],
        git: &mut GitInspection,
    ) -> ConfigResult<()> {
        let marked = git
            .rules
            .iter()
            .enumerate()
            .filter_map(|(rule, r)| {
                let doc = documents
                    .iter()
                    .position(|d| !d.ssh && d.source.path == r.source)?;
                Some((rule, doc, r.line))
            })
            .collect::<Vec<_>>();
        if marked.is_empty() {
            return Ok(());
        }
        let first_marker = documents.len() + 1;
        let temp = self.io.temporary(first_marker + marked.len())?;
        let mapping = edits::write_redirected(
            documents,
            &runtime.environment,
            &*temp,
            None,
            |doc, line, target| {
                let Some(k) = marked.iter().position(|&(_, d, l)| d == doc && l == line) else {
                    return Ok(None);
                };
                let marker = format!(
                    "[whichcraftloaded]\nr{k} = true\n[include]\npath = {}\n",
                    quote_git(target)
                );
                temp.write(first_marker + k, marker.as_bytes())?;
                Ok(Some(source_path(&temp.path(first_marker + k))))
            },
        )?;
        // A physical file can be discovered through an inactive include before Git loads it
        // independently at another scope. Root identity comes from native scope evidence,
        // rather than the first ancestry assigned while collecting physical documents.
        let mut root_paths = global_roots(runtime);
        for scope in ["system", "local", "worktree"] {
            if let Some(first) = git.occurrences.iter().find(|o| o.scope == scope) {
                root_paths.push(PathBuf::from(&first.source));
            }
        }
        let mut roots = documents
            .iter()
            .filter(|d| !d.ssh && root_paths.iter().any(|p| p == Path::new(&d.source.path)))
            .filter_map(|d| {
                git.occurrences
                    .iter()
                    .position(|o| {
                        o.scope != "command" && Path::new(&o.source) == Path::new(&d.source.path)
                    })
                    .map(|order| (order, &d.source.path))
            })
            .collect::<Vec<_>>();
        roots.sort_by_key(|(order, _)| *order);
        let mut wrapper = roots
            .iter()
            .map(|(_, path)| format!("[include]\npath = {}\n", quote_git(&mapping[*path])))
            .collect::<String>();
        let cwd = git
            .git_directory
            .as_ref()
            .and(git.repository.as_deref())
            .map(PathBuf::from)
            .unwrap_or_else(|| home(&runtime.environment));
        // --file selects only this file chain. Read command-scope URLs natively before
        // redaction, since the public inspection deliberately hides credential-bearing URLs.
        if git.occurrences.iter().any(|o| o.scope == "command") {
            let remotes = self.git(
                runtime,
                executable,
                &cwd,
                &[
                    "config",
                    "--null",
                    "--show-scope",
                    "--includes",
                    "--get-regexp",
                    r"^remote\..*\.url$",
                ],
            )?;
            let fields = remotes.stdout.split_terminator('\0').collect::<Vec<_>>();
            for entry in fields
                .as_chunks::<2>()
                .0
                .iter()
                .filter(|e| e[0] == "command")
            {
                let Some((key, value)) = entry[1].split_once('\n') else {
                    continue;
                };
                if let Some(name) = key
                    .strip_prefix("remote.")
                    .and_then(|k| k.strip_suffix(".url"))
                {
                    wrapper.push_str(&format!(
                        "[remote {}]\nurl = {}\n",
                        quote_git(name),
                        quote_git(value)
                    ));
                }
            }
        }
        temp.write(documents.len(), wrapper.as_bytes())?;
        let probe = self.git(
            runtime,
            executable,
            &cwd,
            &[
                "config",
                "--file",
                &source_path(&temp.path(documents.len())),
                "--includes",
                "--null",
                "--list",
            ],
        )?;
        if !probe.success {
            return Ok(());
        }
        for (k, &(rule, _, _)) in marked.iter().enumerate() {
            let key = format!("whichcraftloaded.r{k}\ntrue");
            git.rules[rule].active = probe.stdout.split('\0').any(|entry| entry == key);
        }
        Ok(())
    }
    fn read_document(
        &self,
        path: &Path,
        scope: &str,
        parent: Option<String>,
        ssh: bool,
    ) -> ConfigResult<Option<Document>> {
        let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
        if ssh && name.starts_with("id_") && path.extension().is_none() {
            return Ok(None);
        }
        // An Include glob can match a key under any name; its header line says so before any
        // of the key itself is read.
        if ssh
            && self
                .io
                .first_line(path)?
                .is_some_and(|line| is_private_key_header(&line))
        {
            return Ok(None);
        }
        let Some(bytes) = self.io.read(path)? else {
            return Ok(None);
        };
        let valid = std::str::from_utf8(&bytes)
            .ok()
            .filter(|s| !s.contains('\0'));
        let text = valid
            .map(str::to_owned)
            .unwrap_or_else(|| String::from_utf8_lossy(&bytes).into_owned());
        if text
            .lines()
            .take(2)
            .any(|line| line.starts_with("-----BEGIN ") && line.contains("PRIVATE KEY"))
        {
            return Ok(None);
        }
        let syntax = parse_document(&text, ssh);
        let writable = valid.is_some()
            && syntax.editable
            && scope != "system"
            && scope != "worktree"
            && self.io.writable(path);
        let reason = if writable {
            None
        } else {
            Some("Protected source, unsupported encoding or syntax; inspection only".into())
        };
        Ok(Some(Document {
            fingerprint: self.io.fingerprint(path)?,
            source: ConfigSource {
                path: source_path(path),
                scope: scope.into(),
                included_from: parent,
                revision: revision(&bytes),
                content: text,
                writable,
                reason,
            },
            bytes,
            syntax,
            ssh,
        }))
    }
    fn git_documents(
        &self,
        path: &Path,
        scope: &str,
        parent: Option<String>,
        runtime: &ConfigurationRuntime,
        walk: SourceWalk<'_>,
    ) -> ConfigResult<()> {
        let SourceWalk {
            documents,
            seen,
            depth,
        } = walk;
        if depth > 20 || documents.len() > 100 {
            return Err(problem("Configuration include limit reached"));
        }
        let identity = self
            .io
            .canonical(path)
            .map(|p| source_path(&p))
            .unwrap_or_else(|_| source_path(path));
        if !seen.insert(identity.clone()) {
            return Ok(());
        }
        let Some(document) = self.read_document(path, scope, parent, false)? else {
            return Ok(());
        };
        let includes = document
            .syntax
            .directives
            .iter()
            .filter(|d| {
                d.key == "include.path" || (d.section == "includeif" && d.key.ends_with(".path"))
            })
            .map(|d| resolve_path(&d.value, path, &runtime.environment))
            .collect::<Vec<_>>();
        documents.push(document);
        for target in includes {
            self.git_documents(
                &target,
                scope,
                Some(identity.clone()),
                runtime,
                SourceWalk {
                    documents,
                    seen,
                    depth: depth + 1,
                },
            )?;
        }
        Ok(())
    }
    fn inspect_git(
        &self,
        context: &ConfigurationContext,
        runtime: &ConfigurationRuntime,
        executable: &str,
        documents: &mut Vec<Document>,
    ) -> ConfigResult<GitInspection> {
        let fallback = home(&runtime.environment);
        let requested = context.repository.as_deref().map(Path::new);
        let mut cwd = fallback.as_path();
        let mut diagnostics = vec![];
        let mut git_directory = None;
        let mut common_directory = None;
        let mut trust_command = None;
        if let Some(path) = requested {
            if self.io.directory(path) {
                let metadata = self.git(
                    runtime,
                    executable,
                    path,
                    &["rev-parse", "--absolute-git-dir"],
                )?;
                if metadata.success {
                    cwd = path;
                    git_directory = Some(metadata.stdout.trim().to_owned());
                    let common = self.git(
                        runtime,
                        executable,
                        path,
                        &["rev-parse", "--git-common-dir"],
                    )?;
                    if common.success {
                        let p = PathBuf::from(common.stdout.trim());
                        common_directory =
                            Some(source_path(&if p.is_absolute() { p } else { path.join(p) }));
                    }
                } else {
                    diagnostics.push(redact("diagnostic", &metadata.stderr));
                    if metadata.stderr.contains("dubious ownership") {
                        trust_command = Some(format!(
                            "git config --global --add safe.directory {}",
                            quote_git(&source_path(path))
                        ));
                    }
                }
            } else {
                diagnostics.push("Repository folder is unavailable".into());
            }
        }
        let version = self.git(runtime, executable, cwd, &["--version"])?;
        let numbers = version
            .stdout
            .split_whitespace()
            .nth(2)
            .unwrap_or("0.0")
            .split('.')
            .take(2)
            .filter_map(|v| v.parse::<u32>().ok())
            .collect::<Vec<_>>();
        let capability = |minor| {
            numbers.first().copied().unwrap_or(0) > 2
                || (numbers.first() == Some(&2) && numbers.get(1).copied().unwrap_or(0) >= minor)
        };
        let output = if git_directory.is_some() {
            self.git(
                runtime,
                executable,
                cwd,
                &[
                    "--no-pager",
                    "config",
                    "--null",
                    "--list",
                    "--show-origin",
                    "--show-scope",
                    "--includes",
                ],
            )?
        } else {
            let mut combined = ConfigProcessOutput {
                success: true,
                stdout: String::new(),
                stderr: String::new(),
            };
            for scope in ["--system", "--global"] {
                let part = self.git(
                    runtime,
                    executable,
                    cwd,
                    &[
                        "--no-pager",
                        "config",
                        scope,
                        "--null",
                        "--list",
                        "--show-origin",
                        "--show-scope",
                        "--includes",
                    ],
                )?;
                if !part.success
                    && !part.stderr.contains("No such file")
                    && !part.stderr.contains("cannot read config file")
                {
                    combined.success = false;
                    combined.stderr.push_str(&part.stderr);
                }
                combined.stdout.push_str(&part.stdout);
            }
            combined
        };
        if !output.success {
            diagnostics.push(redact("diagnostic", &output.stderr));
        }
        let mut occurrences = vec![];
        let fields = output.stdout.split_terminator('\0').collect::<Vec<_>>();
        for (index, fields) in fields.as_chunks::<3>().0.iter().enumerate() {
            let (key, value) = fields[2].split_once('\n').unwrap_or((fields[2], ""));
            // Git names the local config relative to the folder it ran in (`.git/config`), and
            // Whichcraft's own working folder is somewhere else.
            let origin = fields[1].strip_prefix("file:").unwrap_or(fields[1]);
            let source = if origin.is_empty() || Path::new(origin).is_absolute() {
                origin.to_owned()
            } else {
                source_path(&cwd.join(Path::new(origin).components().collect::<PathBuf>()))
            };
            occurrences.push(ConfigOccurrence {
                id: format!("git:{index}"),
                key: key.into(),
                value: value.into(),
                source,
                scope: fields[0].into(),
                line: None,
                editable: false,
                reason: Some("Inspection only".into()),
            });
        }
        let mut seen = HashSet::new();
        if let Some(system) = env_value(&runtime.environment, "GIT_CONFIG_SYSTEM") {
            self.git_documents(
                Path::new(system),
                "system",
                None,
                runtime,
                SourceWalk {
                    documents,
                    seen: &mut seen,
                    depth: 0,
                },
            )?;
        }
        for path in global_roots(runtime) {
            self.git_documents(
                &path,
                "global",
                None,
                runtime,
                SourceWalk {
                    documents,
                    seen: &mut seen,
                    depth: 0,
                },
            )?;
        }
        for occurrence in &occurrences {
            if occurrence.scope != "command" && !occurrence.source.is_empty() {
                self.git_documents(
                    Path::new(&occurrence.source),
                    &occurrence.scope,
                    None,
                    runtime,
                    SourceWalk {
                        documents,
                        seen: &mut seen,
                        depth: 0,
                    },
                )?;
            }
        }
        let mut used = HashMap::<(String, String), usize>::new();
        for occurrence in &mut occurrences {
            if let Some(doc) = documents
                .iter()
                .find(|d| Path::new(&d.source.path) == Path::new(&occurrence.source))
            {
                // Git uses forward slashes for default Windows config paths. Bind the
                // occurrence to the collected document's spelling for planning and readback.
                occurrence.source = doc.source.path.clone();
                let count = used
                    .entry((occurrence.source.clone(), occurrence.key.clone()))
                    .or_default();
                let directives = doc
                    .syntax
                    .directives
                    .iter()
                    .filter(|d| d.key == occurrence.key)
                    .collect::<Vec<_>>();
                if let Some(directive) = directives.get(*count % directives.len().max(1)) {
                    occurrence.line = Some(directive.line);
                    occurrence.editable = output.success
                        && doc.source.writable
                        && ["user.name", "user.email", "core.sshcommand"]
                            .contains(&occurrence.key.as_str())
                        && directive.value == occurrence.value;
                    if occurrence.editable {
                        occurrence.reason = None;
                    }
                }
                *count += 1;
            }
        }
        let order = &read_order(documents, &runtime.environment);
        let mut rules = documents
            .iter()
            .enumerate()
            .flat_map(|(index, doc)| {
                doc.syntax
                    .directives
                    .iter()
                    .filter(|d| d.section == "includeif" && d.key.ends_with(".path"))
                    .map(|d| {
                        let condition = d.condition.clone().unwrap_or_default();
                        let supported = condition.starts_with("gitdir:")
                            || condition.starts_with("gitdir/i:")
                            || (capability(36) && condition.starts_with("hasconfig:remote.*.url:"));
                        let unambiguous = doc
                            .syntax
                            .directives
                            .iter()
                            .filter(|other| other.condition_span == d.condition_span)
                            .count()
                            == 1;
                        let editable = doc.source.writable
                            && doc.source.scope == "global"
                            && supported
                            && unambiguous;
                        ConditionalInclude {
                            id: format!("rule:{}:{}", doc.source.path, d.line),
                            condition,
                            target: d.value.clone(),
                            source: doc.source.path.clone(),
                            line: d.line,
                            editable,
                            reason: if editable {
                                None
                            } else {
                                Some(
                                    if !supported {
                                        "Condition not supported by this Git/editor"
                                    } else {
                                        "Only supported global rules are editable"
                                    }
                                    .into(),
                                )
                            },
                            active: occurrences.iter().any(|o| {
                                o.source
                                    == source_path(&resolve_path(
                                        &d.value,
                                        Path::new(&doc.source.path),
                                        &runtime.environment,
                                    ))
                            }),
                        }
                    })
                    .map(move |rule| {
                        let position = order.get(&(index, rule.line)).copied();
                        (position.unwrap_or(usize::MAX), rule)
                    })
            })
            .collect::<Vec<_>>();
        rules.sort_by_key(|(position, _)| *position);
        let rules = rules.into_iter().map(|(_, rule)| rule).collect();
        let identity = if output.success {
            CommitIdentity {
                name: occurrences
                    .iter()
                    .rev()
                    .find(|o| o.key == "user.name")
                    .cloned(),
                email: occurrences
                    .iter()
                    .rev()
                    .find(|o| o.key == "user.email")
                    .cloned(),
            }
        } else {
            CommitIdentity::default()
        };
        for key in [
            "GIT_AUTHOR_NAME",
            "GIT_AUTHOR_EMAIL",
            "GIT_COMMITTER_NAME",
            "GIT_COMMITTER_EMAIL",
            "GIT_SSH_COMMAND",
            "GIT_SSH",
        ] {
            if let Some(value) = env_value(&runtime.environment, key) {
                diagnostics.push(format!(
                    "Process override {key}: {}. Terminals and IDEs may use another context.",
                    redact(key, value)
                ));
            }
        }
        let mut result = GitInspection {
            executable: executable.into(),
            version: version.stdout.trim().into(),
            remote_rules: capability(36),
            impact_preview: capability(32),
            repository: context.repository.clone(),
            git_directory,
            common_directory,
            identity,
            occurrences,
            sources: documents.iter().map(|d| d.source.clone()).collect(),
            rules,
            diagnostics,
            trust_command,
        };
        sanitize_git(&mut result);
        Ok(result)
    }
}

pub(crate) use crate::whichcraft::domain::configuration_secrets::redact;
fn sanitize_git(view: &mut GitInspection) {
    for rule in &mut view.rules {
        let condition = redact("include condition", &rule.condition);
        let target = redact("include target", &rule.target);
        if condition != rule.condition || target != rule.target {
            rule.editable = false;
            rule.reason = Some("Sensitive rule; inspection only".into());
        }
        rule.condition = condition;
        rule.target = target;
    }
    for occurrence in &mut view.occurrences {
        let value = redact(&occurrence.key, &occurrence.value);
        if value != occurrence.value {
            occurrence.editable = false;
            occurrence.reason = Some("Sensitive entry; inspection only".into());
        }
        occurrence.value = value;
        occurrence.key = redact("key", &occurrence.key);
        occurrence.source = redact("path", &occurrence.source);
    }
    for source in &mut view.sources {
        source.content = redact_source(&source.content, false);
    }
    for identity in [&mut view.identity.name, &mut view.identity.email]
        .into_iter()
        .flatten()
    {
        if let Some(safe) = view.occurrences.iter().find(|o| o.id == identity.id) {
            *identity = safe.clone();
        }
    }
}
fn redact_source(text: &str, ssh: bool) -> String {
    let syntax = parse_document(text, ssh);
    let mut value = text.to_owned();
    for directive in syntax.directives.iter().rev() {
        if redact(&directive.key, &directive.value) != directive.value
            || redact("key", &directive.key) != directive.key
        {
            value.replace_range(directive.span.clone(), "[redacted]");
        }
    }
    value
        .split_inclusive('\n')
        .map(|line| {
            if redact("source line", line) != line {
                if line.ends_with('\n') {
                    "[redacted]\n".into()
                } else {
                    "[redacted]".into()
                }
            } else {
                line.to_owned()
            }
        })
        .collect()
}
