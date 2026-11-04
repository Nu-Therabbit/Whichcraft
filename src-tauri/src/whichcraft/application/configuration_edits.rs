use super::*;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub(super) struct PendingPlan {
    inspection: Inspection,
    document: usize,
    candidate: Vec<u8>,
    edits: Vec<Patch>,
    impacts: Vec<ConfigurationImpact>,
    coverage: Vec<GitInspection>,
}
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum EditKind {
    Value,
    Condition,
}
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum OperationStatus {
    Pending,
    Applied,
    Undone,
}
impl OperationStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Applied => "applied",
            Self::Undone => "undone",
        }
    }
}
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum OperationAction {
    Apply,
    Undo,
}
#[derive(Clone, Serialize, Deserialize)]
struct Patch {
    before: String,
    after: String,
    left: String,
    right: String,
    selector: Option<EditSelector>,
}
#[derive(Clone, Serialize, Deserialize)]
struct EditSelector {
    kind: EditKind,
    key: String,
    section: String,
    condition: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
struct Operation {
    id: String,
    source: String,
    status: OperationStatus,
    action: OperationAction,
    ssh: bool,
    edits: Vec<Patch>,
    before_revision: String,
    after_revision: String,
    previous: Option<Box<Operation>>,
}
impl Operation {
    fn view(&self, recovery: Option<String>) -> ConfigurationOperationView {
        ConfigurationOperationView {
            id: self.id.clone(),
            source: self.source.clone(),
            status: self.status.as_str().into(),
            recovery,
        }
    }
}
impl ConfigurationApp {
    fn check_inspection(&self, inspection: &Inspection) -> ConfigResult<()> {
        if self
            .io
            .fingerprint(Path::new(&inspection.view.git.executable))?
            != inspection.executable_fingerprint
        {
            return Err(problem("Git executable changed; refresh and review again"));
        }
        let current = self.io.runtime()?;
        if current.environment != inspection.runtime.environment
            || !current
                .executables
                .iter()
                .any(|e| e.path == inspection.view.git.executable)
        {
            return Err(problem(
                "Executable or environment changed; refresh and review again",
            ));
        }
        for document in &inspection.documents {
            if self.io.fingerprint(Path::new(&document.source.path))? != document.fingerprint {
                return Err(problem(
                    "Configuration source was replaced; refresh and review again",
                ));
            }
            if self.io.read(Path::new(&document.source.path))?.as_deref()
                != Some(document.bytes.as_slice())
            {
                return Err(problem(
                    "Configuration dependency changed; refresh and review again",
                ));
            }
        }
        let default = current
            .executables
            .iter()
            .find(|e| e.effective)
            .or_else(|| current.executables.first());
        if inspection.view.context.git.is_none()
            && default.map(|e| &e.path) != Some(&inspection.view.git.executable)
        {
            return Err(problem(
                "Effective Git installation changed; refresh and review again",
            ));
        }
        let mut documents = vec![];
        let mut git = self.inspect_git(
            &inspection.view.context,
            &current,
            &inspection.view.git.executable,
            &mut documents,
        )?;
        self.mark_loaded_rules(
            &current,
            &inspection.view.git.executable,
            &documents,
            &mut git,
        )?;
        let ssh = self.inspect_ssh(&inspection.view.context, &current, &git, &mut documents)?;
        if serde_json::to_value(&git)? != serde_json::to_value(&inspection.view.git)?
            || serde_json::to_value(&ssh)? != serde_json::to_value(&inspection.view.ssh)?
        {
            return Err(problem(
                "Configuration context changed; refresh and review again",
            ));
        }
        Ok(())
    }
    pub fn plan(&self, request: &ConfigurationPlanRequest) -> ConfigResult<ConfigurationPlan> {
        let inspection = self
            .state
            .lock()
            .map_err(|_| problem("Configuration session unavailable"))?
            .inspections
            .get(&request.inspection)
            .cloned()
            .ok_or_else(|| problem("Inspection expired; refresh"))?;
        self.check_inspection(&inspection)?;
        if let ConfigurationIntent::IncludeRule {
            rule,
            source,
            condition,
            target,
        } = &request.intent
        {
            return self.plan_rule(inspection, rule.as_deref(), source, condition, target);
        }
        let (source, line, value, ssh) = match &request.intent {
            ConfigurationIntent::GitValue { occurrence, value } => {
                let o = inspection
                    .view
                    .git
                    .occurrences
                    .iter()
                    .find(|o| &o.id == occurrence && o.editable)
                    .ok_or_else(|| problem("Occurrence is not editable"))?;
                (o.source.clone(), o.line, value.clone(), false)
            }
            ConfigurationIntent::SshIdentity { occurrence, value } => {
                let o = inspection
                    .view
                    .ssh
                    .hosts
                    .iter()
                    .flat_map(|h| h.values.iter())
                    .find(|o| &o.id == occurrence && o.editable && o.key == "identityfile")
                    .ok_or_else(|| problem("IdentityFile is not editable"))?;
                (o.source.clone(), o.line, value.clone(), true)
            }
            ConfigurationIntent::IncludeRule { .. } => unreachable!(),
        };
        if value.contains(['\0', '\r', '\n']) || value.is_empty() {
            return Err(problem("Enter a nonempty single-line value"));
        }
        let document = inspection
            .documents
            .iter()
            .position(|d| d.source.path == source && d.ssh == ssh && d.source.writable)
            .ok_or_else(|| problem("Source is read-only"))?;
        let doc = &inspection.documents[document];
        let directive = doc
            .syntax
            .directives
            .iter()
            .find(|d| Some(d.line) == line)
            .ok_or_else(|| problem("Occurrence no longer exists"))?;
        let replacement = if ssh {
            if value.contains('"') {
                return Err(problem("Unsupported quote in identity path"));
            }
            format!("\"{value}\"")
        } else {
            quote_git(&value)
        };
        let text = std::str::from_utf8(&doc.bytes).map_err(|_| problem("Unsupported encoding"))?;
        let mut candidate = text.to_owned();
        candidate.replace_range(directive.span.clone(), &replacement);
        let edits = vec![span_patch(text, directive.span.clone(), &replacement, ssh)];
        if candidate == text {
            return Err(problem("No configuration change to preview"));
        }
        if !ssh {
            self.validate_git(&inspection, candidate.as_bytes())?;
        } else if !parse_document(&candidate, true).editable {
            return Err(problem("Identity path produces unsupported SSH syntax"));
        }
        let mut coverage = vec![];
        let impacts = if ssh {
            vec![]
        } else {
            self.impact(
                &inspection,
                document,
                candidate.as_bytes(),
                None,
                &mut coverage,
            )?
        };
        let view=ConfigurationPlan {id:self.id("plan"),source,scope:doc.source.scope.clone(),before:redact_source(text,ssh),after:redact_source(&candidate,ssh),impacts,warnings:vec!["Only the current and recent repositories are covered. Other repositories may be affected.".into()]};
        let mut state = self
            .state
            .lock()
            .map_err(|_| problem("Configuration session unavailable"))?;
        if state.plans.len() >= 20 {
            state.plans.clear();
        }
        state.plans.insert(
            view.id.clone(),
            PendingPlan {
                impacts: view.impacts.clone(),
                coverage,
                inspection,
                document,
                candidate: candidate.into_bytes(),
                edits,
            },
        );
        Ok(view)
    }
    /// Whether `target` or any file it includes sets `remote.<name>.url`. Every include is
    /// followed whatever its condition, since a nested rule that matches only in some repositories
    /// is still read there, and Git reads each file itself so any syntax it accepts is covered.
    fn chain_sets_remote_url(
        &self,
        runtime: &ConfigurationRuntime,
        executable: &str,
        target: &Path,
    ) -> ConfigResult<bool> {
        let cwd = home(&runtime.environment);
        let mut pending = vec![target.to_path_buf()];
        let mut seen = HashSet::new();
        while let Some(file) = pending.pop() {
            let identity = self
                .io
                .canonical(&file)
                .map(|p| source_path(&p))
                .unwrap_or_else(|_| source_path(&file));
            if !seen.insert(identity) {
                continue;
            }
            if seen.len() > 100 {
                return Err(problem("Configuration include limit reached"));
            }
            // Git skips an include whose file is missing.
            if !self.io.exists(&file) || self.io.directory(&file) {
                continue;
            }
            let output = self.git(
                runtime,
                executable,
                &cwd,
                &["config", "--file", &source_path(&file), "--null", "--list"],
            )?;
            if !output.success {
                return Err(problem("Include target or its include chain is invalid"));
            }
            for entry in output.stdout.split('\0').filter(|e| !e.is_empty()) {
                let (key, value) = entry.split_once('\n').unwrap_or((entry, ""));
                let key = key.to_ascii_lowercase();
                // Any subsection counts, an empty one too (`[remote ""]` is `remote..url`);
                // only a bare `remote.url` has none.
                let remote = key
                    .strip_prefix("remote.")
                    .and_then(|k| k.strip_suffix(".url"))
                    .is_some();
                if remote {
                    return Ok(true);
                }
                if key == "include.path" || key.starts_with("includeif.") && key.ends_with(".path")
                {
                    pending.push(resolve_path(value, &file, &runtime.environment));
                }
            }
        }
        Ok(false)
    }
    fn plan_rule(
        &self,
        mut inspection: Inspection,
        rule_id: Option<&str>,
        source: &str,
        condition: &str,
        target: &str,
    ) -> ConfigResult<ConfigurationPlan> {
        if condition.contains(['\n', '\r', '\0'])
            || target.is_empty()
            || target.contains(['\n', '\r', '\0'])
        {
            return Err(problem("Enter a condition and an existing include file"));
        }
        let supported = condition
            .strip_prefix("gitdir:")
            .or_else(|| condition.strip_prefix("gitdir/i:"))
            .filter(|p| !p.is_empty())
            .is_some()
            || inspection.view.git.remote_rules
                && condition
                    .strip_prefix("hasconfig:remote.*.url:")
                    .is_some_and(|p| !p.is_empty());
        if !supported {
            return Err(problem("Unsupported condition for the selected Git"));
        }
        let document = inspection
            .documents
            .iter()
            .position(|d| {
                d.source.path == source && d.source.scope == "global" && d.source.writable && !d.ssh
            })
            .ok_or_else(|| problem("Choose a writable global source"))?;
        let target_path = resolve_path(target, Path::new(source), &inspection.runtime.environment);
        if !self.io.exists(&target_path) || self.io.directory(&target_path) {
            return Err(problem(
                "Include target must be an existing configuration file",
            ));
        }
        let target_validation = self.git(
            &inspection.runtime,
            &inspection.view.git.executable,
            &home(&inspection.runtime.environment),
            &[
                "config",
                "--file",
                &source_path(&target_path),
                "--includes",
                "--list",
            ],
        )?;
        if !target_validation.success {
            return Err(problem("Include target or its include chain is invalid"));
        }
        // Git refuses a hasconfig:remote.*.url include whose files set remote URLs (directly or
        // through their own includes), so such a rule would break every repository it reaches.
        if condition.starts_with("hasconfig:remote.")
            && self.chain_sets_remote_url(
                &inspection.runtime,
                &inspection.view.git.executable,
                &target_path,
            )?
        {
            return Err(problem(
                "A remote-URL rule's include file must not set a remote URL, directly or through its includes",
            ));
        }
        let mut seen = inspection
            .documents
            .iter()
            .map(|d| {
                self.io
                    .canonical(Path::new(&d.source.path))
                    .map(|p| source_path(&p))
                    .unwrap_or_else(|_| d.source.path.clone())
            })
            .collect::<HashSet<_>>();
        self.git_documents(
            &target_path,
            "global",
            Some(source.into()),
            &inspection.runtime,
            SourceWalk {
                documents: &mut inspection.documents,
                seen: &mut seen,
                depth: 0,
            },
        )?;
        let doc = &inspection.documents[document];
        let text = std::str::from_utf8(&doc.bytes).map_err(|_| problem("Unsupported encoding"))?;
        let mut candidate = text.to_owned();
        let line;
        let mut edits = vec![];
        let mut warnings = vec![
            "Only current and recent repositories are covered. Other repositories may be affected."
                .into(),
        ];
        if let Some(rule_id) = rule_id {
            let rule = inspection
                .view
                .git
                .rules
                .iter()
                .find(|r| r.id == rule_id && r.source == source && r.editable)
                .ok_or_else(|| problem("Rule is no longer editable; refresh"))?;
            let d = doc
                .syntax
                .directives
                .iter()
                .find(|d| d.line == rule.line)
                .ok_or_else(|| problem("Rule occurrence not found"))?;
            let span = d
                .condition_span
                .clone()
                .ok_or_else(|| problem("Complex rule cannot be edited"))?;
            edits.push(span_patch(text, d.span.clone(), &quote_git(target), false));
            edits.push(span_patch(text, span.clone(), &quote_git(condition), false));
            for edit in &mut edits {
                if let Some(selector) = &mut edit.selector {
                    selector.condition = Some(condition.into());
                }
            }
            candidate.replace_range(d.span.clone(), &quote_git(target));
            candidate.replace_range(span, &quote_git(condition));
            line = d.line;
            if condition.starts_with("gitdir") && !condition.ends_with('/') {
                warnings.push(
                    "This folder pattern has no trailing slash; it will be preserved exactly."
                        .into(),
                );
            }
        } else {
            let newline = if text.contains("\r\n") { "\r\n" } else { "\n" };
            if !candidate.is_empty() && !candidate.ends_with('\n') {
                candidate.push_str(newline);
            }
            line = candidate.lines().count() + 2;
            candidate.push_str(&format!(
                "[includeIf {}]{newline}\tpath = {}{newline}",
                quote_git(condition),
                quote_git(target)
            ));
            warnings.push(
                "The new rule is appended. Later settings and local overrides can still win."
                    .into(),
            );
        }
        if candidate == text {
            return Err(problem("No configuration change to preview"));
        }
        edits.retain(|edit| edit.before != edit.after);
        self.validate_git(&inspection, candidate.as_bytes())?;
        let mut coverage = vec![];
        let impacts = self.impact(
            &inspection,
            document,
            candidate.as_bytes(),
            Some(line),
            &mut coverage,
        )?;
        if impacts
            .iter()
            .any(|impact| impact.reason.as_deref() == Some("Candidate configuration is invalid"))
        {
            return Err(problem(
                "Include target or condition is invalid; nothing was written",
            ));
        }
        let view = ConfigurationPlan {
            id: self.id("plan"),
            source: source.into(),
            scope: "global".into(),
            before: redact_source(text, false),
            after: redact_source(&candidate, false),
            impacts,
            warnings,
        };
        if edits.is_empty() {
            edits.push(Patch {
                before: String::new(),
                after: candidate[text.len()..].into(),
                left: String::new(),
                right: String::new(),
                selector: None,
            });
        }
        self.state
            .lock()
            .map_err(|_| problem("Configuration session unavailable"))?
            .plans
            .insert(
                view.id.clone(),
                PendingPlan {
                    impacts: view.impacts.clone(),
                    coverage,
                    inspection,
                    document,
                    candidate: candidate.into_bytes(),
                    edits,
                },
            );
        Ok(view)
    }
    fn validate_git(&self, inspection: &Inspection, candidate: &[u8]) -> ConfigResult<()> {
        let temp = self.io.temporary(1)?;
        temp.write(0, candidate)?;
        let path = source_path(&temp.path(0));
        let result = self.git(
            &inspection.runtime,
            &inspection.view.git.executable,
            &home(&inspection.runtime.environment),
            &["config", "--file", &path, "--no-includes", "--list"],
        )?;
        if result.success {
            Ok(())
        } else {
            Err(problem(
                "Candidate configuration is invalid; nothing was written",
            ))
        }
    }
    fn impact(
        &self,
        inspection: &Inspection,
        changed: usize,
        candidate: &[u8],
        rule_line: Option<usize>,
        coverage: &mut Vec<GitInspection>,
    ) -> ConfigResult<Vec<ConfigurationImpact>> {
        let mut repos = inspection
            .view
            .recent_repositories
            .iter()
            .map(|r| r.path.clone())
            .collect::<Vec<_>>();
        if let Some(repo) = &inspection.view.context.repository {
            if !repos.contains(repo) {
                repos.insert(0, repo.clone());
            }
        }
        let source = &inspection.documents[changed].source;
        let unresolved = if source.scope != "global" {
            Some(
                "Native impact preview is available only for global and globally included files"
                    .to_owned(),
            )
        } else if !inspection.view.git.impact_preview {
            Some("This Git lacks GIT_CONFIG_GLOBAL (requires Git 2.32)".into())
        } else {
            None
        };
        let temp = self.io.temporary(inspection.documents.len() + 2)?;
        let marker_slot = inspection.documents.len() + 1;
        let mapping = write_redirected(
            &inspection.documents,
            &inspection.runtime.environment,
            &*temp,
            Some((changed, candidate)),
            |doc, line, target| {
                if doc != changed || Some(line) != rule_line {
                    return Ok(None);
                }
                let marker = format!(
                    "[include]\npath = {}\n[whichcraftpreview]\nmatched = true\n",
                    quote_git(target)
                );
                temp.write(marker_slot, marker.as_bytes())?;
                Ok(Some(source_path(&temp.path(marker_slot))))
            },
        )?;
        let runtime = redirected_global(
            &inspection.runtime,
            &mapping,
            &*temp,
            inspection.documents.len(),
        )?;
        let mut result = vec![];
        for repository in repos {
            let mut context = inspection.view.context.clone();
            context.repository = Some(repository.clone());
            let before = self.inspect_git(
                &context,
                &inspection.runtime,
                &inspection.view.git.executable,
                &mut vec![],
            )?;
            coverage.push(before.clone());
            let shared_local = before
                .occurrences
                .iter()
                .any(|o| o.scope == "local" || o.scope == "worktree")
                && before
                    .occurrences
                    .iter()
                    .filter(|o| o.scope == "local" || o.scope == "worktree")
                    .any(|o| {
                        self.io.canonical(Path::new(&o.source)).ok()
                            == self.io.canonical(Path::new(&source.path)).ok()
                    });
            let after = self.inspect_git(
                &context,
                &runtime,
                &inspection.view.git.executable,
                &mut vec![],
            )?;
            let matched = rule_line.map(|_| {
                after
                    .occurrences
                    .iter()
                    .any(|o| o.key == "whichcraftpreview.matched")
            });
            let reason = unresolved.clone().or_else(|| {
                if shared_local {Some("The edited source is also loaded through repository-local configuration; native temporary preview cannot safely rebind that chain".into())}
                else if before.git_directory.is_none() || after.git_directory.is_none() {
                    Some("Repository/configuration could not be fully evaluated".into())
                } else if after
                    .diagnostics
                    .iter()
                    .any(|d| d.starts_with("fatal:") || d.starts_with("error:"))
                {
                    Some("Candidate configuration is invalid".into())
                } else {
                    None
                }
            });
            let mut identity = after.identity;
            for o in [&mut identity.name, &mut identity.email]
                .into_iter()
                .flatten()
            {
                if let Some((original, _)) = mapping.iter().find(|(_, copy)| **copy == o.source) {
                    o.source = original.clone();
                }
            }
            result.push(ConfigurationImpact {
                repository,
                status: if reason.is_some() {
                    "unresolved"
                } else {
                    "verified"
                }
                .into(),
                reason,
                before: before.identity,
                after: identity,
                matched,
            });
        }
        Ok(result)
    }
    pub fn apply(&self, id: &str) -> ConfigResult<ConfigurationWriteResult> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| problem("Configuration session unavailable"))?;
        let plan = state
            .plans
            .remove(id)
            .ok_or_else(|| problem("Plan expired or already applied; refresh and review again"))?;
        self.check_inspection(&plan.inspection)?;
        for before in &plan.coverage {
            let mut context = plan.inspection.view.context.clone();
            context.repository = before.repository.clone();
            let current = self.inspect_git(
                &context,
                &plan.inspection.runtime,
                &plan.inspection.view.git.executable,
                &mut vec![],
            )?;
            if serde_json::to_value(before)? != serde_json::to_value(current)? {
                return Err(problem(
                    "An impact-preview repository changed; refresh and review again",
                ));
            }
        }
        if self.operation()?.is_some_and(|op| op.status == "pending") {
            return Err(problem(
                "Resolve the interrupted configuration operation before another write",
            ));
        }
        let doc = &plan.inspection.documents[plan.document];
        let journal_before = self.io.load_operation()?;
        let mut previous = journal_before
            .as_deref()
            .map(serde_json::from_slice::<Operation>)
            .transpose()?
            .filter(|op| op.status == OperationStatus::Applied);
        if let Some(op) = &mut previous {
            op.previous = None;
        }
        let mut operation = Operation {
            id: self.io.operation_id(),
            source: doc.source.path.clone(),
            status: OperationStatus::Pending,
            action: OperationAction::Apply,
            ssh: doc.ssh,
            edits: plan.edits.clone(),
            before_revision: revision(&doc.bytes),
            after_revision: revision(&plan.candidate),
            previous: previous.map(Box::new),
        };
        self.io.save_operation(&serde_json::to_vec(&operation)?)?;
        let publication =
            self.io
                .publish(Path::new(&operation.source), &doc.bytes, &plan.candidate);
        if let Err(error) = publication {
            if self.unchanged(&operation.source, &doc.bytes) {
                // Nothing was written: the journal goes back to what it held, so no recovery is
                // offered and an earlier edit stays undoable.
                operation.status = OperationStatus::Undone;
                let journal = match &journal_before {
                    Some(bytes) => bytes.clone(),
                    None => serde_json::to_vec(&operation)?,
                };
                self.io.save_operation(&journal)?;
                return Ok(Self::failed(&error));
            }
            return Ok(ConfigurationWriteResult {
                status: "uncertain".into(),
                readback: "unverified".into(),
                message: Some(redact("diagnostic", &error.to_string())),
                operation: Some(self.reported_operation(&operation)),
            });
        }
        let readback = self.io.read(Path::new(&operation.source));
        let verified = readback
            .as_ref()
            .is_ok_and(|v| v.as_deref() == Some(plan.candidate.as_slice()))
            && self.verify_effective_readback(&plan).unwrap_or(false);
        operation.status = if verified {
            OperationStatus::Applied
        } else {
            OperationStatus::Pending
        };
        if verified {
            operation.previous = None;
        }
        let recorded = self
            .io
            .save_operation(&serde_json::to_vec(&operation)?)
            .is_ok();
        let verified = verified && recorded;
        if !recorded {
            operation.status = OperationStatus::Pending;
        }
        state.inspections.clear();
        state.plans.clear();
        Ok(ConfigurationWriteResult {
            status: "written".into(),
            readback: if verified { "verified" } else { "unverified" }.into(),
            message: if verified {
                None
            } else {
                Some("File was written; readback is uncertain. Refresh to inspect.".into())
            },
            operation: Some(if verified {
                operation.view(None)
            } else {
                self.reported_operation(&operation)
            }),
        })
    }
    /// Whether `source` still holds exactly `before`, so a failed publication wrote nothing.
    fn unchanged(&self, source: &str, before: &[u8]) -> bool {
        self.io
            .read(Path::new(source))
            .is_ok_and(|bytes| bytes.as_deref() == Some(before))
    }
    fn failed(error: &WhichcraftError) -> ConfigurationWriteResult {
        ConfigurationWriteResult {
            status: "failed".into(),
            readback: "unchanged".into(),
            message: Some(redact("diagnostic", &error.to_string())),
            operation: None,
        }
    }
    fn reported_operation(&self, operation: &Operation) -> ConfigurationOperationView {
        self.operation()
            .ok()
            .flatten()
            .unwrap_or_else(|| operation.view(Some("unexpected".into())))
    }
    fn verify_effective_readback(&self, plan: &PendingPlan) -> ConfigResult<bool> {
        let runtime = self.io.runtime()?;
        if runtime.environment != plan.inspection.runtime.environment {
            return Ok(false);
        }
        let mut contexts = plan
            .impacts
            .iter()
            .filter(|impact| impact.status == "verified")
            .map(|impact| (Some(impact.repository.clone()), Some(&impact.after)))
            .collect::<Vec<_>>();
        if contexts.is_empty() {
            contexts.push((plan.inspection.view.context.repository.clone(), None));
        }
        for (repository, expected) in contexts {
            let mut context = plan.inspection.view.context.clone();
            context.repository = repository;
            let mut documents = vec![];
            let git = self.inspect_git(
                &context,
                &runtime,
                &plan.inspection.view.git.executable,
                &mut documents,
            )?;
            if git
                .diagnostics
                .iter()
                .any(|d| d.starts_with("fatal:") || d.starts_with("error:"))
            {
                return Ok(false);
            }
            self.inspect_ssh(&context, &runtime, &git, &mut documents)?;
            if let Some(expected) = expected {
                for (actual, expected) in [
                    (&git.identity.name, &expected.name),
                    (&git.identity.email, &expected.email),
                ] {
                    if actual.as_ref().map(|o| (&o.value, &o.source))
                        != expected.as_ref().map(|o| (&o.value, &o.source))
                    {
                        return Ok(false);
                    }
                }
            }
        }
        Ok(true)
    }
    pub fn operation(&self) -> ConfigResult<Option<ConfigurationOperationView>> {
        let Some(bytes) = self.io.load_operation()? else {
            return Ok(None);
        };
        let op: Operation = serde_json::from_slice(&bytes)?;
        if op.status == OperationStatus::Undone {
            return Ok(None);
        }
        let recovery = if op.status == OperationStatus::Pending {
            Some(
                match self.io.read(Path::new(&op.source))? {
                    Some(bytes) if revision(&bytes) == op.before_revision => "before",
                    Some(bytes) if revision(&bytes) == op.after_revision => "after",
                    _ => "unexpected",
                }
                .into(),
            )
        } else {
            None
        };
        Ok(Some(op.view(recovery)))
    }
    pub fn acknowledge_recovery(&self, id: &str) -> ConfigResult<()> {
        let _guard = self
            .state
            .lock()
            .map_err(|_| problem("Configuration session unavailable"))?;
        let bytes = self
            .io
            .load_operation()?
            .ok_or_else(|| problem("No configuration operation"))?;
        let mut op: Operation = serde_json::from_slice(&bytes)?;
        if op.id != id || op.status != OperationStatus::Pending {
            return Err(problem("Recovery changed; refresh"));
        }
        let current = self
            .io
            .read(Path::new(&op.source))?
            .ok_or_else(|| problem("Source unavailable"))?;
        if revision(&current) == op.before_revision && op.action == OperationAction::Apply {
            if let Some(previous) = op.previous.take() {
                return self.io.save_operation(&serde_json::to_vec(&previous)?);
            }
        }
        op.status = if revision(&current) == op.after_revision {
            if op.action == OperationAction::Undo {
                OperationStatus::Undone
            } else {
                OperationStatus::Applied
            }
        } else if revision(&current) == op.before_revision {
            if op.action == OperationAction::Undo {
                OperationStatus::Applied
            } else {
                OperationStatus::Undone
            }
        } else {
            return Err(problem(
                "Unexpected file content; manual inspection required",
            ));
        };
        op.previous = None;
        self.io.save_operation(&serde_json::to_vec(&op)?)
    }
    pub fn undo(&self, id: &str) -> ConfigResult<ConfigurationWriteResult> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| problem("Configuration session unavailable"))?;
        let bytes = self
            .io
            .load_operation()?
            .ok_or_else(|| problem("No configuration operation to undo"))?;
        let mut op: Operation = serde_json::from_slice(&bytes)?;
        if op.id != id || op.status != OperationStatus::Applied {
            return Err(problem(
                "Only the latest verified configuration operation can be undone",
            ));
        }
        let current = self
            .io
            .read(Path::new(&op.source))?
            .ok_or_else(|| problem("Source unavailable"))?;
        let text =
            std::str::from_utf8(&current).map_err(|_| problem("Unsupported source encoding"))?;
        let mut reversals = vec![];
        let syntax = parse_document(text, op.ssh);
        for edit in &op.edits {
            let needle = format!("{}{}{}", edit.left, edit.after, edit.right);
            let positions = text
                .match_indices(&needle)
                .filter(|(p, _)| {
                    *p == 0 || needle.starts_with('\n') || text.as_bytes()[p - 1] == b'\n'
                })
                .map(|(p, _)| p + edit.left.len())
                .filter(|position| {
                    edit.selector.as_ref().is_none_or(|selector| {
                        syntax.directives.iter().any(|d| {
                            let span = if selector.kind == EditKind::Condition {
                                d.condition_span.as_ref()
                            } else {
                                Some(&d.span)
                            };
                            d.section == selector.section
                                && d.condition == selector.condition
                                && d.key.rsplit('.').next() == Some(selector.key.as_str())
                                && span.is_some_and(|span| {
                                    span.start == *position
                                        && span.end == position + edit.after.len()
                                })
                        })
                    })
                })
                .collect::<Vec<_>>();
            if positions.len() != 1 {
                return Err(problem(
                    "Undo conflict: the edited occurrence changed or is ambiguous",
                ));
            }
            reversals.push((
                positions[0]..positions[0] + edit.after.len(),
                edit.before.clone(),
            ));
        }
        reversals.sort_by_key(|(span, _)| std::cmp::Reverse(span.start));
        let mut restored = text.to_owned();
        for (span, before) in reversals {
            restored.replace_range(span, &before);
        }
        op.action = OperationAction::Undo;
        op.status = OperationStatus::Pending;
        op.before_revision = revision(&current);
        op.after_revision = revision(restored.as_bytes());
        self.io.save_operation(&serde_json::to_vec(&op)?)?;
        if let Err(error) = self
            .io
            .publish(Path::new(&op.source), &current, restored.as_bytes())
        {
            if self.unchanged(&op.source, &current) {
                // Nothing was restored: the applied edit stays on record and can be undone again.
                self.io.save_operation(&bytes)?;
                return Ok(Self::failed(&error));
            }
            return Ok(ConfigurationWriteResult {
                status: "uncertain".into(),
                readback: "unverified".into(),
                message: Some(redact("diagnostic", &error.to_string())),
                operation: Some(self.reported_operation(&op)),
            });
        }
        let verified = self
            .io
            .read(Path::new(&op.source))
            .is_ok_and(|bytes| bytes.as_deref() == Some(restored.as_bytes()));
        op.status = if verified {
            OperationStatus::Undone
        } else {
            OperationStatus::Pending
        };
        let recorded = self.io.save_operation(&serde_json::to_vec(&op)?).is_ok();
        let verified = verified && recorded;
        if !recorded {
            op.status = OperationStatus::Pending;
        }
        state.inspections.clear();
        state.plans.clear();
        Ok(ConfigurationWriteResult {
            status: if verified { "restored" } else { "uncertain" }.into(),
            readback: if verified { "verified" } else { "unverified" }.into(),
            message: None,
            operation: if verified {
                None
            } else {
                Some(self.reported_operation(&op))
            },
        })
    }
}
/// Writes each Git document to `temp` (slot = its index) with every include pointed at its
/// target's copy and relative `gitdir:./` conditions anchored at the original file, so Git reads
/// the copies as it would the originals. `marker(document, line, copied target)` may name another
/// file to include instead. Returns original path to copy path.
pub(super) fn write_redirected(
    documents: &[Document],
    env: &HashMap<String, String>,
    temp: &dyn ConfigurationTemporary,
    replaced: Option<(usize, &[u8])>,
    mut marker: impl FnMut(usize, usize, &str) -> ConfigResult<Option<String>>,
) -> ConfigResult<HashMap<String, String>> {
    let mapping = documents
        .iter()
        .enumerate()
        .map(|(i, d)| (d.source.path.clone(), source_path(&temp.path(i))))
        .collect::<HashMap<_, _>>();
    for (index, doc) in documents.iter().enumerate().filter(|(_, d)| !d.ssh) {
        let bytes = match replaced {
            Some((changed, candidate)) if changed == index => candidate,
            _ => &doc.bytes,
        };
        let Ok(text) = std::str::from_utf8(bytes) else {
            continue;
        };
        let syntax = parse_document(text, false);
        let mut text = text.to_owned();
        let mut substitutions = vec![];
        for d in syntax.directives {
            if d.key == "include.path" || d.section == "includeif" && d.key.ends_with(".path") {
                let original =
                    source_path(&resolve_path(&d.value, Path::new(&doc.source.path), env));
                let target = mapping.get(&original).unwrap_or(&original);
                let path = marker(index, d.line, target)?.unwrap_or_else(|| target.clone());
                substitutions.push((d.span.clone(), quote_git(&path)));
                if let (Some(condition), Some(span)) = (&d.condition, &d.condition_span) {
                    for prefix in ["gitdir:", "gitdir/i:"] {
                        if let Some(tail) = condition
                            .strip_prefix(prefix)
                            .and_then(|s| s.strip_prefix("./"))
                        {
                            substitutions.push((
                                span.clone(),
                                quote_git(&format!(
                                    "{prefix}{}",
                                    source_path(
                                        &Path::new(&doc.source.path).parent().unwrap().join(tail)
                                    )
                                    .replace('\\', "/")
                                )),
                            ));
                        }
                    }
                }
            }
        }
        substitutions.sort_by_key(|(s, _)| std::cmp::Reverse(s.start));
        substitutions.dedup_by(|a, b| a.0 == b.0);
        for (span, value) in substitutions {
            text.replace_range(span, &value);
        }
        temp.write(index, text.as_bytes())?;
    }
    Ok(mapping)
}

