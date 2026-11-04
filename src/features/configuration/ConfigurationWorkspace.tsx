import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { TextInput } from "../../components/ui/TextInput";
import { useI18n } from "../../hooks/useI18n";
import { shellNavigationHref } from "../../lib/shellNavigation";
import type { ConfigOccurrence, ConfigurationIntent, ConfigSource } from "./api";
import { useConfiguration } from "./useConfiguration";
import "./configuration.css";

function preferredGlobalSource(sources: ConfigSource[]): string {
  const roots = sources.filter((s) => s.scope === "global" && s.writable && !s.includedFrom);
  return roots.find((s) => /[/\\]\.gitconfig$/.test(s.path))?.path ?? roots[0]?.path ?? "";
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="shell-panel p-4 min-w-0">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function SourceFiles({ sources }: { sources: ConfigSource[] }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      {sources.map((source) => (
        <details key={source.path} className="shell-panel p-3 min-w-0">
          <summary className="cursor-pointer wrap-anywhere">
            <span className="text-xs text-muted mr-2">{source.scope}</span>
            {source.path}
          </summary>
          {source.includedFrom && (
            <p className="text-xs text-muted mt-2 wrap-anywhere">
              {t("configuration.included_from", { source: source.includedFrom })}
            </p>
          )}
          {source.reason && <p className="text-xs text-muted">{source.reason}</p>}
          <pre className="config-source mt-3">{source.content}</pre>
        </details>
      ))}
    </div>
  );
}
function Occurrence({
  occurrence,
  kind,
}: {
  occurrence: ConfigOccurrence | null;
  kind?: "gitValue" | "sshIdentity";
}) {
  const { t } = useI18n();
  const { dispatch, state } = useConfiguration();
  if (!occurrence) return <p className="text-muted">{t("configuration.unset")}</p>;
  return (
    <div className="flex items-start gap-3 py-2 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted font-mono">{occurrence.key}</p>
        <p className="font-medium wrap-anywhere" translate="no">
          {occurrence.value ||
            t(
              occurrence.key === "credential.helper"
                ? "configuration.helper_reset"
                : "configuration.empty",
            )}
        </p>
        <p className="text-xs text-muted wrap-anywhere">
          {occurrence.source}
          {occurrence.line ? `:${occurrence.line}` : ""} · {occurrence.scope}
        </p>
        {occurrence.reason && <p className="text-xs text-muted">{occurrence.reason}</p>}
      </div>
      {kind && occurrence.editable && (
        <Button
          variant="secondary"
          size="xs"
          disabled={state.writing}
          aria-label={t("configuration.edit_key", { key: occurrence.key })}
          onClick={() =>
            dispatch({
              type: "edit",
              draft: { kind, occurrence: occurrence.id, value: occurrence.value },
            })
          }
        >
          {t("configuration.edit")}
        </Button>
      )}
    </div>
  );
}
export function ConfigurationOperationBanner() {
  const { state, dispatch } = useConfiguration();
  const { t } = useI18n();
  const op = state.operation;
  if (!op?.recovery) return null;
  return (
    <div className="shell-banner text-warn" role="alert">
      <div className="min-w-0 flex-1">
        <p>{t("configuration.recovery_heading")}</p>
        <p className="text-sm wrap-anywhere">
          {op.source} · {op.recovery}
        </p>
        <p className="text-sm">{t("configuration.recovery_help")}</p>
      </div>
      {op.recovery !== "unexpected" && (
        <Button disabled={state.writing} onClick={() => dispatch({ type: "acknowledgeRecovery" })}>
          {t("configuration.acknowledge")}
        </Button>
      )}
    </div>
  );
}

