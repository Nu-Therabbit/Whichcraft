# Git / SSH configuration — throwaway Whichcraft UI prototype

Branch: `codex/git-ssh-config-prototype`

## Question

Where should Git configuration and SSH live in Whichcraft, and does the edit → review → apply → undo flow make sense next to the existing Tools, Tool profiles and Environment workspaces?

The user asked to see the feature in Whichcraft's actual visual context. This UI prototype replaces the standalone logic lab as the main preview. It does not decide whether to fork an upstream project or implement a production document engine.

## Run

```powershell
npm run prototype:git-ssh
```

This opens `http://127.0.0.1:4187/.scratch/git-ssh-config-prototype/index.html?page=git-config`.

The development entry is [.scratch/git-ssh-config-prototype/index.html](index.html), which mounts [WhichcraftGitSshPrototype](../../src/features/git-config/prototype/WhichcraftGitSshPrototype.tsx). It is not imported by the production app entry.

## What is real and what is simulated

- Uses the real `src/index.css` shell tokens/classes, Whichcraft artwork, ToolLogo, Button, IconButton and Modal components.
- The throwaway frame mirrors the actual DesktopShellApp structure. Its sidebar/navigation is a prototype copy, so the production router/sidebar remains unchanged.
- Adds **Configuration → Git config / SSH** between Environment and Developer tools. Git's sample tool card also links to Git config.
- Existing Tools/Profiles/Environment/Settings destinations show sample context, sufficient to judge placement. They are not fully functional copies of the existing workspaces.
- Git and SSH files are fictional Unicode text fixtures stored in React memory. No Tauri services, Git/SSH processes, registry, real files, keys, credentials or network authentication are used.
- The prototype model recognizes only the fixture grammar. It is not a production Git/OpenSSH parser/resolver.
- Refreshing the page resets state. Theme changes are in-memory. No configuration changes are persisted.

## Three layouts

Selected direction: the user prefers **A · Workspace** (2026-11-03). Use A as the baseline for subsequent design and implementation; B/C remain comparison references on this prototype branch.

Shareable via `?page=git-config|ssh&variant=A|B|C`. The floating development-only switcher cycles layouts with buttons or left/right keys when not editing a control.

| Variant | Git | SSH |
| --- | --- | --- |
| A · Workspace | Identity/authentication cards beside source precedence | Host list beside connection/identity details |
| B · Repository / identity first | Repository comparison before the selected identity/source details | Key inventory before the selected host details |
| C · Source files | Physical config-file list and editable lines | Physical SSH files and editable IdentityFile lines |

## Functional fixture flows

- Choose a repository or SSH host, inspect source files and the values currently in effect.
- Edit an existing identity/email/name/SSH-command or IdentityFile value through a modal.
- Review exact before/after text before applying. The fixture patch keeps untouched text, comments, repeated entries, BOM and CRLF.
- Apply checks that the reviewed full-file snapshot still matches. A stale preview blocks Apply until explicitly refreshed.
- Undo targets the latest applied record, preserving unrelated later edits. Changed value/context or ambiguous repeated records blocks Undo rather than restoring a whole file.
- Git local overrides remain visible after a global edit. Git's SSH reference reflects changes made in the SSH workspace.
- The **includeIf** tab lists conditional includes in declaration order and the sample repositories that match each rule. Available in all three layouts; direct link: `?page=git-config&tab=rules&variant=A`.
- Add a rule at the end of the sample global file, or edit a rule's condition and include path in place. Supports remote URL (`hasconfig:remote.*.url`), absolute folder (`gitdir`) and case-insensitive folder (`gitdir/i`) conditions. Include targets are the two existing sample identity files.
- Rule editing shows live per-repository match status, effective name/email before and after, local email overrides, then the exact source diff before Apply. Multiple matching rules follow declaration order.
- Rule Apply rejects stale snapshots; Undo removes/reverts only the exact rule chunk, preserving unrelated additions and refusing changed or ambiguous chunks.
- Key reference lists are derived from the fixture text; the key metadata itself is a static sample inventory.

Development CASE options: normal edit; file changes after preview; unrelated edits after Apply; same-record edit before Undo; local override of global.

## Verification and limits

- `npm run build`: passed (existing chunk-size and dynamic-class notices).
- `npx tsc --noEmit`: passed after the final prototype changes.
- `npx biome lint src/features/git-config/prototype`: passed.
- Browser walkthroughs checked normal Apply/Undo, stale preview + refresh, Undo conflict, keeping unrelated edits and local override. No JavaScript page errors observed.
- Checked layouts A/B/C at 1440×900 and 900×600. No page-width overflow at the application minimum.
- Accessibility checks must run after the existing page/theme transitions settle; an initial check during transitions produced contrast findings that disappeared at steady state.
- At steady state, axe reported no WCAG A/AA violations in Git/SSH × A/B/C × light/dark (12 views). This is automated review evidence, not a complete accessibility certification.
- No new automated test suite is added for this throwaway prototype. Browser interaction checks are review evidence, not production acceptance.
- The pure in-memory model does not prove filesystem atomicity, NTFS ACLs, crash recovery, full include/Match semantics or end-to-end authentication. These remain implementation questions.
- includeIf verification: native `git version 2.56.0.windows.3` passed remote URL, `gitdir`, `gitdir/i`, multiple matching includes in file order, and local email override scenarios in temporary repositories. The subprocess used an isolated HOME/global file with system config disabled; machine configuration was not changed. Reference: [Git conditional includes](https://git-scm.com/docs/git-config#_conditional_includes).
- Browser walkthroughs passed rule creation/editing, live impact, Apply/Undo, stale refresh, keeping unrelated edits and Undo conflicts. No page errors. The includeIf list and creation dialog passed axe WCAG A/AA checks in A/B/C × light/dark (12 states); checked 900×600 for page overflow and modal controls.
- The fixture matcher accepts simple `*`, `?`, and whole-segment `**` patterns; folder rules require absolute forward-slash paths. It does not implement `onbranch`, relative/home directory conditions, worktrees, symlink resolution, arbitrary include paths or full Git wildcard syntax. Production effective-value resolution must use native Git in the selected repository context, rather than promote this matcher.

The earlier standalone [logic lab](../../src/features/git-config/git-ssh-prototype.html) stays on this prototype branch as a secondary state-model reference; it is not the main UI to review.

## Context

- [Deep dives on the five upstream projects](../git-config/deep-dive/README.md) remain local research notes from the preceding work.
- [Review issue](issues/01-review-configuration-workspaces.md) records the branch and the open product questions.
