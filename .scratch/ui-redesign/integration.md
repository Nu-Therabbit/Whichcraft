# UI redesign integration into main

Date: 2026-10-26
Status: merged; remaining Windows acceptance retained

The user accepted the current implementation for integration without waiting for the complete Windows matrix. `main` was fast-forwarded from `7dff397` to `4a12a9f`, the tested head of `feat/ui-redesign`. The primary workspace is now `E:\Dev\Whichcraft` on `main`.

## Retained documentation and acceptance

- [Specification](spec.md), [architecture review](architecture.md), [review resolution](review-resolution.md), [action/parity inventory](ui-action-inventory.md) and every individual [ticket](tickets.md) remain tracked.
- All three acceptance reports remain tracked: [24 October](acceptance/2026-10-24/RESULT.md), [25 October](acceptance/2026-10-25/RESULT.md) and [26 October](acceptance/2026-10-26/RESULT.md). Earlier worktree paths in those reports describe the original runs; current local evidence is under this primary workspace.
- Tickets 02–17 are resolved. Tickets 18–20 remain `ready-for-human`; ticket 21 remains blocked by 19/20. Integration does not close untested cases or satisfy the legacy-removal gate.
- The new desktop shell is the default. Close the existing instance and relaunch with `--legacy-ui` for the retained fallback.

The merged application tree is the previously tested `4a12a9f`: Rust library 271 passed with 20 ignored, and five manual contracts passed separately. After the fast-forward, frontend tests were rerun in the primary `main` workspace: 550 passed across 73 files; lint and a fresh production build also passed. The integration follow-up changes documentation only. Native coverage and its limits remain as recorded in the dated reports; the Windows acceptance suites were not rerun for this merge.

## Local evidence and packages

Before removing the worktree, 188 acceptance files were accounted for. Tracked documents came through Git; ignored Registry/app-data backups, screenshots, logs and fixtures were copied to `acceptance/` with hashes verified. Raw evidence and generated packages remain ignored.

The exact final MSI/NSIS and portable GUI/console binaries are retained locally under `acceptance/2026-10-26/packages/`. `SHA256.json` records their hashes; installer hashes match the 26 October report. These generated files are not committed.

## Archived design source

Tag `archive/ui-redesign-prototype-2026-10-26` preserves former prototype branch head `dbf2b88`, including design commits `e20ffee`, `dc985b2` and `6bc41ad`. This keeps the original design history reachable after deleting its branch. Prototype fixture code was not merged into production.

## Cleanup

The following clean worktrees were removed after evidence preservation and verification that their commits were in `main`:

- `E:\Dev\Whichcraft-ui-02`
- `E:\Dev\Whichcraft-ui-05`
- `E:\Dev\Whichcraft-ui-redesign`

Merged branches `feat/ui-redesign`, `feat/ui-redesign-02-feature-contracts`, `feat/ui-redesign-05-06`, `feat/v1-tickets` and `refactor/clean-architecture-mvi` were deleted. The prototype branch `codex/prototype-tools-redesign` was deleted after verifying the archive tag preserves its exact head. Only the primary `main` worktree and branch remain. No remote was configured or changed.
