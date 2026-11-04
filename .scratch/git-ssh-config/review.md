# Git / SSH implementation review

Date: 2026-11-03
Baseline: `1782fc2`; implementation: `a688a13`.
Method: the code-review skill's independent Standards and Spec reviewers, followed by focused verification of the fixes.

## Standards

Initial review findings, lightly condensed:

- **[P1] Preserve external edits through publication.** The old final byte/ACL comparison ended before ReplaceFileW without holding a target operation guard. An intervening external edit could be overwritten, conflicting with ADR-0007.
- **[P2] Complete the prescribed MVI boundary.** ADR-0005 calls for one immutable state and typed user intents. Workspace tabs/host selection lived in a separate reducer and the view received many imperative controller methods.
- **Possible Primitive Obsession, judgment only.** Journal edit kind, status and action used arbitrary strings; unsupported persisted states were not rejected by deserialization.

Re-review of `58452b8` found the publication and MVI findings resolved: the transacted target handle spans the comparison/staged write, and a boundary test refuses direct and atomic external writers; unsupported filesystems fail closed. Tabs, host, context, drafts and results share one immutable state and a single typed dispatch boundary. Durable edit/action/status values use serde enums. String transport classifications remain a non-blocking modeling choice.

**Standards: 0 unresolved documented-standard findings; 0 blocking smell findings.**

## Spec

Initial and follow-up findings:

- **[P1] Sensitive include conditions leaked.** Rule condition/target fields were not included in backend sanitization, violating “Redact in the backend before data crosses the transport.”
- **[P1] Other repositories did not invalidate plans before writing.** Only the selected repository's inspection was retained, violating binding to “all context/files that determine its diff and impact.”
- **[P2] Shared include files could produce falsely verified previews.** A file loaded through both global and local chains still used live bytes for the local read, contradicting results equal to native Git after Apply.
- **[P2] Windows SSH used Git's home for tilde expansion.** Generic HOME-first resolution conflicted with the distinct Windows/Git client file contexts.
- **[P2] A failed attempt destroyed the prior successful Undo.** Replacing the sole journal before publication contradicted Undo for the “latest successful configuration operation.”
- **[P2] Git-command identity files were absent from key inventory.** References supplied by `-i`/`-oIdentityFile` were shown in host values but omitted from Keys, contrary to the combined Git command/key-reference evidence requirement.

Re-review confirmed the first five fixes in `58452b8`: sensitive rules are redacted/read-only; all previewed repository inspections are checked before publication; shared local/global chains are explicitly unresolved; selected-client homes govern tilde expansion; and a failed-before attempt restores the prior minimal successful operation after acknowledgment.

Focused review confirmed `4bfcecb` fixes command-derived key inventory, including paths outside `.ssh`, repository-relative paths, canonical references, and public metadata without opening private files. No material scope creep was found.

Focused review of `12dbebe` found no material regression in separating completed publication from failed completion-journal/readback verification, including Undo recovery without a second Undo.

**Spec: all 6 findings resolved; 0 unresolved material findings.**

The worst initial Standards issue was the publication race; the worst initial Spec issue was backend secret leakage. Both axes now have no unresolved blocking finding. Full validation and intentional capability limits are recorded separately in [implementation.md](implementation.md).

## Final review after rebase — 2026-11-05

Baseline: main `843f0e1`; reviewed branch HEAD `ca823c9` plus the pending implementation fixes. Independent Standards and Spec agents reviewed the committed feature and pending changes, then reviewed the follow-up fixes.

### Standards

0 documented-standard findings; 0 actionable smell findings. I/O stays behind ConfigurationIo, application services orchestrate native evaluation and guarded operations, and React retains the shared immutable state and typed intent boundary. The shared redirected-file helpers serve inspection and preview without duplicating their rewriting logic.

### Spec

The review identified two remaining P2 cases in conditional-rule inspection: non-global sources still inferred activity from a shared target, and a local root first discovered through an inactive global include was omitted from the native replay. API regressions reproduced each failure. Native replay now covers each inspected scope and selects roots from native scope evidence. A further API regression confirms that command-scope remote URLs are matched before redaction while the returned inspection contains no credentials.

Re-review: 0 unresolved material findings; no material scope creep. The preceding fixes for recursive hasconfig restrictions, rule order, SSH paths/client command selection and failed-publication outcomes remain covered by the application acceptance suite.

Final results: Standards 0 unresolved findings; Spec 0 unresolved findings. No outstanding severity on either axis. Fresh build, test and lint evidence is in [implementation.md](implementation.md).

## Workspace editor visibility review — 2026-11-05

Baseline: 64a03bb. Reviewed the draft-to-workspace rendering boundary, delayed Preview responses, draft retention on return, and modal focus during shell navigation. Independent Standards review: 0 findings. Independent Spec review: 0 findings. Follow-up review of the editor/heading focus guards also found 0 findings on either axis. UI regressions cover Git identity/includeIf to SSH and SSH IdentityFile to Git, plus delayed review and keyboard focus.

## Default global identity edit review — 2026-11-05

Baseline: 80a85d3. Reviewed native Windows origin-to-document Path matching and consistent source identity through planning and readback. The API regression uses default HOME/.gitconfig discovery instead of an explicit GIT_CONFIG_GLOBAL override and verifies both editable identity fields through Apply and Undo. Standards: 0 findings. Spec: 0 findings; the fix restores story 18 without expanding write permissions.
