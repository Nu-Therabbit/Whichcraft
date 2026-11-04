# Git inspection in the Git config workspace

Status: resolved
Type: task
Spec: [Git config and SSH workspaces](../spec.md)
Prototype branch: `codex/git-ssh-config-prototype`

## Outcome

Git config is reachable in the real desktop shell under Configuration and shows, read-only, what Git configuration supplies for a chosen repository: commit identity with per-field origins, the source chain in read order, included files, local and worktree effects, multivalue settings, and the Behavior and All configuration views, using layout A. This ticket also creates the configuration feature contract that later tickets extend.

User stories: 1–17, 20, 49, 62–68 (Git parts only). The spec is the source of truth for behavior; this ticket only bounds the slice.

## Acceptance

- Configuration → Git config sits between Environment and Developer tools, and the Git Developer Tool links to it. The workspace mounts real injected services, not prototype fixtures.
- A narrow configuration service is added to application composition with a transport adapter and a fake, following the AppServices pattern. Rust follows ADR-0005 layers; Tauri commands only translate and delegate.
- The Git executable defaults to Git's Effective Installation, and the context bar can pick another discovered Git Tool Installation without changing the Selection. Capability gating follows the spec (2.36 remote-URL conditions, 2.32 impact preview).
- Folder selection plus the recent-repository list in `WhichcraftSettings`: paths only, capped at 20, removable, missing paths shown as unavailable.
- A repository refused for dubious ownership is explained with its owner and a copyable `safe.directory` command; global, system, and included sources still display; nothing writes `safe.directory`.
- Values come from native Git without pager, helpers, aliases, SSH, hooks, filters, or editors. Unset, explicit, default, and process-override values are distinct; multivalue order and resets are kept.
- Secret redaction happens in the backend using rules extended from `src/lib/secrets.ts`.
- Every edit control in this slice is absent or disabled with a read-only explanation.
- API tests against isolated temporary HOME/global/system/XDG fixtures cover the Git acceptance corpus items about reading (precedence, origins, includes, worktrees, helpers with resets, alternate locations, dubious ownership, capability gating). Focused UI tests cover navigation, repository selection, and identity origins.

## Not in this ticket

Any write, includeIf rule listing or authoring (ticket 03), and SSH (ticket 04).

## Comments

- 2026-11-03: Synthesized from the conversation using to-spec after the user selected A and requested includeIf. Published directly as ready-for-agent per the invoked skill.
- 2026-11-03: The user confirmed API-first testing plus important UI flows.
- 2026-11-03: Spec review. The single implementation ticket was split into six slices at the user's request; this file is slice 01.

- 2026-11-03: Implemented and verified. Production Git inspection, repository/executable context and remembered repositories are implemented through injected services and native Git. See [implementation evidence](../implementation.md) and [two-axis review](../review.md). All declared dependencies are resolved.
