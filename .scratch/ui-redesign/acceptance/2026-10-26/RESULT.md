# Windows acceptance continuation — 26 October 2026

Status: partial acceptance; profile focus/readback and stale embedded-frontend build regressions fixed. Retain legacy fallback.

Implementation worktree: `feat/ui-redesign`, starting at `8c8490a`. The primary prototype/docs checkout was not modified. This continuation supersedes only the cases described below; the [25 October report](../2026-10-25/RESULT.md) and [original full matrix](../2026-10-24/RESULT.md) remain evidence for other cases. Raw Registry exports, profile fixtures, logs and backup files are ignored here and must not be committed.

## Production regression fixed: live profile status (F-6)

Native reproduction: leave Tool profiles open, externally point User JAVA_HOME/PATH at a different existing JDK, and return focus to Whichcraft. The profile badge and current-tool list remained stale. The new shell had no external-Registry check on window focus. Separately, cross-feature invalidation fired only once until the external diff was accepted, so subsequent distinct edits, including restoring the original value, could remain stale.

- The app-lifetime Environment controller now checks Registry differences on window focus and removes its listener on unmount.
- External readback invalidates for each distinct observed Registry state, including restoration to baseline. Re-reading an unchanged state does not invalidate repeatedly or create a refresh loop.
- External-change review remains opt-in. Reading external state preserves staged edits and their write-admission block.
- Two regression tests failed before the initial production fix and passed afterwards. The existing pending-edit journey now also simulates a focus-triggered external refresh and confirms staged work still blocks profile Apply.

Final review also reproduced a focus/UAC race: a focus check during the helper's partial write invalidated the active Apply binding, discarding its eventual result. A deferred production-shell regression failed before the guard and passes now. External detection has its own coordinator read scope, skips active writes, and discards reads overtaken by a write, account change or newer read. A further regression covers a read returning after a complete write.

## Real Windows observations

| Case | Result and exact evidence |
| --- | --- |
| F-6 | PASS, asset-verified final installed NSIS. A Java 21.0.11 profile initially matched. With its page left open, external User-only edits selected Java 21.0.12, then Java 17.0.20.1, then restored the original raw values/kinds. Minimize/refocus updated the badge matches → differs → differs → matches, and the current Java checkbox followed all three versions. No Rescan, navigation or accepting external changes was required between edits. |
| F-4 | PASS, rebuilt production release GUI. Installed real Temurin 21.0.12+8 into an isolated mise store; its real executable reported 21.0.12. An identical-version external copy was already present. A profile preferring the managed root produced the exact User-only diff, Apply selected that managed root, and its badge matched. Closed the app, moved only the owned JDK outside store/scan roots, and restarted. The selection was unavailable rather than uninstalled; the same profile planned and applied the existing external 21.0.12 copy. Independent Registry reads confirmed both roots. Two native Undo actions restored each preceding User state exactly, and guarded cleanup restored the original baseline. System Environment did not change. |
| R-10 | PASS, rebuilt production release GUI. Started an owned Java sleeper from the isolated JDK. Uninstall preview refused removal, named `OpenJDK Platform binary (PID 30484)` and showed the `gradlew --stop` hint. Whichcraft did not kill the process or remove the JDK. The test runner later stopped only its exact owned PID after verifying its executable path. |
| R-11 | PASS, rebuilt production release GUI. After stopping the sleeper, an owned hidden child process held the isolated JDK as its working directory. Uninstall preview refused removal with “A program has the folder open…” and required closing it first. No removal was confirmed. Only the owned holder process was stopped during cleanup. |
| A-3 | PASS for the native-helper cancellation contract using the earlier installed NSIS executable identified below. The user pressed No on the real UAC prompt. The mixed User/System plan returned cancellation, and independent exports proved both Environment keys byte-identical to baseline. This supersedes the earlier absent-prompt block for this path; an exact Node switch cancelled through the GUI was not repeated. |
| System Apply/Undo (A-2/U-1 subcase) | PASS, native-helper contract using the earlier installed NSIS executable identified below. The user pressed Yes for System Apply, then Yes for Undo. Only an owned `WHICHCRAFT_TEST_SYSTEM` value was written, a fresh process environment read it, and Undo removed it. Independent exports of both scopes matched baseline afterwards. This is helper integration evidence, not a claim that every GUI/account permutation passed. |

The managed fixture was provisioned and later uninstalled with the pinned real mise in the isolated store. That provisioning is not claimed as a new UI install journey. F-4/R-10/R-11 were observed in the production release GUI; F-6 used the asset-verified final installed package. The user-driven UAC helper checks used the earlier installed GUI identified below; subsequent changes affect frontend focus coordination/build tracking, and native elevation-helper production code is unchanged.

## Deterministic failure contracts against real Registry I/O

Three new ignored/manual tests run through actual application/Registry paths, use only guarded `WHICHCRAFT_TEST_FAILURE_*` names and an isolated journal store, and check complete raw value/kind restoration. They are opt-in and must run serially.

1. **System-denial rollback:** write a real User ExpandString fixture, apply its change, inject a refused System write, and verify User raw value/kind restored, System untouched, and the durable journal marked failed. The test backend forbids all actual System writes; it does not require elevation or change ACLs. An initial attempt to seed a System fixture was denied on this account and cleaned up; the final contract deliberately uses boundary failure injection instead.
2. **Partial Undo failure/retry:** apply two real User fixture changes, allow Undo's first restore, then refuse the second. Undo reports failure, rolls back that partial restore, and retains the completed journal for retry. Retry through the real backend restores both original values/kinds and marks the journal undone.
3. **Rollback conflict with an independent writer:** synchronize a separate writer thread after the first actual User write but before an injected second-write failure. Rollback reports the conflict and preserves the independent writer's actual Registry value/kind; the untouched second value stays unchanged. This supplies real Registry concurrency evidence for X-4 at the contract boundary.

