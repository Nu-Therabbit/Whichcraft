# Windows acceptance run — 24–25 October 2026

Latest continuation: [25 October report](../2026-10-25/RESULT.md) adds five fixes, native transfer/cancellation/minimum-size coverage, A-9 concurrent-edit evidence and actual child-process interruption. It supersedes only the explicitly repeated cases below.

Status: partial acceptance; implementation regressions fixed. Required blocked/not-run cases are not passes; retain legacy fallback.
Source at start: `feat/ui-redesign` at `d00e6de`. Windows 11 10.0.26300, one local user account. Native UI driven with the computer-use skill. Registry backups and raw files are ignored by the adjacent `.gitignore`; never commit them.

## Completed observations

- Initial release build produced MSI and NSIS. NSIS installed into `installed-nsis` (exit 0), launched the new UI, and its `whichcraft.com get JAVA_HOME` worked. User and System Environment exports exactly matched the baseline after install.
- MSI non-elevated `/qn` refused per-machine installation (1603 / error 1925); retry using normal `RunAs` succeeded (exit 0), into `installed-msi`. Both Environment keys remained byte-identical.
- Installed new UI shows full Inventory Only Android/MSVC/Windows SDK details and Python launcher/default/Store-alias details. Existing Java Selection mismatch is visible and accessible.
- Created a named Java-only profile from the new UI; independently read the persisted profile and confirmed Java is its only pin. Switched Java 21.0.11 → 21.0.12 with the actual User-only plan, then applied the profile → 21.0.11. The profile badge changed differs → matches. Undo twice restored both Environment keys byte-for-byte. MSI legacy startup read the same saved Java-only profile and correct effective Java. Deleted the test profile in the legacy UI; stored list is empty again.
- Recovery cross-mode persistence: seeded a clearly named pending test journal for `WHICHCRAFT_TEST_RECOVERY_20261024` (not a process-kill test). New MSI UI displayed NOT WRITTEN and resumed it; independent Registry/journal readback confirmed the value and completed status. Closed it; reset only that test fixture to pending; MSI legacy UI displayed WRITTEN and rolled it back. Both keys returned to the exact baseline and the journal became undone. No claim of physical interruption case A-6.
- Native keyboard ArrowRight moved Variables → Snapshots → Import / Export. Both light and dark themes were visually inspected; restored light.
- Custom JSON export through the real native Save dialog produced a file containing only User JAVA_HOME, no System variables, and the exact actual value. The dialog used its default filename under the primary repo; moved that test file to ignored `java-home-export.json` here after verification.
- Installed Temurin JDK 17.0.18+8 through the new UI into isolated `tools-store`; inventory shows it as managed. Both Environment scopes remained unchanged when it was not selected.
- Installed Go 1.26.0 through the new UI into the same isolated store; ran its real executable (go1.26.0). Update through the new UI downloaded Go 1.26.10 beside it; real executable reports go1.26.10. Before switch confirmation, both Environment scopes still exactly match baseline.
- Flutter real contract installed 3.32.8 (3.18 GB), checked pinned plugin and actual Dart/Flutter executables, saw Windows Appraisal hold it, retried once after 5 seconds, and successfully uninstalled via the real manager. No usage checks bypassed. Contract passed; both Registry scopes compared equal internally.
- System contract writes/Undo passed and external reg-export comparison restored both keys. However the runner can write HKLM and native helper calls finish without interactive consent: the user confirmed no UAC was shown. Added an ignored manual cancellation contract; it restores accidental successful writes before failing. A-3 is blocked by absence of an interactive prompt, not passed. A wrapper now forces native helper admission in UAC contracts to avoid mistaking an in-process write for native-helper coverage.

## Acceptance discoveries fixed

