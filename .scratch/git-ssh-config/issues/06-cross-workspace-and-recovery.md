# Cross-workspace refresh and interrupted-operation recovery

Status: resolved
Type: task
Spec: [Git config and SSH workspaces](../spec.md)
Blocked by: 03, 05

## Outcome

Git config and SSH describe the same current files after any change, executable and environment changes invalidate dependent plans, and a configuration operation interrupted by an app stop is recognized on the next launch.

User stories: 48, 54, 57, 61, 66.

## Acceptance

- Changing an SSH key reference refreshes Git's explanation; changing Git's SSH command does not alter the SSH host file.
- Executable or environment changes from the Tools and Environment workspaces invalidate configuration plans through the existing coordinator invalidation, and late reads for an old repository do not replace current results.
- At startup, a pending journal entry is classified as before, after, or unexpected by inspecting current bytes, never by overwriting them. The result appears in a recovery banner that follows the Environment recovery banner's pattern.
- Configuration operations leave Tool Installation Selection and Tool Profiles unchanged.
- API tests cover the cross-workspace/API cases and restart classification in the spec. A focused UI test covers the recovery banner.
- Final pass: dark/light themes, keyboard and focus, dialog scrolling at 900×600, Storybook/axe checks after transitions settle, and the full frontend, architecture, and Rust check suites. Unavailable native capabilities are reported, not counted as passed.

## Comments

- 2026-11-03: Split from the original single implementation ticket during spec review.

- 2026-11-03: Implemented and verified. Shared write admission, cross-workspace invalidation, late-result protection, startup recovery and final UI/API checks are implemented. See [implementation evidence](../implementation.md) and [two-axis review](../review.md). All declared dependencies are resolved.
