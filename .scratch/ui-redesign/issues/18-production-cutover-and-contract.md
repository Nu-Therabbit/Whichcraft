# 18: เปิด UI ใหม่เป็นค่าเริ่มต้นใน candidate build พร้อม legacy fallback

**What to build:** เปิด candidate build ของ Whichcraft แล้วได้ desktop UI ใหม่ที่ทำงานครบเป็นค่าเริ่มต้น และยังกลับไปใช้ legacy UI ได้หากพบ regression ระหว่างตรวจ Windows จริง.

**Blocked by:** 10: ใช้ Snapshots จริงจาก Environment; 11: นำเข้าและส่งออก Environment ผ่านไฟล์จริง; 12: ตรวจคำสั่ง ผลใน shell และเปิด Terminal จริง; 15: อัปเดตในสายเดิม สลับ และเสนอถอนตัวเก่า; 16: จัดการและ Apply Tool profiles จาก workspace ใหม่; 17: ดูแล PATH, external changes และกู้คืนงานที่ค้าง.

**Status:** ready-for-human

**Kind:** Integration / candidate cutover

- [x] เปิด Developer tools เป็นค่าเริ่มต้นโดยไม่ต้องมี prototype query; ทุกเมนูใน spec เข้าถึง production flow จริง ไม่มี placeholder/simulate action.
- [x] เก็บ legacy entry point/presentation และ compatibility ที่ต้องใช้เป็น fallback ระหว่างชุด Windows 19/20; ใบนี้ไม่ลบ UI เดิม และไม่ถือเป็น final release gate.
- [x] เลือก presentation ผ่าน startup flag ที่มีเอกสาร: ค่าเริ่มต้นเป็น UI ใหม่ และ fallback เป็น legacy UI; ต้องปิด instance เดิมแล้วเปิดแอปใหม่เพื่อเปลี่ยนโหมด ห้ามสลับระหว่างงานที่กำลังทำหรือเปิดสองโหมดพร้อมกัน. ในแต่ละ process เลือกและ mount เพียงหนึ่ง presentation ก่อน bootstrap โดยใช้ composition/controller/coordinator ที่ย้ายแล้วจาก 03/04; ไม่มี root เดิมสร้าง services, listeners หรือ write path อีกชุด.
- [x] ยืนยันว่า implementation branch ตั้งต้นจาก production base และไม่มี prototype variants/switcher/state inspector/sample actions ปนมา; ใช้ primary source บน throwaway branch เป็น reference โดยไม่ลบ Environment backend/types ที่ยังจำเป็น.
- [x] ตรวจ action/parity inventory ที่ 02 เก็บไว้ตั้งแต่ต้น รวม themes/languages, update notice, refresh, licences/attribution, account context, diagnostics, Undo/recovery และ settings ให้แต่ละรายการมีผลลัพธ์/ตำแหน่งใหม่ ไม่เริ่ม audit รายการหลัง migration เสร็จ (`desktopShellHeaderParity.test.tsx` locks language/update/licences on default shell).
- [ ] app-level journeys, relevant frontend/Rust tests, architecture dependency checks และ packaged build ผ่าน; ตรวจ desktop minimum/default sizes, keyboard/focus, themes และขอบเขต subscriptions ระหว่าง navigation.
- [x] ตรวจ startup ของทั้งสองโหมดว่ามี bootstrap/subscriptions เพียงชุดเดียวและเข้า shared write admission/refresh จริง; ทดสอบปิดแอปแล้วเปิดอีกโหมดและอ่าน Windows state/recovery กลับตาม contract เดิม ไม่อ้างว่า pending edits หรือ operation ในหน่วยความจำย้ายข้าม process ได้. ชุด 19/20 ต้องเก็บ acceptance จาก UI ใหม่ ส่วนการเปิด fallback แยกเป็น fallback smoke/regression comparison.
- [ ] wire/storage compatibility และ Windows integration contracts ไม่เปลี่ยนโดยไม่มีข้อกำหนด; แพ็กเกจทำงานโดยไม่ต้องติดตั้ง/เปิด Envarly แยก (MSI/NSIS install and CLI smoke now pass; clean-machine validation remains open).
- [x] ระบุ candidate build และวิธีเปิด fallback ให้ผู้ทดสอบใช้; งานถอด fallback/compatibility ที่ไม่ใช้ถูกกำหนดไว้ใน 21 ซึ่งรอให้ 19 และ 20 ผ่านก่อน.

## Comments

### Startup flag (ticket 18)

