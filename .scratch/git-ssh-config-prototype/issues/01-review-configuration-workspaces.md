# Review Git / SSH configuration in Whichcraft's shell

Status: resolved
Type: prototype
Branch: `codex/git-ssh-config-prototype`

## Question

Do dedicated Git config / SSH workspaces belong between Environment and Developer tools, and which of the three content hierarchies makes the setting's scope and source easiest to understand?

## Prototype

- Run `npm run prototype:git-ssh`.
- Start at Git config, then use SSH in the sidebar and the Git card's Configure Git link.
- Switch A/B/C using the bottom development bar; URL `variant` retains the selected layout.
- Edit a value, review its source-file diff, Apply, then Undo. CASE options let you observe stale previews and conflicting edits without changing machine configuration.
- In Git config → includeIf, add/edit remote URL or folder rules and inspect matches plus effective identities for both sample repositories before reviewing the file diff.
- Implementation and verification notes: [spec.md](../spec.md).

## Observed result

The fixture model demonstrates targeted changes, conservative snapshot validation, selective Undo and visible local overrides inside a Whichcraft-style shell. It does not validate a production parser or disk writer. The user selected **A · Workspace** as the preferred layout. Production scope is now captured in the [implementation specification](../../git-ssh-config/spec.md); the prototype itself does not choose a fork or upstream dependency.

## Selected direction

- Use **A · Workspace** as the layout baseline: Git identity/authentication cards beside source precedence; SSH host list beside connection/identity details.
- Keep B/C on the prototype branch as comparison references.

## Answer

The open product questions were settled in the [production specification](../../git-ssh-config/spec.md):

- **Placement:** dedicated Git config and SSH workspaces under Configuration, between Environment and Developer tools, with a link from the Git Developer Tool.
- **Initial actions:** edit existing `user.name`, `user.email`, `core.sshCommand`, and one SSH IdentityFile occurrence; create and edit includeIf rules with remote URL, `gitdir`, and `gitdir/i` conditions. Everything else is inspection-only.
- **Review before Apply:** the source diff alone is not enough. Review also shows exact target and scope, predicted effective result, and, for rules, a per-repository Impact Preview evaluated by native Git and labeled verified or unresolved.

## Comments

- 2026-11-03: User requested a prototype on a new branch, then clarified that it should look like Whichcraft so the placement and UI are visible. Main preview changed from a standalone logic lab to the shell-based UI above.
- Prototype code is throwaway and captured on the branch named above. Production navigation and machine configuration are unchanged.
- 2026-11-03: Added includeIf creation/editing and per-repository impact preview at the user's request. Native Git 2.56.0.windows.3 confirmed remote/folder/case-insensitive conditions, ordered includes and local overrides in isolated temporary repositories. The UI still changes fictional files in memory; its limited matcher is not a production resolver. See spec for limits and browser evidence.
- 2026-11-03: User: "ชอบ A". Recorded A · Workspace as the preferred layout for subsequent work.
- 2026-11-03: User invoked to-spec. Published the [production specification](../../git-ssh-config/spec.md) and [implementation issue](../../git-ssh-config/issues/01-git-inspection.md) as ready-for-agent, using A and the confirmed API-first testing seam.
- 2026-11-03: Spec review. The implementation issue was split into six tickets under `.scratch/git-ssh-config/issues/`, the link above now points to the first. Recorded the answers to the open product decisions and marked this review resolved.
