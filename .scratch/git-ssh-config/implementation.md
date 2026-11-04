# Git config and SSH implementation evidence

Status: resolved
Date: 2026-11-03
Branch: `codex/git-ssh-config-prototype`
Review baseline: `1782fc2`
Implementation: `a688a13`; reviewed fixes: `58452b8`, `4bfcecb`, `12dbebe`.

## Delivered tickets

| Ticket | Result |
| --- | --- |
| [01 — Git inspection](issues/01-git-inspection.md) | Production navigation and injected configuration service; native Git scopes, ordered occurrences, origins, identity, included sources, worktrees, capability/trust diagnostics, executable selection, and persistent recent repositories. |
| [02 — Git value edits](issues/02-git-value-edits.md) | Existing name/email/SSH-command occurrences support source diff, bound preview, guarded publication, effective readback, minimal encrypted journal, and selective latest-operation Undo. |
| [03 — Conditional includes](issues/03-conditional-include-rules.md) | Add/edit supported global rules; folder/file pickers; exact gitdir/gitdir/i text; debounced impact preview; native temporary copies; explicit coverage and unresolved reasons. |
| [04 — SSH inspection](issues/04-ssh-inspection.md) | Git command/client precedence, manual client choice, distinct client homes, static Host/Include/Match evidence, ordered identities, public-key fingerprints and missing/unreferenced references. |
| [05 — IdentityFile edits](issues/05-ssh-identityfile-edit.md) | One physical IdentityFile occurrence through the shared plan/apply/readback/Undo contract, preserving other candidates and source bytes. |
| [06 — Refresh and recovery](issues/06-cross-workspace-and-recovery.md) | Shared write admission, context invalidation, late-result rejection, cross-workspace refresh, startup recovery, prior-success preservation after a failed attempt, and minimum-window/accessibility checks. |

## Verification

The final production code passed:

| Check | Evidence |
| --- | --- |
| `npm run build` | TypeScript and production Vite build passed. |
| `node node_modules/vitest/vitest.mjs run --project=unit --reporter=dot --silent` | 80 files, 612 tests passed, including frontend architecture checks and 7 configuration UI flows. |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib --quiet` | 307 passed, 0 failed; 20 existing machine-contract tests remain explicitly ignored. Includes 28 new configuration API tests and Rust architecture checks. |
| `WHICHCRAFT_BROWSER_CHANNEL=msedge` with the Storybook Vitest project | 30 files, 119 stories passed, including axe checks and 7 new dark/light configuration states. |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings` | Passed. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Passed. |
| `biome lint src` | Exit 0, no errors. Five existing prototype warnings and sixteen informational diagnostics remain. The prototype's invalid ARIA container was changed to a named section. |
| Screenshots and keyboard checks | Git, SSH and review states inspected at 1400×900 and 900×600, including light/dark and reduced motion. No horizontal document overflow; modal focus remained inside the dialog. Workspace content uses the existing scroll surface. Local screenshots are in ignored `temp/git-ssh-qa/`. |

The optional, stricter `cargo clippy --all-targets -- -D warnings` exposed existing test-only lints in `layer_tests.rs`, `uninstall.rs`, and the old adapter contracts. Those unrelated tests were not rewritten or blanket-suppressed. The production lint check above is green.

API scenarios use owned temporary repositories and explicit isolated HOME/system/global/XDG environments. They cover native include order and all four remote forms, non-origin remotes, local overrides, linked worktrees, file bytes and duplicate occurrences, stale contexts and every previewed repository, ACL preservation, locked targets, external writes at the commit boundary, redaction, public keys with the private file locked, interrupted operations, restart Undo, failed publication/readback/journal completion, and the prior successful operation after a failed attempt. A controlled static SSH fixture is compared with the identified native client; fixtures containing Match exec are never passed to SSH.

Native tools used: Git `2.56.0.windows.3` and Windows OpenSSH `9.5p2` / LibreSSL `3.8.2`. Older Git capability and dubious-ownership refusal cases use process-boundary fakes; an older executable was not installed or counted as tested. No authentication, real configuration edits, credential-store reads, private-key reads, agent changes, or known_hosts changes were performed for validation.

## Guarded publication and resolution limits