- **Default:** Desktop shell (`DesktopShellApp`) with no query flag.
- **Legacy fallback:** Close Whichcraft and relaunch it as `Whichcraft.exe --legacy-ui` (packaged or `cargo`/`tauri` builds); under `npm run dev:web` use `?presentation=legacy`. The Tauri setup hook creates the main window with an initialization script that sets `window.__WHICHCRAFT_PRESENTATION__`; `main.tsx` calls `freezeAppPresentation(location.search, window.__WHICHCRAFT_PRESENTATION__)` once before `ReactDOM.createRoot`, and `App` receives the frozen value.
- **No live switch:** Removed Legacy UI link and preview footer from `DesktopShellApp`. Change mode by closing the app and relaunching with or without the legacy flag.
- **Shared bootstrap:** Both modes mount under the same `AppServicesProvider` and `WriteCoordinatorProvider` in `main.tsx`.
- **Tests:** `App.presentation.test.tsx` — default shell vs legacy startup, no flip after query change; `appPresentation.test.ts` — parse/freeze and shell href without `presentation` param.
- **Packaged / relaunch evidence:** Not produced in this agent environment (`npm run tauri build` not run here). Windows manual checkboxes for 19/20 remain open.
- **Verification:** `npm test -- --run` (504 passed), `npm run lint` (clean). `npm run build` failed in this environment on existing `src/features/tools/effects.ts` / `reduce.ts` TS errors (not introduced by cutover). `npm run tauri build` not run.

### Build fix (follow-up)

- **TypeScript:** `applyPlan` stale rebuild uses a mutable box so CFA sees the post-`withToolsWrite` dispatch; `uninstallPlanned` / `switchPlanned` reduce via dedicated type guards in `uninstallPlanEvents.ts` (generic tool gate unchanged for other events).
- **Verification:** `npx tsc --noEmit` (clean), `npm test -- --run` (504 passed), `npm run lint` (clean), `npm run build` (succeeded).

### Review round 1 (Grok on 19f0fbd..f23576f)

- **Plan events:** `uninstallPlanEvents.ts` requires the event `tool` field (no fallback to `plan.installation.tool` / `plan.tool`); null `switchPlanned` clears only when `tool` matches the panel.
- **Shell parity:** `ShellAppHeaderActions` on `DesktopShellApp` — language (`useI18n`), update notice (`useUpdateCheck` + opener), licences (`setDialog("licenses")` → production `LicensesPanel`); `ShellRegistryErrorBanner` on default tools page.
- **Evidence:** Packaged-app / `tauri build` checkboxes remain open; Windows relaunch unchanged.
- **Verification:** `npx tsc --noEmit` (clean), `npm test -- --run` (507 passed), `npm run lint` (clean), `npm run build` (succeeded). `npm run tauri build` not run.

### Review round 1 approval (`8e41905`)

- Approved. `does not store uninstallPlanned on the current tool when the event omits tool` fails if a Java plan with no `tool` is stored on the Java panel. `does not switch presentation when location.search changes after startup` fails if the freeze is removed. Header language, update notice, and licences are locked by `exposes language, update notice, and licences on the default shell header`. The registry banner test uses `renderProductionApp("")`.
- Accepted leftover, not a blocker: a Java `switchPlanned` that omits `tool` is rejected in `reduceSwitchPlanned`, but no test fails if that guard falls back to `plan.tool`. The null-switch test only covers a Node event.
- Packaged build, separate-Envarly, and Windows relaunch checkboxes stay open and are not passes.

### Review follow-up (2026-10-24)

Status moved back from `resolved` to `ready-for-human`: three acceptance boxes above were still open, and they need a packaged build and a real Windows relaunch, which no agent run has produced.

