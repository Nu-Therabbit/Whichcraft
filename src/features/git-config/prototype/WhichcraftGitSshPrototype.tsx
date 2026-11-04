// THROWAWAY UI: three layouts in Whichcraft's real shell styles/components.
// ?page=git-config|ssh&variant=A|B|C. Fixture mutations only, no Tauri services.
import { type ReactNode, useEffect, useRef, useState } from "react";
import brandIcon from "../../../../src-tauri/icons/source/logo.svg?no-inline";
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { IconButton } from "../../../components/ui/IconButton";
import { Modal } from "../../../components/ui/Modal";
import { ToolLogo } from "../../../components/ui/ToolLogo";
import { ThemeContext } from "../../../context/ThemeContext";
import type { ToolKind } from "../../tools/types";
import P from "./prototypeModel";
import "./prototype.css";

type Page = "tools" | "profiles" | "environment" | "git-config" | "ssh" | "settings";
type Variant = "A" | "B" | "C";
type Target = { fileId: string; key: string; ordinal: number };
type Row = {
  fileId: string;
  key: string;
  value: string;
  index: number;
  body: string;
  host?: string;
};
type Plan = {
  kind?: "rule";
  ruleDraft?: RuleDraft;
  impacts?: {
    repo: string;
    matches: boolean;
    before: { name: string; summary: string };
    after: { name: string; summary: string; origin?: string };
  }[];
  endLine?: number;
  target: Target;
  beforeText: string;
  afterText: string;
  beforeEffective: string;
  afterEffective: string;
  line: number;
};
type RuleDraft = { ordinal: number | null; type: string; pattern: string; path: string };
type IncludeRule = { condition: string; value: string; sectionIndex: number };
type LabState = Omit<ReturnType<typeof P.initial>, "plan" | "journal"> & {
  plan: Plan | null;
  journal: (Plan & { id: number; status: "applied" | "undone" }) | null;
};
const files = P.definitions as Record<
  string,
  { name: string; path: string; scope: string; kind: string; text: string }
