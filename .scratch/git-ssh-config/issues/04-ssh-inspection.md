# SSH inspection in the SSH workspace

Status: resolved
Type: task
Spec: [Git config and SSH workspaces](../spec.md)
Blocked by: 01

## Outcome

Configuration → SSH shows, read-only and in layout A, the host list beside connection details and ordered IdentityFile references, plus the Keys and Config files sections. The workspace starts from the SSH client Git would use and never executes configuration.

User stories: 37–41, 43–50, 62–65 (SSH parts).

## Acceptance

- Configuration → SSH sits after Git config in the real desktop navigation and uses the configuration service from ticket 01, not prototype fixtures.
- The client is chosen from `GIT_SSH_COMMAND`, `core.sshCommand`, `GIT_SSH`, then the default, in the current repository context. The workspace names the client and the files it reads, and the user can switch between Windows OpenSSH and Git's bundled SSH. An unidentifiable wrapper is shown as unresolved.
- The document model keeps Host/Match/Include order, comments, repeated directives, and source locations. Static Host patterns, negation, include globs, first-value scalars, and cumulative IdentityFile entries resolve without flattening files. Unknown or dynamic Match conditions are labeled unresolved.
- Public-key files are read for algorithm and fingerprint; private keys are never read. Missing paths and unreferenced keys are distinct.
- Inspection never runs `ssh -G` on user configuration, authenticates, touches known_hosts, or loads agent keys.
- Every edit control in this slice is absent or disabled with a read-only explanation.
- API tests cover the SSH acceptance corpus, including the `Match exec` sentinel that must never be created and the client-choice cases. Static oracle fixtures are compared with an identified native client. Focused UI tests cover navigation and host selection.

## Not in this ticket

IdentityFile editing (ticket 05) and refreshing Git after SSH changes (ticket 06).

## Comments

- 2026-11-03: Split from the original single implementation ticket during spec review.

- 2026-11-03: Implemented and verified. Static SSH source/host/key inspection and Git/client precedence are implemented, with distinct client homes and explicit dynamic Match limits. See [implementation evidence](../implementation.md) and [two-axis review](../review.md). All declared dependencies are resolved.