1. During a real background update, the panel shows Installing but the app footer says Ready after navigating. Added app-level Working status for update/profile work and kept their failure result through automatic readback; regression test passes.
2. The downloaded Go update plan proposed removing `%SystemRoot%\system32` instead of the real Go folder. Did NOT Apply this plan. `would_shadow` accepted a hit in the selected User folder as evidence of a System shadow. Reproduced with a regression (fails before fix), fixed to require the first command hit to be from System, and normalized selected-directory comparison. All application tests pass (98 passed, 3 ignored). The corrected MSI was installed and the real plan repeated before Apply: it removed only `C:\Program Files\Go\bin`, preserving raw `%SystemRoot%\system32` and `%SystemRoot%`. Apply made Go 1.26.10 effective; Check in shell independently resolved the same executable. The UI offered to retire owned Go 1.26.0 and removed it successfully. Undo restored both Registry exports byte-for-byte; Selection stayed 1.26.10 and the tile visibly/accessibly reported the mismatch against effective 1.27.0, as the user requested. Switched Selection back to external Go 1.27.0, undid the extra User PATH entry, then removed test Go 1.26.10 and test JDK 17.0.18 through the real UI. All working external installations remained intact.

## Corrected candidate and verification

`npm run tauri build` succeeded after both production fixes. Corrected MSI install/uninstall exited 0; corrected NSIS install exited 0 and launched Developer tools with the original 8 installations. Both packages contain the console launcher; `whichcraft.com get JAVA_HOME` works. No separately installed Envarly app was present; existing Envarly data was preserved. This is not clean-machine coverage.

| Package | SHA256 |
| --- | --- |
| `Whichcraft_0.1.0_x64_en-US.msi` | `07CAAA61C5BE9FAACED420CB677586D332B7E98185DD044D78CAA4BD9AB38F52` |
| `Whichcraft_0.1.0_x64-setup.exe` | `A0C71962C8221D8C1E269E5BB7EFE51A33542F463C583A3DFD0B127CAD09492A` |

- Frontend: 543 unit tests passed; final targeted update journey rerun: 6 passed. Lint and TypeScript/frontend build passed.
- Rust: full `cargo test --lib -- --test-threads=1`: 269 passed, 16 ignored, no failures. Application subset: 98 passed, 3 ignored. Ignored tests are not included in pass counts.
- Manual real Flutter install/uninstall contract passed separately, including a safe retry after the temporary Windows Appraisal usage block.
- Manual native-helper System apply/Undo passed separately. The explicit cancellation contract failed its cancellation expectation because the helper was allowed without any prompt; it cleaned up its writes. The user independently confirmed that no UAC dialog appeared. Therefore A-3 remains blocked; no security settings were changed.
- Minimum-size follow-up: actual non-demo Developer tools and Java plan were inspected at 900×600. A long Python Store-alias path overflowed the inventory column; wrapping was fixed and the user supplied the final native screenshot confirming containment and removal of the horizontal scrollbar. Remaining Environment/minimum-size focus journeys are still open.

## Case mapping and remaining acceptance

IDs refer to `docs/acceptance-criteria.md`, using the spec's section/ID mapping. PASS below applies to the explicitly described observation. PARTIAL means useful real evidence exists but the full exact scenario is still open. NOT RUN means required coverage remains; BLOCKED identifies an unavailable environment. Backend tests are distinguished from packaged UI evidence.