- **Fallback reachable in packaged builds:** `--legacy-ui` is a GUI launch flag (not a CLI subcommand, console detached). Before this, the only switch was `location.search`, which nothing sets in a packaged build. Covered by Rust `commands::launch` tests and `appPresentation.test.ts`; not yet run as a packaged app.
- **Architecture dependency checks:** `src/architecture.test.ts` adds the frontend side next to the Rust `layer_tests.rs`. Feature policy has no Tauri, transport, demo or barrel imports. The `api` singleton is reached only from composition and the legacy-only `AppHeader`. Shell feature code now opens URLs and checks updates through `PlatformApi`.
- **Parity rows fixed:** UI-23 (the shell header's Source link), UI-26 (Check in shell and Open terminal in the command bar) and story 5 (inventory status in the status bar).
- **Still open (human):** `npm run tauri build`, starting both modes from the package, closing and relaunching across modes with persisted state/recovery readback, and running without a separate Envarly. Tickets 19/20 stay blocked on this ticket.

### Agent Windows run (2026-10-24, Windows 11 Pro 10.0.26300)

Release build (`npm run tauri build -- --no-bundle`, no installers) driven through WebView2 remote debugging with Playwright `connectOverCDP`. All app launches used `--demo`, so nothing was written to the Registry or `%LOCALAPPDATA%\Whichcraft` (checked afterwards: only the existing `journal` folders, unchanged).

- **Pass — build:** `whichcraft.exe` builds with the embedded frontend. Installers (`--bundle`, WiX/NSIS) were not built.
- **Pass — read-only contracts:** the five read-only ignored tests pass on this machine: tool discovery, SDK/vswhere/py inventory, MSI catalog, PATH cleanup plan and the real PowerShell/cmd shell check.
- **Pass — default mode:** `whichcraft.exe --demo` sets `__WHICHCRAFT_PRESENTATION__ = "desktop-shell"` and mounts the shell. One `get_launch_options` IPC call, so there is a single bootstrap.
- **Pass — fallback:** `whichcraft.exe --demo --legacy-ui` mounts the legacy UI with no shell nav, again with one `get_launch_options` call. Modes were switched by closing and relaunching.
- **Pass — window sizes:** at 1200×760 and 900×600 there is no horizontal overflow.
- **Fixed — inspector at 900×600:** the list shrank to 196 px with clipped names and left a blank band. Fixed in `5386d9b`: the list is now 340 px beside the 352 px inspector.
- **Pass — keyboard and theme:** keyboard Tab order runs nav → header → command bar → search, with visible focus. Enter on the Environment link navigates and updates the URL. The theme toggle switches between light and dark.
- **Finding — tabs:** the Environment tablist does not move with ArrowLeft/ArrowRight.
- **Finding — list height:** at 900×600 the variable list shows about two rows.
- **Not run:** real (non-demo) launch, which downloads the pinned mise on first start; installers; the Run as admin relaunch with `--legacy-ui` (needs UAC); recovery/readback across modes with real data; the separate-Envarly check on a clean machine.

### Agent Windows run, writing set (2026-10-24, same machine)

Run with the user's approval. `HKCU\Environment` was exported before the run and compared after each step. All 10 values matched exactly: names, kinds and raw values.

- **Pass — real launch:** a real (non-demo) `whichcraft.exe` mounts the shell once (`get_launch_options` ×1, `whichcraft_prepare_mise` ×1).
  - Inventory shows 8 installations across 6 tools: Java ×4 with MSI ownership, Node 24.20, Python, Go 1.27, Git, plus Android SDK, MSVC Build Tools and the Python launcher/Store stub.
  - Python shows no effective installation because the Store stub is first on PATH.
  - Flutter shows 0 until `E:\Dev` is a scan folder (D-6).
  - Nothing was written to `%LOCALAPPDATA%\Whichcraft` or HKCU.
  - `prepare_mise` fetches only when an older mise is present, so a first start downloads nothing. Minor: `get_unsupported_env_values` is called twice at startup.
- **Pass — HKCU write and Undo:** `contract_user_apply_reaches_new_processes_and_undo_restores_the_key` passes (U-1/A-2/T-2). A new process and a new Windows Terminal saw the value, and Undo restored the key exactly.
- **Pass — mise installs and uninstalls:** these pass, each run in its own process:
  - `contract_mise_installs_node_…` (Node 22.12.0)
  - `contract_mise_installs_temurin_python_go_…` (Temurin 21.0.12, Python 3.13.17, Go 1.26.10)
  - `contract_two_install_stores_…`
  - `contract_install_with_old_mise_and_uninstall_with_the_new_one`
  - `contract_flutter_plugin_stays_on_the_pin_over_time`
  - No mise default folders were created, and no temp stores were left behind.
- **Fixed — pre-existing on main:** run together with `--test-threads=1`, four of these failed with "mise spawn failed: cannot find the path".
  - `ensure_mise()` caches the verified `mise.exe` path in a process-wide `OnceLock`, and each contract test uses its own temp data dir. Later tests got a deleted path from the first test.
  - The cache is now reused only for the same data dir while `mise.exe` is still on disk. Covered by a unit test, and all five contract tests pass together in one process (97 s).
- **Not run:** the full Flutter install (≈1.9 GB), the System/HKLM write through UAC, uninstall to the Recycle Bin, other-user accounts, installers, and a clean machine without Envarly.

### Agent Windows run, third set (2026-10-24, same machine)

Run with the user's approval. `HKCU\Environment` was diffed against a baseline after every step. It ended identical (10 values) after the fixes listed below.

**Builds and suites**

- **Pass — installers:** `npm run tauri build` produced `Whichcraft_0.1.0_x64_en-US.msi` (6 MB) and `Whichcraft_0.1.0_x64-setup.exe` (3.8 MB). They were not installed.
- **Fixed — Storybook:** 18 stories failed because components moved to `useEnvironmentApi` without the stories being updated, plus one stale AppHeader count from main. Fixed in `d7f5967`; all 112 now pass.
- **Pass — Recycle Bin:** `contract_recycle_moves_a_folder_to_the_recycle_bin` passes. Its test folder `whichcraft-recycle-contract` is now in the user's Recycle Bin.
- **Install pass, uninstall blocked — Flutter:** `contract_flutter_installs_through_the_pinned_plugin_and_uninstalls` installed Flutter 3.32.8 (3.18 GB, 131 s). Uninstall returned `Blocked: in use by Inventory and Compatibility Appraisal service` right after `flutter` ran: a Windows service briefly holds freshly run executables. The temporary store was removed afterwards. Real users can hit the same block straight after running a tool, so the message may need a "try again shortly" hint.

**Real UI, User scope only (driven over CDP)**

- **Pass — Check command:** `java` → `jdk-21.0.11…\bin\java.EXE`, Active, USER. A no-match input returns no hits.
- **Pass — Check shell:** Node matches in Windows Terminal (`C:\Program Files\nodejs\node.exe`).
- **Pass — variables:** creating a User variable wrote exactly one String value; deleting it restored HKCU exactly.
- **Pass — snapshots:** save, then preview against the current state ("matches"). Comparing with the pre-delete snapshot showed +1 added; staging the restore gave "1 staged", and Discard all brought it back to 0 with no writes.
- **Pass — import:** a `.reg` file through the real file input → preview "Stage 1 variable" → apply wrote `WHICHCRAFT_UI_IMPORT` (String) → deleted again.
- **Pass — export cancellation:** cancelling the native Save dialog returns the button to idle. Saving an export file was not automated: typing into native dialogs from the agent is unreliable (Thai keyboard layout) and could reach other windows.
- **Pass after fix — Java switch to 21.0.12:** User `JAVA_HOME` and User Path only, no UAC. A new process resolves 21.0.12; Undo restores both values.
  - **Fixed `0d4476e`:** Undo used to drop an empty Path segment (`;;`) that the original value had. An untouched PATH is now restored verbatim.
- **Pass after fix — PATH cleanup:** the plan lists two duplicate `go\bin` entries and a missing Ollama folder (User only). Apply, then Undo, restores Path exactly.
  - **Fixed `8ae4930`:** after the cleanup was applied, the only Undo left was inside a tool inspector. Undo now sits in the Environment toolbar.
- **Fixed `7ba4465` — slow readback:** a write's readback took about 45 s.
  - Each `whichcraft_list_tools` call costs about 1.8 s even for a tool with no installations, because `App::list_tools` reloads the Windows installer catalog every call.
  - One apply triggers about 13 such calls (overview ×6, tools store, profile status ×6).
  - Meanwhile the inspector header (from the overview) and its installation list (from the tools store) briefly disagree on the Effective Installation.
  - The catalog is now reused for 15 s and re-read after install, update and uninstall, and before planning an uninstall.
  - Re-measured on the same machine:
    - `list_tools`: 1.8–2 s → 6–236 ms per tool; all six tools 4.2 s → 0.27 s.
    - Java switch: the inspector and tile agree after 1.0 s; after its Undo, 2.9 s.
    - HKCU is identical to the baseline after Undo.
- **Finding — Selection after Undo:** Undo leaves `selection.json` at the undone version (Java 21.0.12), so after Undo the inspector shows Selection 21.0.12 against Effective 21.0.11. This is already on main, and the spec does not say whether Undo should restore Selection; needs a product decision.
- **Left on the machine:**
  - five snapshots in `%LOCALAPPDATA%\Envarly\snapshots` (four automatic "before apply" and "whichcraft-ui-test"); the agent was not allowed to delete them.
  - `%LOCALAPPDATA%\Whichcraft\selection.json` (Java 21.0.12).
  - three undone journals.
- **Not run:** profiles (create/apply/delete), System/HKLM writes and UAC, other accounts, a clean machine without Envarly, and installing the MSI/NSIS packages.

### Stray Terminal windows (2026-10-24)

- **Fixed `3d5aaf3` — background programs:** version probes, `py`, `vswhere` and mise ran without `CREATE_NO_WINDOW` from a GUI with no console. Windows 11 handed each new console to Windows Terminal, which left an empty window behind; one session left more than a hundred. They now go through `background_command`, and a layer test guards it.
  - Checked with the release build: startup, three Rescans and a Java switch with Undo added no window.
- **Fixed `2d74f51` — one window per launch:** `whichcraft.exe` was a console app, so each launch from Explorer left one window. Release `whichcraft.exe` is now a GUI app, and the CLI ships as a console `whichcraft.com` beside it (PATHEXT tries .COM first, so the shell still waits).
  - Checked: an Explorer launch adds no window; `whichcraft get JAVA_HOME` runs through the .com and waits; `whichcraft` alone opens the GUI and returns in about 0.2 s; `whichcraft.exe get JAVA_HOME` (the installers' path) still prints and exits 0; the MSI contains `whichcraft.com`.
  - Not run: installing the MSI or NSIS package.


### Review corrections (2026-10-24, working tree)

- Registry/account failures have alert semantics; the duplicate Environment registry banner is removed. This PC has live text status, and tool tiles expose selection/effective mismatch in both visible text and their accessible names (including the supported translations).
- The desktop overview now reuses the full Inventory Only SDK and Python launcher/Store-alias presentations, retaining Android component versions, MSVC/Windows SDK details, launcher tags/defaults, notes and alias warnings.
- Unfinished uninstall notices and their open-folder/rescan actions live in the app recovery area, across navigation and with the inspector closed. External-change review is opened explicitly from Environment rather than automatically covering Developer tools.
- Explicit Rescan requests a fresh installer catalog once before listing the remaining tools and refreshes the selected-tool store too. Automatic readback continues reusing the short-lived catalog; the optional IPC input preserves existing callers.
- Install-store confirmation, single-tool/profile plan presentation and the ADR-0001 restart notice each have one shared implementation/source.
- The earlier three review fixes are also in this working tree: catalog ownership/selection reset on tool change, persistent catalog errors with deliberate retry, and shared inventory invalidation after update/install-missing completion or partial failure.
- Verification: all 542 frontend unit tests pass (15 added across the two review rounds), lint and TypeScript/frontend build pass, and Rust application tests pass (97 passed, 3 real-machine contracts ignored). Frontend/Rust architecture checks are included. This is not packaged Windows acceptance; ticket 18 and suites 19/20 retain their existing open gates, and legacy fallback remains.


### Installed candidate acceptance (24–25 October 2026)

Current evidence supersedes earlier “not built/not installed/every case blocked” snapshots in this ticket and 19/20: [run report and complete case mapping](../acceptance/2026-10-24/RESULT.md).

- Built, installed, launched and uninstalled both MSI and NSIS; corrected package hashes are recorded. New and legacy startup were checked in separate processes. Real persisted profile/recovery data was read across modes, and no separately installed Envarly app was required on this machine.
- New UI exercised Java/profile switch/Undo, isolated Java/Go installs, corrected Go same-line update/switch/old-install retirement/Undo, shell readback, native JSON export and keyboard Environment tabs. Both Environment scopes and original Selection were restored exactly; only owned test installations/settings/packages were removed.
- Acceptance exposed and fixed two regressions: update progress/errors disappeared after navigation/readback, and System-shadow detection could remove an unrelated System PATH entry. The dangerous old plan was never applied. Corrected installed MSI removes only the real Go shadow and preserves System32/Windows.
- User chose: Undo keeps the last Selection and displays mismatch with Effective Installation. Recorded in `CONTEXT.md` and observed in native UI after Go Undo.
- Current checks: frontend 543 passed, lint/TypeScript/build passed; Rust full library 269 passed, 16 ignored (application subset 98 passed, 3 ignored); both installers built. Real Flutter contract now safely retries a temporary service usage block and passes.
- Still open: remaining Environment/minimum-size focus journeys, clean-machine coverage and the full remaining matrix in the report. User confirmed no UAC prompt appeared; native-helper success does not prove consent/cancellation. Single-account/alternate-shell/race cases require other environments. Status stays `ready-for-human`; 19/20 are partial and 21 must not start.

### Minimum-size follow-up (25 October 2026)

Real non-demo tools inventory and the Java review plan were inspected at 900×600 without Apply. The user-supplied final screenshot confirms the Python Store-alias warning wraps inside the inventory column and its horizontal scrollbar is gone after adding `break-words`. The rebuilt release GUI hash and local screenshot evidence are in the [run report](../acceptance/2026-10-24/RESULT.md). Supplemental-info tests 3/3, lint and TypeScript/frontend/release build passed. Remaining Environment/focus coverage and the required 19/20 cases stay open; legacy fallback remains. Candidate is left open for the user.
