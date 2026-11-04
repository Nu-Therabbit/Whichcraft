# Git value edits with plan, apply, and Undo

Status: resolved
Type: task
Spec: [Git config and SSH workspaces](../spec.md)
Blocked by: 01

## Outcome

The user can edit an existing `user.name`, `user.email`, or `core.sshCommand` occurrence in a writable user global, local, or included file through edit → preview → apply → read back → undo. This ticket builds the shared write path that ticket 03 and ticket 05 reuse: the source-preserving writer, plan binding, publication, readback, the configuration operation journal, and Undo.

User stories: 18–20, 51–56, 58–60, 62.

## Acceptance

- Plans are bound to source occurrences, executable, environment, repository, and file revisions. Any change invalidates the plan, and a refreshed preview never retargets a different occurrence.
- The writer changes only the intended value span and keeps untouched bytes, BOM, comments, blank lines, LF/CRLF/mixed endings, duplicates, and unknown entries. Unsupported encodings and malformed constructs are read-only.
- Configuration writes join the write coordinator's single active write; a running configuration write refuses Environment and Tools writes and the reverse.
- Publication keeps the target's owner and ACL; inheriting the folder's ACL is a failure.
- Write failure, readback failure, and success are reported separately. An unexpected readback never triggers a whole-file restore.
- The journal is written before publication and holds only the edit, not unrelated file content. Undo covers the latest configuration operation, survives a restart, is one level only, preserves unrelated later edits, and stops on a changed or ambiguous target.
- System and worktree sources stay read-only with an explanation.
- API tests cover the file-preservation and failure cases in the spec, including the ACL check, plus stale-plan, repeated-Apply, and Undo-conflict cases. Focused UI tests cover an identity edit through review, cancel, apply, undo, and a conflict with explicit refresh.

## Not in this ticket

Startup detection of interrupted operations and the recovery banner (ticket 06). The journal format must already allow that detection.

## Comments

- 2026-11-03: Split from the original single implementation ticket during spec review.

- 2026-11-03: Implemented and verified. Existing Git value edits now use bound plans, guarded atomic publication, native readback, protected minimal journaling and selective Undo. See [implementation evidence](../implementation.md) and [two-axis review](../review.md). All declared dependencies are resolved.