/// `runtime` with `GIT_CONFIG_GLOBAL` pointed at a file in `slot` that includes the copies of the
/// global roots, so Git reads the redirected copies instead of the user's files.
pub(super) fn redirected_global(
    runtime: &ConfigurationRuntime,
    mapping: &HashMap<String, String>,
    temp: &dyn ConfigurationTemporary,
    slot: usize,
) -> ConfigResult<ConfigurationRuntime> {
    let wrapper = global_roots(runtime)
        .iter()
        .map(|p| source_path(p))
        .filter_map(|p| mapping.get(&p))
        .map(|copy| format!("[include]\npath = {}\n", quote_git(copy)))
        .collect::<String>();
    temp.write(slot, wrapper.as_bytes())?;
    let mut runtime = runtime.clone();
    runtime
        .environment
        .retain(|k, _| !k.eq_ignore_ascii_case("GIT_CONFIG_GLOBAL"));
    runtime
        .environment
        .insert("GIT_CONFIG_GLOBAL".into(), source_path(&temp.path(slot)));
    Ok(runtime)
}
fn span_patch(text: &str, span: std::ops::Range<usize>, replacement: &str, ssh: bool) -> Patch {
    let selector = parse_document(text, ssh).directives.iter().find_map(|d| {
        let kind = if d.span == span {
            EditKind::Value
        } else if d.condition_span.as_ref() == Some(&span) {
            EditKind::Condition
        } else {
            return None;
        };
        Some(EditSelector {
            kind,
            key: d.key.rsplit('.').next().unwrap_or(&d.key).into(),
            section: d.section.clone(),
            condition: d.condition.clone(),
        })
    });
    let line_start = text[..span.start].rfind('\n').map(|p| p + 1).unwrap_or(0);
    let line_end = text[span.end..]
        .find('\n')
        .map(|p| span.end + p)
        .unwrap_or(text.len());
    let right = text[span.end..line_end]
        .split(['#', ';'])
        .next()
        .unwrap_or("")
        .to_owned();
    Patch {
        selector,
        before: text[span.clone()].into(),
        after: replacement.into(),
        left: text[line_start..span.start].into(),
        right,
    }
}