Publication holds a Windows transacted file handle through comparison and the staged write, then commits atomically. It preserves the existing file identity, owner and ACL. A controlled API test attempts both a direct write and an atomic pathname replacement at that boundary; both are refused while the guard is held. This follows the isolation and pinned-path behavior described in [Microsoft's transactional file I/O considerations](https://learn.microsoft.com/en-us/windows/win32/fileio/programming-considerations-for-transacted-fileio-).

[TxF is a legacy Windows capability that may not be available in future Windows versions](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createfiletransactedw). A filesystem that cannot supply a transactional guard refuses publication; there is no unguarded replacement fallback. Protected, redirected, encrypted, malformed or unsupported sources are read-only or report the relevant publication failure. A different guarded adapter will be needed if Windows stops providing this capability.

Dynamic SSH Match conditions remain unresolved. Configuration evidence does not establish authentication success. Impact preview is unresolved for local-source edits and for a global source also loaded through a repository-local/worktree chain, rather than presenting an inaccurate verified result. Preview coverage includes only the current and remembered repositories.

Both review axes and their resolutions are recorded in [review.md](review.md).

## Final validation after rebase and review fixes — 2026-11-05

All six implementation tickets remain resolved on `codex/git-ssh-config-prototype`, rebased onto main `843f0e1`. The pending review fixes were verified against branch HEAD `ca823c9` before committing.

The final implementation identifies repository-local sources at their native paths, lists conditional rules in declaration order, and asks native Git about each rule separately across global, system, local and worktree sources. A root first encountered through an inactive include still participates when native Git loads it independently. Command-scope remote URLs are evaluated before transport redaction. Remote-URL include plans reject direct and nested remote declarations, including conditional nested includes, legacy subsection syntax and empty remote names, even without repository coverage.

SSH inspection follows the selected client's Include base for alternate -F files, resolves relative IdentityFile references from Git's working directory, and treats GIT_SSH as a single executable path. Include globs skip recognized private-key files after a bounded header check. Failed publication with verified unchanged bytes reports failure and preserves the preceding successful Undo; genuinely uncertain publication/readback remains recoverable.

Fresh verification of the final product code:

| Check | Result |
| --- | --- |
| `npm run build` | TypeScript and production build passed. Existing Hozo dynamic-class and Vite bundle-size warnings remain. |
| `npm test -- --run --reporter=dot --silent=true` | 80 files, 623 tests passed. |
| `cargo +1.99.1 test --manifest-path src-tauri/Cargo.toml --lib --quiet` | 327 passed, 0 failed, 20 explicitly ignored machine-contract tests. |
| Storybook Vitest with `WHICHCRAFT_BROWSER_CHANNEL=msedge` | 30 files, 119 tests passed, including interaction and accessibility cases. |
| `npm run lint` | Exit 0; 7 existing warnings and 16 informational diagnostics, no errors. |
| Installed stable `rustfmt --edition 2021 --check src-tauri/src/lib.rs` | Passed, including recursive modules. |
| Installed stable Clippy/Rustc pair, `--lib -- -D warnings` | Passed, using Cargo 1.99.1 and an isolated target directory so compiler versions do not mix. |
| `git diff --check` | Passed. |

The three additional API regressions added during this completion pass each failed before its corresponding fix and passed afterward, using the spec-confirmed application API seam: non-global shared-target rules; credential-bearing command remotes before redaction; and a native local root discovered through an inactive include. Earlier independent review probes were temporary and are not counted in the 327 product-suite tests above. Existing minimum-window visual evidence remains the dated evidence above; no new screenshot pass is claimed here.

Final independent code-review results are recorded in [review.md](review.md).

## Workspace editor visibility fix — 2026-11-05

Git value and includeIf editors now render only in Git config; SSH IdentityFile editors render only in SSH. Navigating away hides the editor and its review dialog while preserving the draft for the return trip. A delayed Preview response cannot open the other workspace's review dialog. Returning to a ready review keeps keyboard focus inside the dialog; neither editor autofocus nor the shell heading takes it away.

The real-shell navigation regressions failed before the fix and pass afterward. Fresh checks: 80 frontend files / 625 tests passed; Configuration Storybook 7 tests passed; lint for all three changed source/test files and git diff --check passed. Tauri debug build (including TypeScript and Vite) passed. Independent Standards and Spec re-reviews each returned 0 findings. Backend behavior is unchanged; the Rust suite was not rerun for this UI-only fix.

## Default global identity edit fix — 2026-11-05

Native Git reports the default Windows HOME/.gitconfig origin with forward slashes, while the collected document may use backslashes. String equality failed to bind the occurrence to its source, leaving user.name and user.email incorrectly marked Inspection only. Binding now uses Path equality and retains the matched document's source spelling for planning and readback; source writability and protected-source restrictions remain authoritative.

A public API regression with isolated HOME/.gitconfig and no GIT_CONFIG_GLOBAL override failed before the fix and passes afterward. It covers both name and email through inspection, Preview without writes, Apply, verified readback and exact-byte Undo. Fresh Rust suite: 328 passed, 0 failed, 20 explicitly ignored. Recursive rustfmt check and git diff --check passed. Tauri debug build, including TypeScript and Vite, passed. Standards and Spec re-reviews each returned 0 findings. No real user configuration was edited during validation.

## Squash integration verification — 2026-11-05

The feature snapshot b5bf2c4 was applied to main baseline 843f0e1 with squash semantics; before integration-only documentation changes, the staged tree exactly matched the feature branch. README, DESIGN, a new docs/configuration.md guide, historical requirements pointers, all six landing-page languages, FAQ/structured data, metadata and llms.txt now cover the delivered Git/SSH feature and limits. Optional NSIS application-data deletion also removes the new configuration-operation journal.

Fresh validation on main: 625 frontend tests passed; Rust library suite 328 passed with 20 explicitly ignored machine-contract tests; application TypeScript/production build and lint passed (7 existing warnings, 16 informational diagnostics); website TypeScript check and static build passed for all six locales. All 13 browser checks passed using installed Edge through WHICHCRAFT_BROWSER_CHANNEL=msedge, including responsive layouts at 320/375/768/1024/1280 pixels, navigation, FAQ/structured data, no-JavaScript content and the Open Graph image. Desktop/mobile feature screenshots were inspected. Local documentation links were verified. Standards and Spec reviews have 0 unresolved findings. Native installer uninstall was not executed during this integration check.