>;
const variants: Record<Variant, string> = {
  A: "Workspace",
  B: "Repository / identity first",
  C: "Source files",
};
const keyFiles = [
  {
    name: "Work",
    path: "~/.ssh/id_work",
    host: "bitbucket.org",
    fingerprint: "SHA256:example-work-key",
    note: "Work account",
    file: "sshWork",
    ordinal: 0,
  },
  {
    name: "Work backup",
    path: "~/.ssh/id_work_backup",
    host: "bitbucket.org",
    fingerprint: "SHA256:example-backup-key",
    note: "Additional identity",
    file: "sshWork",
    ordinal: 1,
  },
  {
    name: "Personal",
    path: "~/.ssh/id_personal",
    host: "github-personal",
    fingerprint: "SHA256:example-personal-key",
    note: "Personal account",
    file: "ssh",
    ordinal: 0,
  },
];
const toolRows: { tool: ToolKind; version: string; vendor: string }[] = [
  { tool: "java", version: "21.0.8", vendor: "Temurin" },
  { tool: "node", version: "22.18.0", vendor: "Node.js" },
  { tool: "python", version: "3.13.5", vendor: "Python" },
  { tool: "go", version: "1.24.5", vendor: "Go" },
  { tool: "flutter", version: "3.32.7", vendor: "Flutter" },
  { tool: "git", version: "2.56.0", vendor: "Git for Windows" },
];
const pageNames: Record<Page, string> = {
  tools: "Developer tools",
  profiles: "Tool profiles",
  environment: "Environment",
  "git-config": "Git configuration",
  ssh: "SSH",
  settings: "Settings",
};
function readRoute() {
  const query = new URLSearchParams(window.location.search);
  const page = query.get("page") as Page,
    variant = query.get("variant") as Variant;
  return {
    page: page in pageNames ? page : ("git-config" as Page),
    variant: variant in variants ? variant : ("A" as Variant),
  };
}
function fileName(path: string) {
  return path.split("/").pop();
}
function Mark({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    tools: "M2 3h12v10H2zM5 6l2 2-2 2m4 0h2",
    profiles: "M3 2h7v3h3v9H6v-3H3zM6 5h4M6 8h4M8 11h3",
    environment: "M5 2L2 5l3 3m6 0l3 3-3 3M9 2L7 14",
    settings: "M2 4h12M2 12h12M5 2v4m6 4v4",
    "git-config": "M5 2v8a3 3 0 003 3h3M5 5h5a2 2 0 002-2M5 1v2m6 9v2M11 2h2",
    ssh: "M6 9a4 4 0 117-3 4 4 0 01-7 3ZM6 9l-4 4v2h3v-2h2l2-2",
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[kind] || paths.tools} />
    </svg>
  );
}
function Panel({
  title,
  detail,
  action,
  children,
  className = "",
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`shell-panel gp-panel ${className}`}>
      <div className="gp-panel-heading">
        <div>
          <h2>{title}</h2>
          {detail && <p>{detail}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Pill({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`gp-pill ${tone}`}>{children}</span>;
}

export function WhichcraftGitSshPrototype() {
  const [route, setRoute] = useState(readRoute);
  const [state, setState] = useState<LabState>(() =>
    P.initial({ kind: readRoute().page === "ssh" ? "ssh" : "git" }),
  );
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("tab") === "rules" ? "rules" : "identity",
  );
  const [sshTab, setSshTab] = useState("hosts");
  const [sourceFile, setSourceFile] = useState("global");
  const [editOpen, setEditOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>({
    ordinal: null,
    type: "gitdir/i",
    pattern: "E:/Projects/work-demo/",
    path: files.work.path,
  });
  const [message, setMessage] = useState("");
  const [scenario, setScenario] = useState("normal");
  const [toolsOpen, setToolsOpen] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);
  const navigate = (page: Page, variant = routeRef.current.variant) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", page);
    url.searchParams.set("variant", variant);
    window.history.pushState(null, "", url);
    setRoute({ page, variant });
    setMessage("");
    if (page === "ssh" || page === "git-config")
      setState((s: LabState) =>
        P.reduce(s, { type: "kind", value: page === "ssh" ? "ssh" : "git" }),
      );
  };
  useEffect(() => {
    const pop = () => {
      const next = readRoute();
      setRoute(next);
      if (next.page === "ssh" || next.page === "git-config")
        setState((s: LabState) =>
          P.reduce(s, { type: "kind", value: next.page === "ssh" ? "ssh" : "git" }),
        );
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (heading.current?.textContent === pageNames[route.page])
      heading.current.focus({ preventScroll: true });
  }, [route.page]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable],dialog,[role=dialog],[role=tablist]",
        )
      )
        return;
      event.preventDefault();
      const current = ["A", "B", "C"].indexOf(routeRef.current.variant);
      const next = ["A", "B", "C"][(current + (event.key === "ArrowRight" ? 1 : 2)) % 3] as Variant;
      const url = new URL(window.location.href);
      url.searchParams.set("variant", next);
      window.history.replaceState(null, "", url);
      setRoute((r) => ({ ...r, variant: next }));
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

  const send = (type: string, extra: Record<string, unknown> = {}) => {
    const next = P.reduce(state, { type, ...extra });
    setState(next);
    return next;
  };
  const gitState = state.kind === "git" ? state : P.reduce(state, { type: "kind", value: "git" });
  const emailState = { ...gitState, target: { ...gitState.target, key: "user.email" } };
  const identity = P.effective(emailState);
  const rules = P.includeRules(gitState) as IncludeRule[];
  const sshState = state.kind === "ssh" ? state : P.reduce(state, { type: "kind", value: "ssh" });
  const identities: Row[] = P.effective(sshState).chain;
  const repoCommand = (
    P.records(
      state.repo === "work" ? "repoWork" : "repoPersonal",
      state.files[state.repo === "work" ? "repoWork" : "repoPersonal"],
    ) as Row[]
  ).find((row) => row.key === "core.sshcommand");
  const workKey = (P.records("sshWork", state.files.sshWork) as Row[]).find(
    (row) => row.key === "identityfile",
  )?.value;
  const authenticationValue = repoCommand?.value || workKey || "No explicit identity";
  const isGit = route.page === "git-config";
  const notice =
    message ||
    (state.result.code === "applied"
      ? "Configuration updated. Only the selected value changed."
      : state.result.code === "undone"
        ? "Changes undone. Other edits in the file were kept."
        : "");

  function beginEdit(target: Target) {
    const selected = P.find(state, target);
    const next = P.reduce(state, { type: "target", target });
    setState(P.reduce(next, { type: "draft", value: selected?.value || "" }));
    setEditOpen(true);
    setMessage("");
  }
  function beginRule(ordinal: number | null = null) {
    const row = ordinal === null ? null : rules[ordinal];
    const type = row?.condition.startsWith("hasconfig:")
      ? "hasconfig:remote.*.url"
      : row?.condition.startsWith("gitdir/i:")
        ? "gitdir/i"
        : "gitdir";
    setRuleDraft(
      row
        ? { ordinal, type, pattern: row.condition.slice(type.length + 1), path: row.value }
        : {
            ordinal: null,
            type: "gitdir/i",
            pattern: "E:/Projects/work-demo/",
            path: files.work.path,
          },
    );
    setRuleOpen(true);
    setMessage("");
  }
  function reviewRule() {
    let next = P.reduce(state, { type: "rule-preview", draft: ruleDraft });
    if (!next.plan) return;
    if (scenario === "stale") next = P.reduce(next, { type: "outside-unrelated" });
    setState(next);
    setRuleOpen(false);
    setReviewOpen(true);
  }
  function review() {
    let next = P.reduce(state, { type: "preview" });
    if (!next.plan) return;
    if (scenario === "stale") next = P.reduce(next, { type: "outside-same" });
    setState(next);
    setEditOpen(false);
    setReviewOpen(true);
  }
  function apply() {
    let next = P.reduce(state, { type: "apply" });
    if (next.result.code !== "applied") {
      setState(next);
      return;
    }
    if (scenario === "keep-other") next = P.reduce(next, { type: "outside-unrelated" });
    if (scenario === "undo-conflict") next = P.reduce(next, { type: "outside-same" });
    setState(next);
    setReviewOpen(false);
    setMessage(
      state.plan?.kind === "rule"
        ? "Include rule updated. Matching repositories now read the included file; local overrides still apply."
        : `Configuration updated. ${state.plan?.beforeEffective === state.plan?.afterEffective ? "The repository override is still in effect." : isGit ? "Commit identity was read back for this repository." : "Your other IdentityFile entries and comments were kept."}`,
    );
  }
  function undo() {
    const next = send("undo");
    setMessage(
      next.result.code === "undone"
        ? "Changes undone. Edits from other applications were kept."
        : "Cannot undo: another application changed the same setting. Your current file was kept.",
    );
  }
  function selectRepo(repo: string) {
    send("repo", { value: repo });
    setMessage("");
  }
  function selectHost(host: string) {
    send("host", { value: host });
    setMessage("");
  }
  function chooseScenario(value: string) {
    setScenario(value);
    setMessage("");
    setEditOpen(false);
    setReviewOpen(false);
    setRuleOpen(false);
    const next = P.initial({
      kind: isGit ? "git" : "ssh",
      ...(value === "override"
        ? { repo: "personal", target: { fileId: "global", key: "user.email", ordinal: 0 } }
        : {}),
    });
    setState(next);
  }
  const sourceRows: Row[] = identity.chain;
  const editIdentity = () =>
    beginEdit(
      scenario === "override"
        ? { fileId: "global", key: "user.email", ordinal: 0 }
        : P.targetFor("git", state.repo),
    );
  const editKey = (ordinal = 0) =>
    beginEdit({
      fileId: state.host === "bitbucket.org" ? "sshWork" : "ssh",
      key: "identityfile",
      ordinal,
    });

  const repoPicker = (
    <label className="gp-context-picker">
      <Icon name="folder" size={14} aria-hidden />
      <span className="sr-only">Repository</span>
      <select value={state.repo} onChange={(e) => selectRepo(e.target.value)}>
        <option value="work">work-demo</option>
        <option value="personal">personal-demo</option>
      </select>
      <span className="gp-context-path">
        E:\Projects\{state.repo === "work" ? "work-demo" : "personal-demo"}
      </span>
    </label>
  );
  const sourceChain = (
    <Panel
      title="Where this value comes from"
      detail="Git reads these values in order. The last scalar value takes effect."
    >
      {sourceRows.map((row, index) => (
        <div
          className="gp-source-row"
          key={`${row.fileId}-${row.index}`}
          data-effective={index === sourceRows.length - 1}
        >
          <span className="gp-source-dot" />
          <div>
            <div className="gp-row-heading">
              <span>{files[row.fileId].scope}</span>
              {index === sourceRows.length - 1 && <Pill tone="success">In effect</Pill>}
            </div>
            <code>{row.value}</code>
            <p>
              {files[row.fileId].path}:{row.index + 1}
            </p>
          </div>
          <Button
            size="xs"
            variant="ghost"
            icon="pencil"
            aria-label={`Edit email in ${files[row.fileId].path}`}
            onClick={() => beginEdit({ fileId: row.fileId, key: "user.email", ordinal: 0 })}
          />
        </div>
      ))}
    </Panel>
  );
  const identityCard = (
    <Panel
      title="Commit identity"
      detail="The author information Git will use in this repository."
      action={
        <Button variant="secondary" size="xs" icon="pencil" onClick={editIdentity}>
          Edit identity
        </Button>
      }
    >
      <div className="gp-identity">
        <span className="gp-avatar">MW</span>
        <div>
          <h3>{identity.name}</h3>
          <p className="font-mono">{identity.summary}</p>
          <div className="gp-inline-meta">
            <Pill tone="success">{state.repo === "work" ? "Work" : "Repository override"}</Pill>
            <code>{identity.origin ? files[identity.origin].path : "Not configured"}</code>
          </div>
        </div>
      </div>
      <div className="gp-note">
        <Icon name="info" size={14} aria-hidden />
        Commit identity is separate from the account used to authenticate.
      </div>
    </Panel>
  );
  const authenticationCard = (
    <Panel title="SSH authentication" detail="Configuration references for this repository.">
      <div className="gp-setting-row">
        <span>
          <strong>{state.repo === "work" ? "Bitbucket" : "GitHub"}</strong>
          <small>
            {repoCommand ? "Selected by local core.sshCommand" : "Selected by ~/.ssh/config"}
          </small>
        </span>
        <Pill>SSH</Pill>
      </div>
      <div className="gp-setting-row">
        <code>{authenticationValue}</code>
        <Button
          size="xs"
          variant="ghost"
          icon="external-link"
          onClick={() => {
            navigate("ssh");
            setSshTab("hosts");
            if (state.repo === "personal")
              setState(
                P.reduce(P.reduce(state, { type: "kind", value: "ssh" }), {
                  type: "host",
                  value: "github-personal",
                }),
              );
          }}
        >
          View in SSH
        </Button>
      </div>
    </Panel>
  );

  function rawFileView(kind: "git" | "ssh") {
    const ids = Object.entries(files)
      .filter(([, f]) => f.kind === kind)
      .map(([id]) => id);
    const selected = ids.includes(sourceFile) ? sourceFile : ids[0];
    const parsed = P.records(selected, state.files[selected]) as Row[];
    const meta = P.metadata(state.files[selected]);
    return (
      <div className="gp-files-layout">
        <div className="gp-file-tree">
          <h3>Configuration files</h3>
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              className="gp-file-link"
              aria-current={id === selected ? "true" : undefined}
              onClick={() => setSourceFile(id)}
            >
              <Icon name="folder" size={14} aria-hidden />
              <span>
                <strong>{fileName(files[id].path)}</strong>
                <small>{files[id].scope}</small>
              </span>
            </button>
          ))}
        </div>
        <Panel
          title={files[selected].path}
          detail={`${meta.bytes} bytes · ${meta.crlf ? "CRLF" : "LF"}${meta.bom ? " · UTF-8 BOM" : ""}`}
        >
          <div className="gp-source-code">
            {P.lines(state.files[selected]).map((line: { body: string; index: number }) => {
              const row = parsed.find((r) => r.index === line.index);
              const canEdit =
                selected !== "system" &&
                row &&
                (kind === "git"
                  ? ["user.email", "user.name", "core.sshcommand"].includes(row.key)
                  : row.key === "identityfile");
              const ordinal = row
                ? parsed.filter((r) => r.key === row.key && r.index < row.index).length
                : 0;
              return (
                <div className="gp-file-line" key={line.index}>
                  <span>{line.index + 1}</span>
                  <code>{line.body.replace(/^\uFEFF/, "") || " "}</code>
                  {canEdit && (
                    <Button
                      size="xs"
                      icon="pencil"
                      aria-label={`Edit line ${line.index + 1}`}
                      onClick={() => beginEdit({ fileId: selected, key: row.key, ordinal })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }
  function gitContent() {
    if (tab === "rules") return rulesContent();
    if (route.variant === "C") return rawFileView("git");
    if (tab === "all") return rawFileView("git");
    if (tab === "behavior")
      return (
        <Panel title="Git behavior" detail="Settings inherited by the selected repository.">
          {[
            ["Line endings", "core.autocrlf", "true", "System"],
            ["Credential helpers", "credential.helper", "manager → cache", "System + global"],
            ["Commit signing", "commit.gpgSign", "Not configured", "—"],
          ].map(([label, key, value, scope]) => (
            <div className="gp-setting-row" key={key}>
              <span>
                <strong>{label}</strong>
                <small>{key}</small>
              </span>
              <code>{value}</code>
              <Pill>{scope}</Pill>
              <Button size="xs" onClick={() => setTab("all")}>
                View source
              </Button>
            </div>
          ))}
        </Panel>
      );
    if (route.variant === "B")
      return (
        <>
          <Panel
            title="Repositories"
            detail="See the identity and key configuration together before changing either."
          >
            {["work", "personal"].map((repo) => {
              const snapshot = {
                ...P.reduce(gitState, { type: "repo", value: repo }),
                target: {
                  fileId: repo === "work" ? "work" : "repoPersonal",
                  key: "user.email",
                  ordinal: 0,
                },
              };
              const result = P.effective(snapshot);
              return (
                <button
                  type="button"
                  className="gp-repo-row"
                  aria-pressed={state.repo === repo}
                  onClick={() => selectRepo(repo)}
                  key={repo}
                >
                  <Icon name="folder" size={18} aria-hidden />
                  <span>
                    <strong>{repo}-demo</strong>
                    <small>{repo === "work" ? "bitbucket.org" : "github.com"}</small>
                  </span>
                  <code>{result.summary}</code>
                  <span>{repo === "work" ? "Work key" : "Personal key"}</span>
                  <Icon name="chevron-down" size={14} aria-hidden />
                </button>
              );
            })}
          </Panel>
          <div className="gp-detail-grid gp-spaced">
            {identityCard}
            {authenticationCard}
          </div>
          <div className="gp-spaced">{sourceChain}</div>
        </>
      );
    return (
      <div className="gp-detail-grid">
        <div className="gp-stack">
          {identityCard}
          {authenticationCard}
        </div>
        {sourceChain}
      </div>
    );
  }
  function rulesContent() {
    return (
      <div className="gp-stack">
        <Panel
          title="Conditional includes"
          detail="Automatically load a config file when a repository matches a rule."
          action={
            <Button size="sm" variant="primary" onClick={() => beginRule()}>
              Add includeIf rule
            </Button>
          }
        >
          {rules.map((rule, ordinal) => {
            const matches = Object.keys(P.repos).filter((repo) =>
              P.matchesRule(gitState, rule.condition, repo),
            );
            return (
              <div className="gp-rule-row" key={rule.sectionIndex}>
                <span className="gp-rule-order">{ordinal + 1}</span>
                <div className="gp-rule-detail">
                  <code>{rule.condition}</code>
                  <small>
                    Include <code>{rule.value}</code> · declared in ~/.gitconfig
                  </small>
                  <div className="gp-rule-matches">
                    {matches.length ? (
                      matches.map((repo) => (
                        <Pill tone="accent" key={repo}>
                          {repo}-demo
                        </Pill>
                      ))
                    ) : (
                      <Pill>No sample repositories match</Pill>
                    )}
                  </div>
                </div>
                <Button size="xs" variant="secondary" onClick={() => beginRule(ordinal)}>
                  Edit rule
                </Button>
              </div>
            );
          })}
          <div className="gp-rule-footnote">
            Read in file order. Matching includes are loaded at their declaration; later values can
            override earlier ones. Local repository settings are read afterward.
          </div>
        </Panel>
        <Panel
          title="Repository results"
          detail="Current effective identity, after all matching includes and local overrides."
        >
          {Object.keys(P.repos).map((repo) => {
            const result = P.effective({ ...gitState, repo, target: { key: "user.email" } });
            const matches = rules.filter((rule) => P.matchesRule(gitState, rule.condition, repo));
            return (
              <div className="gp-rule-result" key={repo}>
                <div>
                  <strong>{repo}-demo</strong>
                  <small>{P.repos[repo as keyof typeof P.repos].remote}</small>
                </div>
                <div>
                  <strong>{result.name}</strong>
                  <code>{result.summary}</code>
                  <small>
                    {matches.length} matching rule{matches.length === 1 ? "" : "s"} · email from{" "}
                    {files[result.origin]?.path || "unset"}
                  </small>
                </div>
              </div>
            );
          })}
        </Panel>
      </div>
    );
  }
  function ruleImpacts(proposal: Plan) {
    return (
      <section className="gp-rule-impacts" aria-label="Repository impact preview">
        {proposal.impacts?.map((impact) => (
          <div className="gp-rule-impact" key={impact.repo}>
            <div>
              <strong>{impact.repo}-demo</strong>
              <Pill tone={impact.matches ? "accent" : ""}>
                {impact.matches ? "Matches" : "No match"}
              </Pill>
            </div>
            <span>
              <small>Before</small>
              <strong>{impact.before.name}</strong>
              <code>{impact.before.summary}</code>
            </span>
            <span>
              <small>After</small>
              <strong>{impact.after.name}</strong>
              <code>{impact.after.summary}</code>
            </span>
            {impact.matches &&
              impact.after.origin === P.repos[impact.repo as keyof typeof P.repos].local && (
                <small className="gp-impact-note">
                  Local user.email overrides the included email.
                </small>
              )}
          </div>
        ))}
      </section>
    );
  }
  function keysContent() {
    return (
      <Panel
        title="SSH keys"
        detail="Public-key metadata and the host aliases that reference each key."
      >
        {keyFiles.map((key) => {
          const references = ["ssh", "sshWork"]
            .flatMap((id) => P.records(id, state.files[id]) as Row[])
            .filter((row) => row.key === "identityfile" && row.value === key.path);
          const hosts = [...new Set(references.map((row) => row.host))];
          return (
            <div className="gp-key-row" key={key.name}>
              <span className="gp-key-glyph">
                <Mark kind="ssh" />
              </span>
              <div>
                <strong>{key.name}</strong>
                <code>{key.path}</code>
                <small>{key.fingerprint} · sample</small>
              </div>
              <Pill>ED25519</Pill>
              <span className="gp-key-host">{hosts.join(", ") || "Not referenced"}</span>
              <Button
                size="xs"
                variant="secondary"
                disabled={references.length === 0}
                onClick={() => {
                  selectHost(hosts[0] || key.host);
                  setSshTab("hosts");
                }}
              >
                View references
              </Button>
            </div>
          );
        })}
      </Panel>
    );
  }
  function hostDetails() {
    return (
      <Panel
        title={state.host}
        detail={
          state.host === "bitbucket.org"
            ? "Work repositories · Included configuration"
            : "Personal repositories · Main configuration"
        }
        action={
          <Button size="xs" variant="secondary" icon="pencil" onClick={() => editKey()}>
            Change key
          </Button>
        }
      >
        <div className="gp-connection-fields">
          {[
            ["Host name", state.host === "bitbucket.org" ? "bitbucket.org" : "github.com"],
            ["User", "git"],
            ["Port", "22"],
            ["Identities only", state.host === "bitbucket.org" ? "yes" : "Not configured"],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <code>{value}</code>
            </div>
          ))}
        </div>
        <div className="gp-section-label">
          Identity files <span>{identities.length}</span>
        </div>
        {identities.map((row, index) => (
          <div className="gp-source-row" key={`${row.fileId}-${row.index}`}>
            <span className="gp-key-glyph">
              <Mark kind="ssh" />
            </span>
            <div>
              <div className="gp-row-heading">
                <strong>{index === 0 ? "Primary identity" : "Additional identity"}</strong>
                <Pill>#{index + 1}</Pill>
              </div>
              <code>{row.value}</code>
              <p>
                {files[row.fileId].path}:{row.index + 1}
              </p>
            </div>
            <Button
              size="xs"
              icon="pencil"
              aria-label={`Change identity ${index + 1}`}
              onClick={() => editKey(index)}
            />
          </div>
        ))}
        <div className="gp-note">
          <Icon name="info" size={14} aria-hidden />
          These are configured identities. A successful connection determines which key is accepted.
        </div>
      </Panel>
    );
  }
  function sshContent() {
    if (route.variant === "C" || sshTab === "files") return rawFileView("ssh");
    if (sshTab === "keys") return keysContent();
    if (route.variant === "B")
      return (
        <>
          <div className="gp-wide-heading">
            <h2>Identities and their hosts</h2>
            <p>Select an identity to inspect the host configuration that uses it.</p>
          </div>
          {keysContent()}
          <div className="gp-spaced">{hostDetails()}</div>
        </>
      );
    return (
      <div className="gp-host-layout">
        <Panel title="Host aliases" detail="From ~/.ssh/config and its includes.">
          {["bitbucket.org", "github-personal"].map((host) => (
            <button
              type="button"
              className="gp-host-item"
              aria-pressed={state.host === host}
              key={host}
              onClick={() => selectHost(host)}
            >
              <span className="gp-host-avatar">
                <Mark kind="ssh" />
              </span>
              <span>
                <strong>{host}</strong>
                <small>
                  {host === "bitbucket.org" ? "Work · 2 identities" : "Personal · 1 identity"}
                </small>
              </span>
              <Icon name="chevron-down" size={14} aria-hidden />
            </button>
          ))}
        </Panel>
        {hostDetails()}
      </div>
    );
  }

  function existingPage() {
    if (route.page === "tools")
      return (
        <>
          <p className="gp-page-intro">
            The installation a new process will use, and the selection you last made.
          </p>
          <div className="gp-tools-grid">
            {toolRows.map((row) => (
              <section className="shell-panel gp-tool-card" data-tool={row.tool} key={row.tool}>
                <button
                  type="button"
                  className="gp-tool-heading"
                  onClick={() =>
                    row.tool === "git"
                      ? navigate("git-config")
                      : setMessage("This is a sample tool installation in the prototype.")
                  }
                >
                  <ToolLogo tool={row.tool} tile={34} size={24} />
                  <span>
                    <strong>
                      {row.tool === "java"
                        ? "Java"
                        : row.tool === "node"
                          ? "Node.js"
                          : row.tool === "git"
                            ? "Git"
                            : row.vendor}
                    </strong>
                    <small>{row.vendor}</small>
                  </span>
                  <Icon name="chevron-down" size={14} aria-hidden />
                </button>
                <div className="gp-tool-install">
                  <code>{row.version}</code>
                  <span className="text-accent">In use</span>
                </div>
                <div className="gp-tool-selection">
                  Selection matches · 1 installation
                  {row.tool === "git" && (
                    <Button size="xs" variant="ghost" onClick={() => navigate("git-config")}>
                      Configure Git
                    </Button>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      );
    if (route.page === "environment")
      return (
        <>
          <p className="gp-page-intro">User and System environment variables.</p>
          <Panel title="Variables" detail="Sample environment in this prototype.">
            {[
              ["JAVA_HOME", "C:\\Dev\\Java\\temurin-21"],
              ["GOPATH", "C:\\Users\\Example\\go"],
              ["Path", "12 entries · User"],
            ].map(([name, value]) => (
              <div className="gp-setting-row" key={name}>
                <code>{name}</code>
                <span>{value}</span>
                <Pill>User</Pill>
              </div>
            ))}
          </Panel>
        </>
      );
    if (route.page === "profiles")
      return (
        <>
          <p className="gp-page-intro">Named sets of developer tool selections.</p>
          <Panel title="Everyday development">
            <div className="gp-setting-row">
              <span>Java 21 · Node.js 22 · Python 3.13</span>
              <Pill tone="success">Matches selections</Pill>
            </div>
          </Panel>
          <div className="gp-note gp-spaced">
            Git identities and SSH hosts have their own workspaces in this prototype. Tool profiles
            continue to describe tool installations.
          </div>
        </>
      );
    return (
      <>
        <p className="gp-page-intro">Appearance and application preferences.</p>
        <Panel title="Appearance">
          <div className="gp-setting-row">
            <span>Theme</span>
            <Button
              variant="secondary"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "Dark" : "Light"}
            </Button>
          </div>
        </Panel>
      </>
    );
  }
  const configPage = route.page === "git-config" || route.page === "ssh";
  const navLink = (id: Page, extra = false) => (
    <a
      href={`?page=${id}&variant=${route.variant}`}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(id);
      }}
      className="shell-nav-link gp-nav-link"
      aria-current={route.page === id ? "page" : undefined}
      key={id}
    >
      <span className="shell-nav-icon">
        <Mark kind={id} />
      </span>
      <span>
        {id === "git-config"
          ? "Git config"
          : id === "tools"
            ? "Tools"
            : id === "profiles"
              ? "Tool profiles"
              : pageNames[id]}
      </span>
      {extra && (
        <span className="gp-nav-new" title="New workspace">
          New
        </span>
      )}
    </a>
  );
  const plan = state.plan;
  const ruleError = P.ruleError(ruleDraft);
  const ruleProposal: Plan | null =
    ruleOpen && !ruleError
      ? P.reduce(gitState, { type: "rule-preview", draft: ruleDraft }).plan
      : null;
  const stale = plan && state.files[plan.target.fileId] !== plan.beforeText;
  const selected = P.find(state, state.target);

  return (
    <ThemeContext.Provider value={theme}>
      <div className="desktop-workbench @container gp-prototype-shell">
        <a className="shell-skip-link" href="#prototype-workspace">
          Skip to workspace
        </a>
        <nav className="shell-nav" aria-label="Main navigation">
          <div className="shell-brand">
            <img src={brandIcon} width="22" height="22" alt="" />
            <span>Whichcraft</span>
          </div>
          <div className="shell-nav-list">
            {navLink("tools")}
            {navLink("profiles")}
            {navLink("environment")}
            <div className="shell-nav-rule" />
            <div className="gp-nav-label">Configuration</div>
            {navLink("git-config", true)}
            {navLink("ssh", true)}
            <div className="shell-nav-rule" />
            <button
              type="button"
              className="shell-nav-section"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen(!toolsOpen)}
            >
              <Icon name={toolsOpen ? "chevron-down" : "chevron-up"} size={12} aria-hidden />
              Developer tools
            </button>
            {toolsOpen &&
              toolRows.map((row) => (
                <button
                  type="button"
                  className="shell-nav-link"
                  key={row.tool}
                  onClick={() => {
                    navigate(row.tool === "git" ? "git-config" : "tools");
                  }}
                >
                  <ToolLogo tool={row.tool} tile={22} size={16} />
                  <span className="flex-1">
                    {row.tool === "java"
                      ? "Java"
                      : row.tool === "node"
                        ? "Node.js"
                        : row.tool === "git"
                          ? "Git"
                          : row.vendor}
                  </span>
                  <span className="text-xs text-dim">1</span>
                </button>
              ))}
            <span className="flex-1" />
            {navLink("settings")}
          </div>
        </nav>
        <div className="shell-main">
          <main className="shell-sheet" id="prototype-workspace" tabIndex={-1}>
            <div className="shell-stage">
              <div className="shell-page-frame">
                <header className="shell-header">
                  <div className="gp-title-group">
                    <h1 ref={heading} tabIndex={-1}>
                      {pageNames[route.page]}
                    </h1>
                    <Pill>Prototype · sample data</Pill>
                  </div>
                  <div className="shell-header-actions">
                    <span className="text-xs text-muted">English</span>
                    <IconButton
                      icon={theme === "dark" ? "sun" : "moon"}
                      aria-label={
                        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
                      }
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    />
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setMessage("Git and SSH changes in this preview are stored in memory only.")
                      }
                    >
                      About this preview
                    </Button>
                  </div>
                </header>
                <div className="shell-page">
                  <div className="shell-scroll gp-workspace">
                    {notice && (
                      <div
                        className={`shell-banner gp-notice ${state.result.code === "undo-conflict" ? "text-warn" : ""}`}
                        role="status"
                      >
                        <Icon
                          name={state.result.code === "undo-conflict" ? "warning" : "check"}
                          size={16}
                          aria-hidden
                        />
                        <span className="flex-1">{notice}</span>
                        {state.journal?.status === "applied" && (
                          <Button size="xs" variant="secondary" onClick={undo}>
                            Undo
                          </Button>
                        )}
                        <IconButton
                          icon="x"
                          aria-label="Dismiss notification"
                          onClick={() => {
                            setMessage("");
                            setState((s: LabState) => ({
                              ...s,
                              result: { ...s.result, code: "ready" },
                            }));
                          }}
                        />
                      </div>
                    )}
                    {configPage && (
                      <>
                        <div className="gp-workspace-toolbar">
                          {isGit ? (
                            repoPicker
                          ) : (
                            <p className="gp-page-intro">
                              Hosts, identity keys, and the configuration they share.
                            </p>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="refresh"
                            onClick={() =>
                              setMessage("Configuration refreshed from the current sample files.")
                            }
                          >
                            Refresh
                          </Button>
                        </div>
                        {(route.variant !== "C" || isGit) && (
                          <div
                            className="gp-tabs"
                            role="tablist"
                            aria-label={isGit ? "Git configuration sections" : "SSH sections"}
                          >
                            {(isGit
                              ? route.variant === "C"
                                ? [
                                    ["identity", "Source files"],
                                    ["rules", "includeIf"],
                                  ]
                                : [
                                    ["identity", "Identity"],
                                    ["rules", "includeIf"],
                                    ["behavior", "Behavior"],
                                    ["all", "All configuration"],
                                  ]
                              : [
                                  ["hosts", "Hosts"],
                                  ["keys", "Keys"],
                                  ["files", "Config files"],
                                ]
                            ).map(([id, label]) => (
                              <button
                                type="button"
                                role="tab"
                                aria-selected={(isGit ? tab : sshTab) === id}
                                key={id}
                                onClick={() => (isGit ? setTab(id) : setSshTab(id))}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                        {isGit ? gitContent() : sshContent()}
                      </>
                    )}
                    {!configPage && existingPage()}
                  </div>
                </div>
              </div>
            </div>
          </main>
          <footer className="shell-footer">
            <span className="inline-flex items-center gap-1.5">
              <span className="shell-dot bg-success" />
              This PC
            </span>
            <span>Ready · Sample configuration</span>
            <span className="ml-auto">6 installations · 6 tools</span>
          </footer>
        </div>
      </div>
      {import.meta.env.DEV && (
        <aside className="gp-variant-switcher" aria-label="Prototype controls">
          <button
            type="button"
            aria-label="Previous layout"
            onClick={() =>
              navigate(
                route.page,
                (["A", "B", "C"] as Variant[])[(["A", "B", "C"].indexOf(route.variant) + 2) % 3],
              )
            }
          >
            ←
          </button>
          <label>
            <span>LAYOUT</span>
            <select
              value={route.variant}
              onChange={(e) => navigate(route.page, e.target.value as Variant)}
            >
              {Object.entries(variants).map(([id, label]) => (
                <option key={id} value={id}>
                  {id} · {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label="Next layout"
            onClick={() =>
              navigate(
                route.page,
                (["A", "B", "C"] as Variant[])[(["A", "B", "C"].indexOf(route.variant) + 1) % 3],
              )
            }
          >
            →
          </button>
          <span className="gp-switcher-divider" />
          <label>
            <span>CASE</span>
            <select
              aria-label="Prototype case"
              value={scenario}
              onChange={(e) => chooseScenario(e.target.value)}
            >
              <option value="normal">Normal edit</option>
              <option value="stale">File changes after preview</option>
              <option value="keep-other">Undo keeps other edits</option>
              <option value="undo-conflict">Undo conflict</option>
              <option value="override">Local overrides global</option>
            </select>
          </label>
        </aside>
      )}
      <Modal
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        title={ruleDraft.ordinal === null ? "Add includeIf rule" : "Edit includeIf rule"}
        size="2xl"
      >
        <div className="gp-dialog-content">
          <p className="text-sm text-muted">
            Load an identity file automatically for matching repositories. This rule is{" "}
            {ruleDraft.ordinal === null ? "appended to" : "edited in place in"} ~/.gitconfig.
          </p>
          <div className="gp-dialog-fields">
            <label className="gp-field-label">
              Match by
              <select
                aria-label="Match by"
                value={ruleDraft.type}
                onChange={(e) =>
                  setRuleDraft({
                    ...ruleDraft,
                    type: e.target.value,
                    pattern:
                      e.target.value === "hasconfig:remote.*.url"
                        ? "git@github.com:example/**"
                        : "E:/Projects/work-demo/",
                  })
                }
              >
                <option value="gitdir/i">Folder · ignore case (gitdir/i)</option>
                <option value="gitdir">Folder · match case (gitdir)</option>
                <option value="hasconfig:remote.*.url">Remote URL (hasconfig)</option>
              </select>
            </label>
            <label className="gp-field-label">
              Include file
              <select
                aria-label="Include file"
                value={ruleDraft.path}
                onChange={(e) => setRuleDraft({ ...ruleDraft, path: e.target.value })}
              >
                <option value={files.work.path}>{files.work.path}</option>
                <option value={files.personal.path}>{files.personal.path}</option>
              </select>
            </label>
          </div>
          <label className="gp-field-label">
            {ruleDraft.type === "hasconfig:remote.*.url" ? "Remote URL pattern" : "Folder pattern"}
            <input
              value={ruleDraft.pattern}
              aria-invalid={Boolean(ruleError)}
              aria-describedby="gp-rule-help"
              onChange={(e) => setRuleDraft({ ...ruleDraft, pattern: e.target.value })}
            />
          </label>
          <p id="gp-rule-help" className={ruleError ? "text-warn text-xs" : "text-muted text-xs"}>
            {ruleError ||
              (ruleDraft.type === "hasconfig:remote.*.url"
                ? "Matches any configured remote URL, not just origin. * stays within a path segment; ** can span folders."
                : "Matches the .git directory. End the folder with / to include repositories below it. Use forward slashes.")}
          </p>
          {ruleProposal && (
            <>
              <div className="gp-rule-code">
                <code>{`[includeIf "${ruleDraft.type}:${ruleDraft.pattern}"]\n    path = ${ruleDraft.path}`}</code>
              </div>
              <h3 className="gp-impact-title">Repository impact preview</h3>
              {ruleImpacts(ruleProposal)}
            </>
          )}
          <div className="gp-note">
            <Icon name="info" size={14} aria-hidden />
            Global rules can affect repositories beyond these two samples.{" "}
            {ruleDraft.type === "hasconfig:remote.*.url"
              ? "The included file must not define remote URLs."
              : "The two sample repositories use ordinary .git directories."}
          </div>
          <div className="gp-dialog-actions">
            <Button
              variant="primary"
              disabled={
                Boolean(ruleError) ||
                !ruleProposal ||
                ruleProposal.beforeText === ruleProposal.afterText
              }
              onClick={reviewRule}
            >
              Review rule changes
            </Button>
            <Button variant="secondary" onClick={() => setRuleOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={isGit ? "Edit Git identity" : "Change SSH identity"}
        size="lg"
      >
        <div className="gp-dialog-content">
          <p className="text-sm text-muted">
            Change this setting in its source file. Review the exact changes before applying.
          </p>
          <label className="gp-field-label">
            Source file
            <input readOnly value={files[state.target.fileId].path} />
          </label>
          <label className="gp-field-label">
            Setting
            <input
              readOnly
              value={`${state.target.key}${state.kind === "ssh" ? ` [${state.target.ordinal + 1}]` : ""}`}
            />
          </label>
          <div className="gp-dialog-fields">
            <label className="gp-field-label">
              Current value
              <input readOnly value={selected?.value || ""} />
            </label>
            <label className="gp-field-label">
              New value
              <input
                value={state.draft}
                onChange={(e) => send("draft", { value: e.target.value })}
              />
            </label>
          </div>
          <div className="gp-note">
            <Icon name="info" size={14} aria-hidden />
            {state.target.fileId === "global"
              ? "Global settings can affect other repositories. Local values may still override this change."
              : "Comments, other settings, and repeated identity entries stay in their source file."}
          </div>
          <div className="gp-dialog-actions">
            <Button
              variant="primary"
              disabled={!state.draft.trim() || state.draft === selected?.value}
              onClick={review}
            >
              Review changes
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review configuration changes"
        size="2xl"
      >
        <div className="gp-dialog-content">
          {plan && (
            <>
              <div className="gp-review-summary">
                <span>
                  <strong>{plan.kind === "rule" ? "includeIf rule" : plan.target.key}</strong>
                  <small>{files[plan.target.fileId].path}</small>
                </span>
                <Pill>{files[plan.target.fileId].scope}</Pill>
              </div>
              {stale && (
                <div className="gp-conflict" role="alert">
                  <Icon name="warning" size={18} aria-hidden />
                  <div>
                    <strong>The file changed after this preview.</strong>
                    <p>Nothing has been written. Refresh the preview to review the current file.</p>
                    <Button size="xs" variant="secondary" onClick={() => send("preview")}>
                      Refresh preview
                    </Button>
                  </div>
                </div>
              )}
              {plan.kind === "rule" ? (
                ruleImpacts(plan)
              ) : (
                <div className="gp-review-effect">
                  <span>
                    Before <code>{plan.beforeEffective}</code>
                  </span>
                  <span>
                    After <code>{plan.afterEffective}</code>
                  </span>
                  {plan.beforeEffective === plan.afterEffective && (
                    <p className="text-warn">
                      The effective value is unchanged. This repository has an override.
                    </p>
                  )}
                </div>
              )}
              <div className="gp-review-diff">
                {[
                  ["Before", plan.beforeText],
                  ["After", plan.afterText],
                ].map(([label, text]) => (
                  <section key={label}>
                    <h3>{label}</h3>
                    <pre>
                      {P.lines(text).map((line: { body: string; index: number }) => (
                        <span
                          className={
                            line.index >= plan.line && line.index <= (plan.endLine ?? plan.line)
                              ? label === "Before"
                                ? "gp-line-old"
                                : "gp-line-new"
                              : ""
                          }
                          key={line.index}
                        >
                          <i>{line.index + 1}</i>
                          {line.body.replace(/^\uFEFF/, "") || " "}
                        </span>
                      ))}
                    </pre>
                  </section>
                ))}
              </div>
              <div className="gp-dialog-actions">
                <Button variant="primary" disabled={Boolean(stale)} onClick={apply}>
                  Apply changes
                </Button>
                <Button variant="secondary" onClick={() => setReviewOpen(false)}>
                  Cancel
                </Button>
                <span className="ml-auto text-xs text-muted">
                  Sample files only · Undo available after Apply
                </span>
              </div>
            </>
          )}
        </div>
      </Modal>
    </ThemeContext.Provider>
  );
}