| Cases | Result | Evidence / required remainder |
| --- | --- | --- |
| D-1–D-2 | PARTIAL | Native inventory has four external Temurin installations with release-derived versions, plus Node/Python/Go/Git. Flutter Scan Root was observed in an earlier real run; repeat full exact discovery fixture if closing these cases. |
| D-3–D-4 | PASS | Real managed Java/Go aliases did not duplicate inventory; external Node and Go were identified as MSI-owned. |
| D-5 | PASS | A disposable JDK under a temporary scan root was found, selected, then its folder was moved. The remembered selection stayed visible as unavailable ("the selected installation's folder is missing", "1 unavailable"), not as uninstalled. While the folder remained under the scan root it was also discovered at the new path. |
| D-6 | PARTIAL | Earlier real Scan Root observation; not repeated in installed candidate. |
| D-7, E-5 | PASS | Installed shell exposes full read-only SDK components and distinct Python launcher/default/Store-stub information. |
| E-1 | PARTIAL | Real System Go shadow vs managed User Go exercised; exact Node fixture not repeated. |
| E-2 | PASS | After Undo both Selection and Effective are shown with visible and accessible mismatch. User explicitly chose to retain the latest Selection. |
| E-3 | PASS | With a temporary Windows PowerShell profile prepending a disposable `node.exe`, Check in shell reported that Windows Terminal runs something else. Effective (registry) was `C:\Program Files\nodejs\node.exe`; in the shell it was the disposable path. The profile file was removed afterwards. |
| E-4 | PARTIAL | Packaged Check in shell matches actual updated Go; exact no-profile setup not separately verified. |
| A-1–A-2 | PARTIAL | Equivalent Go mixed-scope diff/apply succeeded; no interactive UAC prompt or exact Node fixture on this run. Raw System32/Windows entries preserved. |
| A-3 | BLOCKED | No UAC prompt appears on this runner; user confirmed. Need a normal interactive consent/cancellation environment. |
| A-4 | NOT RUN | Controlled real System-write failure with rollback/type verification. |
| A-5 | PASS | Actual Java switch and profile apply use version roots, with Registry readback and exact Undo. |
| A-6 | PARTIAL | Seeded persisted journal resumed in new UI and rolled back in legacy UI; actual process interruption during write remains required. |
| A-7 | BLOCKED | Single-account runner with noninteractive helper admission does not establish the specified UAC account boundary. |
| A-8 | PARTIAL | New-process/native helper contracts pass; broadcast delivery not independently captured in packaged UI run. |
| A-9 | NOT RUN | Real concurrent edit while reviewing/waiting for UAC; unit/journey checks alone do not close native acceptance. |
| U-1 | PASS | Java/profile and corrected Go mixed-scope Undo restore both exported Environment keys exactly. |
| U-2 | PASS | After a User-only Java 21.0.12 apply, an external program appended a sentinel User PATH entry. Undo restored JAVA_HOME and removed the Whichcraft PATH entry, kept the sentinel, and said "Undo restored 2 variable(s)". Entry-wise merge dropped a pre-existing empty PATH segment; that segment was put back so the final export matches. |
| U-3 | PASS | After the same User-only apply, JAVA_HOME was changed externally to the JDK 17 root. Undo kept that value, restored PATH exactly, and showed "Undo completed with conflicts" for User JAVA_HOME. |
| U-4 | NOT RUN | A partial Undo write failure was not forced on the live registry. |
| T-1–T-2 | PARTIAL | Earlier real fresh-environment/Terminal contract and current packaged shell resolution; repeat exact packaged terminal-open cases as needed. |
| T-3 | NOT RUN | The app escapes `;` to `\;` in the Windows Terminal starting directory. A live `wt -w new` launch did not produce a new Terminal process to count tabs. |
| T-4 | PASS | Settings were switched to PowerShell and then Command Prompt. Open terminal started `powershell.exe -NoExit` and `cmd.exe /K`, both parented by this Whichcraft process. The setting was returned to Windows Terminal. |
| I-1 | PARTIAL | Java/Go installed and executed via packaged UI; prior real contracts cover Node/Python/Temurin/Go. Complete representative remaining UI backends. |
| I-2 | PARTIAL | Actual pinned Flutter backend install/version/uninstall passed; packaged Flutter UI flow not repeated. |
| I-3–I-5 | PASS | Temurin catalog, Git switch-only, and first-use install-store confirmation observed in actual UI. |
| I-6 | PARTIAL | Isolated test store used by real manager; user's custom mise config exclusion not separately exercised here. |
| I-7 | PASS | Unselected native Java/Go installs leave both Environment scopes byte-identical. |
| I-8 | NOT RUN | Actual interrupted/cancelled download and residual-file checks. |
| I-9 | PARTIAL | Java/Go install catalog estimates visible; full Flutter estimate presentation not exercised in package. |
| I-10–I-12 | NOT RUN | Clean first mise preparation, wrong checksum, and offline setup/failure presentation. |
| I-13 | PASS | MSI/NSIS installation files contain app/CLI/uninstaller, no bundled mise. |
| I-14 | PARTIAL | Earlier real old-mise/new-mise maintenance contract passed; not a packaged app-upgrade session. |
| I-15 | NOT RUN | Offline app-upgrade maintenance path. |
| I-16–I-17 | PASS (contract) | Real pinned-plugin-over-time contract and full Flutter contract passed; packaged Flutter integration remains I-2 partial. |
| S-1–S-2 | PARTIAL | Earlier real two-store contract passed; packaged UI store-change/restart path incomplete. |
| R-1 | PASS | Packaged UI removes managed old/new Go and test Java through their owning store. Test store has no executable installations left. |
| R-2–R-9 | NOT RUN | Disposable external MSI/other uninstaller/folder-only/refused ownership fixtures. Uninstalling Whichcraft packages is not tool-uninstaller coverage. |
| R-10–R-11 | PARTIAL | Flutter contract observed and safely retried service usage refusal. Exact JDK daemon and held-directory UI cases remain. |
| R-12 | PARTIAL | Selected Go cannot be removed until a replacement is chosen; disabled confirmation observed. Native dropdown automation could not select the replacement, so completed cleanup through separate reviewed switch + Undo + unselected removal. Do not claim replacement flow passed. |
| R-13 | NOT RUN | Cancel disposable external uninstaller after replacement. |
| P-1 | PARTIAL | Full same-line Go 1.26.0 → 1.26.10 install/switch/retire/Undo passed in corrected MSI; exact Temurin 21 case still open. |
| F-1 | PARTIAL | Real Java-only profile leaves omitted tools unchanged; exact two-profile Java+Node fixture remains. |
| F-2 | PASS | Profile `acceptance-f2` pinned a disposable JDK whose folder was then moved out of the scan root. The row showed 1 missing, "Whichcraft cannot install this", and "Nothing is written until every tool in the profile is available." The User Environment export hash did not change. |
| F-3 | PARTIAL | Profile `acceptance-f3` pinned Node.js 22.23.4, which is not installed. The UI said Whichcraft can install 22.23.4 (0 MB) and showed "Install the missing ones (0 MB), then apply", disabled until the install folder is confirmed. No download was started. The User Environment export hash did not change. |
| F-4 | NOT RUN | Two copies of the same Temurin version, preferred root then fallback, were not exercised. |
| F-5 | PASS | Uninstall for effective Java 21.0.11 listed profile `acceptance-f5`. After a replacement was chosen, "Point those profiles at the chosen installation" was checked. The dialog was dismissed; the JDK and JAVA_HOME stayed. |
| F-6 | PARTIAL | Native profile matches/differs status updates after tool switch/apply. External edits while profile list is open remain. |
| C-1–C-2 | PARTIAL | Earlier real cleanup/Undo and read-only expanded-path contract; exact packaged fixture not repeated. |
| X-1 | BLOCKED | Only one user account; alternate administrator credentials unavailable. |
| X-2 | BLOCKED | PowerShell 7 / configured cmd AutoRun environment unavailable. |
| X-3 | PASS (limitation) | Open terminal starts a new process (`powershell.exe -NoExit`, `cmd.exe /K`, or `wt.exe -w new`). It does not update a tab the user already opened in an existing Windows Terminal window. |
| X-4 | BLOCKED | Real rollback race needs a controlled concurrent-writer environment; unit tests are not native race evidence. |

