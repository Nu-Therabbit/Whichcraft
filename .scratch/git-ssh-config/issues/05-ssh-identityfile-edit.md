# SSH IdentityFile edit

Status: resolved
Type: task
Spec: [Git config and SSH workspaces](../spec.md)
Blocked by: 02, 04

## Outcome

The user can edit one existing IdentityFile occurrence in a writable user SSH source or included user file, through the shared plan, apply, readback, and Undo path from ticket 02.

User stories: 39, 42, 51–56, 58–60.

## Acceptance

- Only the chosen occurrence's path span changes; other IdentityFile candidates, comments, and the rest of the Host block are untouched.
- Complex blocks the editor cannot change reliably, system SSH sources, and other directives stay read-only with an explanation.
- The SSH config keeps its owner and ACL after Apply and Undo, so Windows OpenSSH still accepts it.
- Undo is the same single latest configuration operation as Git edits: an SSH edit after a Git edit replaces it as the undoable operation.
- API tests cover the SSH edit, its preservation bytes, the ACL check, and Undo conflicts. A focused UI test covers the edit through apply and undo.

## Comments

- 2026-11-03: Split from the original single implementation ticket during spec review.

- 2026-11-03: Implemented and verified. One existing IdentityFile occurrence can be reviewed, applied and undone through the shared source-preserving configuration operation path. See [implementation evidence](../implementation.md) and [two-axis review](../review.md). All declared dependencies are resolved.