export function ConfigurationWorkspace({
  page,
  onNavigate,
}: {
  page: "git-config" | "ssh";
  onNavigate?: (page: "git-config" | "ssh") => void;
}) {
  const { t } = useI18n();
  const { state, dispatch } = useConfiguration();
  const draftBelongsToPage =
    state.draft?.kind === "sshIdentity" ? page === "ssh" : page === "git-config";
  const draft = draftBelongsToPage ? state.draft : null;
  const editor = useRef<HTMLFormElement>(null);
  const draftTarget = draft
    ? draft.kind === "includeRule"
      ? `rule:${draft.rule ?? "new"}`
      : draft.occurrence
    : null;
  useEffect(() => {
    if (draftTarget && !state.plan)
      editor.current?.querySelector<HTMLElement>("input,select")?.focus();
  }, [draftTarget, state.plan]);
  useEffect(() => dispatch({ type: "activate" }), [dispatch]);
  const view = state.view;
  const ssh = page === "ssh";
  const tab = ssh ? state.sshTab : state.gitTab;
  const tabs = ssh ? ["hosts", "keys", "files"] : ["identity", "rules", "behavior", "all"];
  const host = view?.ssh.hosts.find((h) => h.name === state.host) ?? view?.ssh.hosts[0];
  const updateDraft = (patch: Partial<ConfigurationIntent>) => {
    if (draft)
      dispatch({ type: "edit", draft: { ...draft, ...patch } as ConfigurationIntent });
  };
  return (
    <div
      className="shell-scroll flex flex-col gap-4 config-workspace"
      aria-busy={state.loading || state.writing}
    >
      <p className="text-sm text-muted">
        {t(ssh ? "configuration.ssh_intro" : "configuration.git_intro")}
      </p>
      <div className="shell-panel p-3 flex flex-wrap items-end gap-3">
        <label className="min-w-44 flex-1 text-xs text-muted">
          {t("configuration.repository")}
          <select
            aria-label={t("configuration.repository")}
            className="config-select mt-1"
            value={state.context.repository ?? ""}
            disabled={state.writing}
            onChange={(e) =>
              dispatch({ type: "context", patch: { repository: e.target.value || null } })
            }
          >
            <option value="">{t("configuration.no_repository")}</option>
            {view?.recentRepositories.map((r) => (
              <option key={r.path} value={r.path}>
                {r.path}
                {!r.available ? ` · ${t("configuration.unavailable")}` : ""}
              </option>
            ))}
            {state.context.repository &&
              !view?.recentRepositories.some((r) => r.path === state.context.repository) && (
                <option value={state.context.repository}>{state.context.repository}</option>
              )}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={state.writing}
          onClick={() => dispatch({ type: "chooseRepository" })}
        >
          {t("configuration.choose_repository")}
        </Button>
        {state.context.repository && (
          <Button
            disabled={state.writing}
            onClick={() => dispatch({ type: "forget", path: state.context.repository as string })}
          >
            {t("configuration.forget")}
          </Button>
        )}
        <label className="min-w-44 flex-1 text-xs text-muted">
          {t(ssh ? "configuration.ssh_client" : "configuration.git_executable")}
          <select
            className="config-select mt-1"
            disabled={state.writing}
            value={(ssh ? state.context.sshClient : state.context.git) ?? ""}
            onChange={(e) =>
              dispatch({
                type: "context",
                patch: ssh
                  ? { sshClient: e.target.value || null }
                  : { git: e.target.value || null },
              })
            }
          >
            <option value="">{t("configuration.effective_default")}</option>
            {(ssh ? view?.ssh.clients : view?.executables)?.map((exe) => (
              <option key={exe.path} value={exe.path}>
                {exe.label}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={state.writing} onClick={() => dispatch({ type: "refresh" })}>
          {t("configuration.refresh")}
        </Button>
      </div>
      {state.loading && (
        <p role="status" className="text-sm text-muted">
          {t("configuration.loading")}
        </p>
      )}
      {state.error && (
        <div role="alert" className="shell-banner text-danger wrap-anywhere">
          {state.error}
        </div>
      )}
      {state.result && (
        <div role="status" className={`shell-banner flex-wrap ${state.result.status === "failed" ? "text-danger" : ""}`}>
          <span>
            {state.result.status} · {t("configuration.readback")}: {state.result.readback}
          </span>
          {state.result.message && <p className="wrap-anywhere">{state.result.message}</p>}
          {state.operation?.status === "applied" && (
            <Button disabled={state.writing} onClick={() => dispatch({ type: "undo" })}>
              {t("configuration.undo")}
            </Button>
          )}
        </div>
      )}
      {!state.result && state.operation?.status === "applied" && (
        <Button
          className="self-start"
          disabled={state.writing}
          onClick={() => dispatch({ type: "undo" })}
        >
          {t("configuration.undo")}
        </Button>
      )}
      {view && (
        <>
          <p className="text-xs text-muted wrap-anywhere" translate="no">
            {ssh
              ? (view.ssh.client ?? t("configuration.unresolved"))
              : `${view.git.version} · ${view.git.executable}`}
          </p>
          {(ssh ? view.ssh.diagnostics : view.git.diagnostics).map((diagnostic) => (
            <p key={diagnostic} className="shell-banner text-warn text-sm wrap-anywhere">
              {diagnostic}
            </p>
          ))}
          {!ssh && view.git.trustCommand && (
            <Panel title={t("configuration.trust_heading")}>
              <p className="text-sm text-muted mb-2">{t("configuration.trust_help")}</p>
              <code className="block wrap-anywhere select-all">{view.git.trustCommand}</code>
            </Panel>
          )}
          <fieldset className="flex gap-1 flex-wrap" aria-label={t("configuration.sections")}>
            {tabs.map((value) => (
              <Button
                key={value}
                variant={tab === value ? "secondary" : "ghost"}
                aria-pressed={tab === value}
                onClick={() => dispatch({ type: "section", page, section: value })}
              >
                {t(`configuration.tab_${value}`)}
              </Button>
            ))}
          </fieldset>
          {!ssh && tab === "identity" && (
            <div className="config-columns">
              <div className="flex flex-col gap-4">
                <Panel title={t("configuration.commit_identity")}>
                  <Occurrence occurrence={view.git.identity.name} kind="gitValue" />
                  <Occurrence occurrence={view.git.identity.email} kind="gitValue" />
                  <p className="text-xs text-muted mt-3">{t("configuration.identity_help")}</p>
                </Panel>
                <Panel title={t("configuration.authentication")}>
                  <p className="text-xs text-muted wrap-anywhere mb-3">
                    {t("configuration.ssh_client")}:{" "}
                    {view.ssh.client ?? t("configuration.unresolved")}
                  </p>
                  {view.git.occurrences
                    .filter(
                      (o) =>
                        o.key === "core.sshcommand" ||
                        o.key === "credential.helper" ||
                        (o.key.startsWith("remote.") && o.key.endsWith(".url")),
                    )
                    .map((o) => (
                      <Occurrence
                        key={o.id}
                        occurrence={o}
                        kind={o.key === "core.sshcommand" ? "gitValue" : undefined}
                      />
                    ))}
                  <a
                    className="text-sm text-fg underline focus-visible:outline-2 focus-visible:outline-accent"
                    href={shellNavigationHref({ page: "ssh" })}
                    onClick={(e) => {
                      if (onNavigate && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                        e.preventDefault();
                        onNavigate("ssh");
                      }
                    }}
                  >
                    {t("configuration.inspect_ssh")}
                  </a>
                </Panel>
              </div>
              <Panel title={t("configuration.sources")}>
                <SourceFiles sources={view.git.sources} />
                {view.git.commonDirectory && (
                  <p className="text-xs text-muted mt-3 wrap-anywhere">
                    {t("configuration.shared_git_directory", { path: view.git.commonDirectory })}
                  </p>
                )}
              </Panel>
            </div>
          )}
          {!ssh && (tab === "all" || tab === "behavior") && (
            <Panel title={t(`configuration.tab_${tab}`)}>
              {view.git.occurrences
                .filter((o) => tab === "all" || !["user.name", "user.email"].includes(o.key))
                .map((o) => (
                  <Occurrence key={o.id} occurrence={o} kind="gitValue" />
                ))}
            </Panel>
          )}
          {!ssh && tab === "rules" && (
            <Panel title={t("configuration.tab_rules")}>
              <Button
                variant="secondary"
                disabled={
                  state.writing || !view.git.sources.some((s) => s.scope === "global" && s.writable)
                }
                onClick={() =>
                  dispatch({
                    type: "edit",
                    draft: {
                      kind: "includeRule",
                      rule: null,
                      source: preferredGlobalSource(view.git.sources),
                      condition: "gitdir/i:",
                      target: "",
                    },
                  })
                }
              >
                {t("configuration.add_rule")}
              </Button>
              {view.git.rules.map((rule) => (
                <div key={rule.id} className="mt-3 border-t border-rim-subtle pt-3">
                  <p className="font-mono text-sm wrap-anywhere">{rule.condition}</p>
                  <p className="text-sm wrap-anywhere">{rule.target}</p>
                  <p className="text-xs text-muted wrap-anywhere">
                    {rule.source}:{rule.line} ·{" "}
                    {t(rule.active ? "configuration.loaded" : "configuration.not_loaded")}
                  </p>
                  {rule.reason && <p className="text-xs text-muted">{rule.reason}</p>}
                  <Button
                    disabled={!rule.editable || state.writing}
                    onClick={() =>
                      dispatch({
                        type: "edit",
                        draft: {
                          kind: "includeRule",
                          rule: rule.id,
                          source: rule.source,
                          condition: rule.condition,
                          target: rule.target,
                        },
                      })
                    }
                  >
                    {t("configuration.edit")}
                  </Button>
                </div>
              ))}
            </Panel>
          )}
          {ssh && tab === "hosts" && (
            <div className="config-columns">
              <Panel title={t("configuration.tab_hosts")}>
                <div className="flex flex-col gap-1">
                  {view.ssh.hosts.map((h) => (
                    <Button
                      key={h.name}
                      aria-pressed={host?.name === h.name}
                      variant={host?.name === h.name ? "secondary" : "ghost"}
                      onClick={() => dispatch({ type: "host", name: h.name })}
                    >
                      {h.name}
                    </Button>
                  ))}
                </div>
              </Panel>
              <Panel title={host?.name ?? t("configuration.connection")}>
                <p className="text-xs text-muted mb-3 wrap-anywhere">{view.ssh.command}</p>
                {host?.unresolved.map((reason) => (
                  <p key={reason} className="text-warn text-sm">
                    {reason}
                  </p>
                ))}
                {host?.values.map((o) => (
                  <Occurrence
                    key={o.id}
                    occurrence={o}
                    kind={o.key === "identityfile" ? "sshIdentity" : undefined}
                  />
                ))}
                <p className="text-xs text-muted mt-3">{t("configuration.ssh_evidence")}</p>
              </Panel>
            </div>
          )}
          {ssh && tab === "files" && <SourceFiles sources={view.ssh.sources} />}
          {ssh && tab === "keys" && (
            <Panel title={t("configuration.tab_keys")}>
              {view.ssh.keys.map((key) => (
                <div key={key.path} className="py-3 border-b border-rim-subtle">
                  <p className="wrap-anywhere" translate="no">
                    {key.path}
                  </p>
                  <p className="text-xs text-muted">
                    {t(key.exists ? "configuration.available" : "configuration.unavailable")} ·{" "}
                    {t(key.referenced ? "configuration.referenced" : "configuration.unreferenced")}
                  </p>
                  <p className="font-mono text-xs wrap-anywhere">
                    {key.algorithm} {key.fingerprint}
                  </p>
                </div>
              ))}
            </Panel>
          )}
        </>
      )}
      {draft && (
        <Panel title={t("configuration.edit")}>
          <form
            ref={editor}
            onSubmit={(e) => {
              e.preventDefault();
              dispatch({ type: "preview" });
            }}
            className="flex flex-col gap-3"
          >
            {draft.kind === "includeRule" ? (
              <>
                <label className="text-sm">
                  {t("configuration.source")}
                  <select
                    className="config-select"
                    value={draft.source}
                    disabled={draft.rule !== null}
                    onChange={(e) => updateDraft({ source: e.target.value })}
                  >
                    {view?.git.sources
                      .filter((s) => s.writable && s.scope === "global")
                      .map((s) => (
                        <option key={s.path}>{s.path}</option>
                      ))}
                  </select>
                </label>
                <label className="text-sm">
                  {t("configuration.condition_type")}
                  <select
                    className="config-select"
                    value={
                      draft.condition.startsWith("hasconfig:")
                        ? "hasconfig:remote.*.url:"
                        : draft.condition.startsWith("gitdir/i:")
                          ? "gitdir/i:"
                          : "gitdir:"
                    }
                    onChange={(e) => {
                      if (draft?.kind === "includeRule")
                        updateDraft({
                          condition:
                            e.target.value +
                            draft.condition.replace(
                              /^(hasconfig:remote\.\*\.url:|gitdir\/i:|gitdir:)/,
                              "",
                            ),
                        });
                    }}
                  >
                    <option value="gitdir/i:">{t("configuration.folder_insensitive")}</option>
                    <option value="gitdir:">{t("configuration.folder_sensitive")}</option>
                    {view?.git.remoteRules && (
                      <option value="hasconfig:remote.*.url:">
                        {t("configuration.remote_url")}
                      </option>
                    )}
                  </select>
                </label>
                <TextInput
                  label={t("configuration.condition")}
                  value={draft.condition}
                  onChange={(e) => updateDraft({ condition: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => dispatch({ type: "chooseRuleFolder", caseSensitive: false })}
                  >
                    {t("configuration.pick_folder_rule")}
                  </Button>
                  <Button
                    onClick={() => dispatch({ type: "chooseRuleFolder", caseSensitive: true })}
                  >
                    {t("configuration.pick_folder_sensitive")}
                  </Button>
                </div>
                <p className="text-xs text-muted">
                  {t(
                    view?.git.remoteRules
                      ? "configuration.condition_help"
                      : "configuration.remote_unsupported",
                  )}
                </p>
                <TextInput
                  label={t("configuration.include_target")}
                  value={draft.target}
                  onChange={(e) => updateDraft({ target: e.target.value })}
                />
                <Button
                  className="self-start"
                  onClick={() => dispatch({ type: "chooseIncludeTarget" })}
                >
                  {t("configuration.pick_include_file")}
                </Button>
              </>
            ) : (
              <TextInput
                label={t("configuration.value")}
                value={draft.value}
                onChange={(e) => updateDraft({ value: e.target.value })}
              />
            )}
            {state.liveError && (
              <p role="alert" className="text-danger text-sm">
                {state.liveError}
              </p>
            )}
            {state.livePlan && (
              <div className="shell-panel p-3">
                <h3>{t("configuration.impact_preview")}</h3>
                {state.livePlan.impacts.map((i) => (
                  <p key={i.repository} className="text-sm wrap-anywhere">
                    {i.repository} · {i.status} ·{" "}
                    {i.matched === null
                      ? ""
                      : t(i.matched ? "configuration.matched" : "configuration.not_matched")}{" "}
                    · {i.before.email?.value} → {i.after.email?.value}
                    {i.reason ? ` · ${i.reason}` : ""}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={state.loading || state.writing}>
                {t("configuration.preview")}
              </Button>
              <Button
                disabled={state.writing}
                onClick={() => dispatch({ type: "edit", draft: null })}
              >
                {t("configuration.cancel")}
              </Button>
            </div>
          </form>
        </Panel>
      )}
      <Modal
        open={draft !== null && state.plan !== null}
        title={t("configuration.review")}
        size="xl"
        onClose={() => {
          if (!state.writing) dispatch({ type: "closeReview" });
        }}
      >
        {state.plan && (
          <div className="p-4 flex flex-col gap-4 min-w-0">
            <p className="wrap-anywhere">
              {state.plan.source} · {state.plan.scope}
            </p>
            <div className="config-diff">
              <div>
                <h3>{t("configuration.before")}</h3>
                <pre className="config-source">{state.plan.before}</pre>
              </div>
              <div>
                <h3>{t("configuration.after")}</h3>
                <pre className="config-source">{state.plan.after}</pre>
              </div>
            </div>
            {state.plan.impacts.map((impact) => (
              <section key={impact.repository} className="shell-panel p-3">
                <h3 className="wrap-anywhere">{impact.repository}</h3>
                <p className="text-sm">{impact.status}</p>
                <p className="text-sm wrap-anywhere">
                  {impact.before.name?.value} · {impact.before.email?.value} →{" "}
                  {impact.after.name?.value} · {impact.after.email?.value}
                </p>
                {impact.matched !== null && (
                  <p className="text-xs">
                    {t(impact.matched ? "configuration.matched" : "configuration.not_matched")}
                  </p>
                )}
                {impact.reason && <p className="text-sm text-warn">{impact.reason}</p>}
              </section>
            ))}
            {state.plan.warnings.map((warning) => (
              <p className="text-sm text-warn" key={warning}>
                {warning}
              </p>
            ))}
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={state.writing}
                onClick={() => dispatch({ type: "apply" })}
              >
                {t("configuration.apply")}
              </Button>
              <Button disabled={state.writing} onClick={() => dispatch({ type: "closeReview" })}>
                {t("configuration.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