Added spec scenarios: navigation/keyboard tabs/themes/default window and native JSON custom export have direct UI evidence. Earlier real Environment variable create/delete, snapshot save/compare/stage/discard and REG import observations remain in ticket 18. Full supported value-kind/secret-confirmation, every export format/scope and cancellation path are not closed by that evidence. This continuation saved and renamed one test snapshot, then removed that test file. Clean-machine startup and remaining Environment/minimum-size focus journeys remain open. Tickets 19/20 therefore remain `ready-for-human`, and ticket 21 has not started.

## Continuation (25 October 2026, release `E0822F62…`)

The same release executable was driven with UI Automation because the computer-use helper could not start. Cases above marked from this continuation are U-2, U-3, D-5, E-3, T-4, F-2, F-3, F-5, and the X-3 limitation. U-4, T-3's live tab count, and F-4 were not closed.

Final `continue-hkcu-after.reg` and `continue-hklm-after.reg` match the continuation's before exports by SHA256. `selection.json` was restored to the continuation's before copy. The temporary PowerShell profile, scan root, profiles file, and settings file created for these cases were removed. Empty directories may remain under `C:\WhichcraftAcceptance`.

Snapshot save and rename of `acceptance-continue` → `acceptance-renamed` were observed. The following delete confirmation was aimed at the wrong card and removed pre-existing `20261024T121156Z.snap` (created 24 October 2026 19:11 during the earlier acceptance run). The confirmation on the test card was cancelled, and the test snapshot file was then deleted directly. The other four pre-existing snapshot files are still in `%LOCALAPPDATA%\Envarly\snapshots`. The deleted snapshot's contents were not recovered.

