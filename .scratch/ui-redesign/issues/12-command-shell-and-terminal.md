# 12: ตรวจคำสั่ง ผลใน shell และเปิด Terminal จริง

**What to build:** ใช้ Environment → Check command เพื่อดู PATH hits และใช้เครื่องมือ → Check shell/Open terminal เพื่อเทียบผลกับ process ใหม่หลังสลับได้.

**Blocked by:** 08: สลับการติดตั้งผ่านแผนจริงและ Undo; 09: แก้ Environment variables ผ่าน workspace ใหม่.

**Status:** in-review

**Kind:** Vertical slice / resolution journey

- [x] Check command รองรับชื่อ/extension/full path, PATHEXT, ordered System/User hits, shadowed/no-match และ full-path status ตาม API เดิม โดยไม่รันคำสั่งที่ตรวจ.
- [x] Check shell แสดง Shell Resolution เทียบกับ Effective Installation หลัง shell profile และแยกคำอธิบายจาก Check command; invalidate ผลเก่าเมื่อ Environment เปลี่ยน.
- [x] เปิด Windows Terminal/PowerShell/cmd ตาม settings ด้วย fresh non-inherited environment รวมกรณี Terminal เดิมเปิดค้างและพาธมีอักขระที่ต้อง escape.
- [x] navigation, keyboard submit, pending writes และ error/cancel states ทำงานใน shell ใหม่โดยไม่อาศัย singleton หรือ fixture result.
- [ ] app-level tests และ Windows checks เปรียบเทียบ executable paths/versions จริง ทั้ง profile ปกติและ profile ที่เปลี่ยน PATH/alias; บันทึก shell variants ที่ต้องใช้เครื่องอื่น.

## Comments

- **Environment:** `ShellEnvironmentWorkspace` Check command tab mounts production `CheckCommandPanel`; results clear on coordinator `environment-*` invalidation.
- **Developer tools:** `ShellInstallationDetail` exposes Check in shell / Open terminal and `ShellCheckResult`; hint separates shell resolution from Check command.
- **Invalidation:** `ShellToolsProvider` clears stale shell checks on environment changes and skips auto-recheck in the same batch.
- **Tests:** `desktopShellCheckShell.test.tsx` (check command API, shell resolution, open terminal, env apply clears shell check). `CheckCommandPanel.test.tsx` unchanged contract.
- **Windows manual (WT/PowerShell/cmd, PATH/alias profiles):** Not run in this agent environment. Leave checkbox open; variants not exercised: Windows Terminal, PowerShell, cmd round-trip.

### Review round 1 (Grok on 903aeed)

- Check command uses coordinator `beginCheckCommand` / `isCheckCommandCurrent`; late responses after `environment-*` invalidation are dropped. Shell test asserts `runCheckCommandLocally` stays idle.
- Shell resolution test uses selected vs effective roots; Effective line asserts `effectivePath` from shell check, not the selected root.
- Late in-flight `shellCheck` after environment revision bump does not restore the status panel.

### Review round 2 (Grok re-review on 18549cf)

- Removed unused `runCheckCommandLocally` seam. `checkCommandSession.test.ts` > **`resolveCheckCommand does not execute the typed input`** mocks `node:child_process` and fails if spawn/exec run; Rust **`check_command_with_resolves_via_path_existence_only`** locks path-existence-only resolution.
- Shell late-success test waits for Check button after late resolve; **`drops a stale success when environment invalidates before resolve`** fails if generation drop removed.
- **`drops a stale failure when environment invalidates before reject`** + shell **`drops a late check command failure after environment invalidation`**; `resolveCheckCommand` drops stale errors.
- **Verification:** `npm test -- --run` (491 passed), `npm run lint` (clean), `cargo test path_manage`, `cargo clippy -- -D warnings` (clean).

### Review round 3 (Grok re-review on f09cb12)

- **Rust path-only lock:** `check_command_with_resolves_via_path_existence_only` keeps the path-existence behavioral assertion and scans `check_command_with`, windows `check_command`, and `dir_exists` bodies (via `include_str!`) for process-launch tokens (`std::process`, `Command::`, `CreateProcess`, `ShellExecute`, `cmd.exe`, `powershell`); inserting `Command::new` in `check_command_with` fails this test.
- **TS resolve lock:** `resolveCheckCommand does not execute the typed input` mocks both `child_process` and `node:child_process` so a bare spawn import fails.
- **Note:** Review round 1’s `runCheckCommandLocally` idle assertion was historical; that seam was removed in round 2.
- **Verification:** `cargo test path_manage` (24 passed), `cargo clippy -- -D warnings` (clean), `npm test -- --run` (497 passed), `npm run lint` (clean).
