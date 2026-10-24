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
- [ ] ตรวจ startup ของทั้งสองโหมดว่ามี bootstrap/subscriptions เพียงชุดเดียวและเข้า shared write admission/refresh จริง; ทดสอบปิดแอปแล้วเปิดอีกโหมดและอ่าน Windows state/recovery กลับตาม contract เดิม ไม่อ้างว่า pending edits หรือ operation ในหน่วยความจำย้ายข้าม process ได้. ชุด 19/20 ต้องเก็บ acceptance จาก UI ใหม่ ส่วนการเปิด fallback แยกเป็น fallback smoke/regression comparison.
- [ ] wire/storage compatibility และ Windows integration contracts ไม่เปลี่ยนโดยไม่มีข้อกำหนด; แพ็กเกจทำงานโดยไม่ต้องติดตั้ง/เปิด Envarly แยก (`npm run tauri build` not run in agent environment).
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
- **Finding (pre-existing on main, not a product failure):** run together with `--test-threads=1`, four of these failed with "mise spawn failed: cannot find the path".
  - `ensure_mise()` caches the verified `mise.exe` path in a process-wide `OnceLock`, and each contract test uses its own temp data dir. Later tests got a deleted path from the first test.
  - Run them one per process until the cache is keyed by data dir (and re-checked when the file disappears).
- **Not run:** the full Flutter install (≈1.9 GB), the System/HKLM write through UAC, uninstall to the Recycle Bin, other-user accounts, installers, and a clean machine without Envarly.
