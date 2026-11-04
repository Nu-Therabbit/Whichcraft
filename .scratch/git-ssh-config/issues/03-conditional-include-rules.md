# Conditional include rules and impact preview

Status: resolved
Type: task
Spec: [Git config and SSH workspaces](../spec.md)
Blocked by: 02

## Outcome

The includeIf section lists every conditional include in declaration order, and the user can create a rule in a global file or edit a supported rule in place. Before Apply, the user sees per-repository match status and before/after identity, evaluated by native Git.

User stories: 21–36.

## Acceptance

- Rules show condition, include path, and declaring source. Unsupported conditions and includeIf rules in local configuration are preserved and read-only.
- Creation appends to the chosen global file with an ordering warning. The default target follows the spec (`~/.gitconfig` when both it and the XDG file exist; `GIT_CONFIG_GLOBAL` when set). Include targets must already exist; nothing creates identity files.
- Forms support `hasconfig:remote.*.url`, `gitdir`, and `gitdir/i`. The remote-URL condition is hidden below Git 2.36.
- The folder picker converts to an absolute forward-slash pattern with a trailing slash, defaulting to `gitdir/i`, and shows the exact text written. Editing an existing rule without a trailing slash warns but does not change it.
- Impact preview uses the temporary-copy strategy in the spec: Whichcraft-owned temp folder, relative and `./` paths made absolute, `GIT_CONFIG_GLOBAL` pointed at the copy, declaring chain copied for included-file edits, origins mapped back to the original files. Preview creates no files in the user's folders.
- Results are `verified` or `unresolved` with a reason, never an unlabeled approximation. Matching and changed effective email are separate facts.
- Preview covers the current repository and the recent-repository list, and states that unlisted repositories may be affected.
- API tests cover the impact preview corpus and the rule parts of the Git acceptance corpus (all four remote URL forms, non-origin remotes, multiple matches in order, hasconfig target restrictions, folder boundaries and case, local override after a match). Focused UI tests cover a rule match with a local override through apply and undo.

## Comments

- 2026-11-03: Split from the original single implementation ticket during spec review.

- 2026-11-03: Implemented and verified. Global includeIf creation/editing, folder/file pickers and native per-repository impact previews are implemented, with explicit unresolved coverage where required. See [implementation evidence](../implementation.md) and [two-axis review](../review.md). All declared dependencies are resolved.