## Restoration

Initial acceptance cleanup, completed before the read-only window-size follow-up:

- Final `hkcu-final.reg` and `hklm-final.reg` have the exact SHA256 of their respective before exports; raw values and Registry kinds are unchanged.
- Original `selection.json` restored byte-for-byte. Removed only this run's isolated-store settings and empty test-profile file after checking they still matched the known test values.
- Copied the explicitly named recovery fixture to ignored evidence, then removed it after verifying `undone`. Retained ordinary undone apply journals and automatic snapshot history; did not delete pre-existing journals or Envarly snapshots.
- Removed test Java/Go through the UI; verified no executable installation remained before deleting the generated isolated store/cache within this acceptance directory.
- MSI and NSIS test uninstall registrations are gone. No Whichcraft test process is left. Four external JDKs and the working System Go remain.
- Raw Registry/app-data backups, logs and export files remain only in the ignored local acceptance directory; this report and its ignore rules are the committed evidence.

## Minimum-size follow-up (25 October 2026)

The user resized the real, non-demo release app to the minimum. Native capture measured 902×632 including frame/title bar, corresponding to 900×600 content. Tool inventory, independent inspector scrolling, and the Java review plan with Apply/Undo controls were readable; no plan was applied. The Python Store-alias warning overflowed its narrow inventory column. Added `break-words` to that warning so long Windows paths wrap within its card.

The first follow-up build left the previous GUI binary in place. Explicit `npm run tauri -- build --no-bundle --verbose -- --bin whichcraft` succeeded and produced GUI SHA256 `E0822F6275D6500BADB07F1FA145F54664FACE5C6427738CDB140DC2300E599F`. The user then supplied `codex-clipboard-05ba995e-3120-4f62-a32e-4f9cc9206352.png`: the Store-alias path is fully contained and the horizontal scrollbar is gone at the minimum size with the Python inspector open. Local evidence copy: ignored `minimum-size-python.png` beside this report. No further Computer Use was needed after that screenshot.

Verification: existing supplemental-info component tests 3/3 passed; lint and TypeScript/frontend/release build passed. No new layout-only unit test. MSI/NSIS hashes above remain evidence for the earlier installed candidate; this CSS-only follow-up was checked in the rebuilt release executable and did not repeat installer or Registry mutation suites. The app was reopened for the sizing check and left open for the user; test stores/settings remain removed. Remaining Windows acceptance cases and the legacy-removal gate are unchanged.