All three passed. These checks do not close installed-GUI System/partial-Undo failure presentation (A-4/U-4), an installed-GUI process kill (A-6), or every real-world timing/account variant. The original X-4 “only unit tests” limitation is superseded by the synchronized real Registry contract, with that scope explicit.

The UAC contracts now accept `WHICHCRAFT_CONTRACT_HELPER_EXE` so acceptance can target a specific installed executable; the default remains the debug helper. This affects test code only.

## Verification and final candidate

- Frontend: 550 tests passed across 73 files. Final focused profile/coordination regression rerun: 17 passed, including preservation of pending edits after focus refresh.
- Lint and TypeScript passed; frontend and release GUI builds passed. Existing dynamic-class/chunk-size warnings remain.
- Rust full library: 271 passed, 20 ignored. Five manual contracts passed separately: the three failure contracts, native UAC cancellation and native UAC System Apply/Undo. Ignored cases are not counted as automatic passes.
- Final `npm run tauri -- build --verbose` produced both MSI and NSIS. Final NSIS install and uninstall each exited 0; new-shell startup, installed console `get JAVA_HOME`, and separate-process `--legacy-ui` startup passed. Final MSI was built; a fresh MSI installation was not repeated in this continuation.
- Fixed a second build regression: repeated successful incremental Tauri builds still embedded `assets/index-CKiMxnmI.js` while current HTML required `assets/index-B0T2CSPU.js`. The Windows build script now tracks `../dist`, so replacing/renaming hashed Vite assets rebuilds the embedding crate.
- Added `scripts/check-embedded-frontend.mjs` to the normal before-bundle launcher hook. It rejects a GUI missing the production module entry named in HTML. It rejected the actual obsolete installer payload, then accepted the rebuilt GUI through the real hook. Independently extracted the final NSIS payload and verified its entry, then verified the installed executable before repeating the complete F-6 sequence, CLI and legacy smoke. Both contain current `assets/index-B0T2CSPU.js`.
- Early no-bundle/plain-cargo attempts either retained an old GUI or used the development URL and were excluded. The earlier explicit embedded release GUI (`cargo build --release --bin whichcraft --features tauri/custom-protocol`) remains scoped evidence for F-4/R-10/R-11. The final F-6 sequence was repeated on the current guarded, asset-verified package.
- Raw/package GUI hashes may differ because Tauri patches its `UNK`/`NSS` bundle-type marker: a PE comparison found exactly those three differing bytes. This normal difference was distinct from the stale embedded-entry defect.

| Artifact | SHA256 |
| --- | --- |
| Native embedded GUI used for F-4/R-10/R-11 | `8586AD71FE2880E0FCF569EE7A4C8B77982F9C97737D6D12D48039121AF38143` |
| Final MSI | `9ACFAB41891B9B712E0DBBA97B1353A51DD14C5E942051C2C32524B1FC2B935E` |
| Final NSIS | `4826A9F24AA4085294978EA32CD41C379523E288B872E556D15FD01BBBD38055` |
| Earlier installed GUI used for actual UAC cancellation/Apply/Undo | `DA80F36FC0CF345304EF65736D051B5A863837EAD758F977972CB42CC805296F` |
| Asset-verified final installed GUI (F-6/CLI/legacy smoke) | `C0820B39B3FA02D0BF02BD69F83F42326BBAE03E9B0662EC444972E12E3EEDFB` |

## Restoration

Both final Registry exports match their original backups byte-for-byte: HKCU SHA256 `DE711BED224437015DBEC9A28CCD834AEAF1275304C5C766D24788B25896D64B`; HKLM SHA256 `5AE14D9000991441FF99E44BFEF4B8840ED2FF474F5C211F03C9DD0BDAA5269E`.

Original Selection is restored byte-for-byte. Settings/profiles files, originally absent, are absent again after checking exact owned fixture IDs/settings. Both native profile Applies were undone before restoration. The temporary JDK was uninstalled; owned Java/directory-holder/GUI processes and the owned installed NSIS candidate were closed/removed. No working tool installation, pre-existing snapshot or pre-existing journal was deleted. Ordinary undone apply journals remain as history. Ignored test logs/backups/cache remain in this acceptance directory.

## Remaining gates

Tickets 18–20 remain open and 21 must not remove legacy. This continuation closes the stated native observations and adds contract evidence, not the complete Windows matrix.

- **Needs another environment:** clean-machine/app-upgrade coverage; non-admin user supplying another administrator's credentials/other-account boundaries; configured PowerShell 7/cmd AutoRun variants.
- **Still runnable and not relabeled blocked:** remaining exact discovery/Scan Root cases; complete packaged Node mixed-scope review/apply/cancel paths; broadcast and fresh-terminal/semicolon-tab observations; installed-GUI interruption and System/partial-Undo failure handling; remaining backend install/cancel/offline/checksum and store-change/restart combinations; disposable external MSI/Inno/Python-manager/folder-only/ownership refusals; completed replacement and external-uninstaller cancellation; exact Temurin update and expanded two-profile/install-missing/repoint scenarios. Preserve the distinctions in the prior full matrix and this report.

F-4, F-6, R-10 and R-11 no longer belong in the missing-case list. UAC consent/cancellation is now observed for the installed helper path, while other-account and full GUI permutations remain scoped separately.
