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
