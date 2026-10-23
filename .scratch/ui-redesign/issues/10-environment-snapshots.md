# 10: ใช้ Snapshots จริงจาก Environment

**What to build:** บันทึก จัดการ เปรียบเทียบ และเตรียมกู้คืน Snapshots จากแท็บ Environment โดยยังต้องดู diff และยืนยันก่อนเขียน.

**Blocked by:** 09: แก้ Environment variables ผ่าน workspace ใหม่.

**Status:** in-review

**Kind:** Vertical slice / backup and restore journey

- [x] เชื่อม save/list/rename/delete, compare saved snapshots และ preview เทียบกับ Environment ปัจจุบันกับ persistence เดิม.
- [x] restore stage ความต่างจริงรวม removals และ value types ตาม schema/version ที่รองรับ; การแทน pending changes ใช้การตัดสินใจที่ชัดเจน ไม่ทิ้งงานเงียบ ๆ.
- [x] Snapshot ไม่ถูกอธิบายเป็น Tool Profile หรือการสำรองไฟล์การติดตั้ง และไม่สร้าง pre-apply snapshot ซ้ำกับ backend.
- [x] ข้อมูล Snapshot เดิมยังเปิดได้ มี empty/error/loading/cancel states และแก้ Environment แล้ว Tool/Profile read models ถูก refresh.
- [ ] ทดสอบ app/API journey และลอง save/compare/restore ของค่า/ชนิด/รายการลบบน Windows จริงพร้อมตรวจหลังรีสตาร์ท.

## Comments

- **Shell:** Environment → Snapshots tab mounts production `SnapshotPanel` via `ShellEnvironmentWorkspace` (`?presentation=desktop-shell&page=environment&env=snapshots`). Staged restore flows through `handleStageSnapshot` / apply-staged (no direct Registry write on restore).
- **Replace staged:** `useSnapshotPanel` confirms via `snapshot.confirm_replace_staged` when `pendingStagedCount > 0` before staging a restore diff.
- **Coordinator:** Environment apply still invalidates tool read models through ticket 04/09 paths; snapshot save does not add a second backend pre-apply snapshot on top of apply-staged.
- **Tests:** `desktopShellSnapshots.test.tsx` (list/save preview, stage restore without `applyEnvChanges`, replace-staged confirm).
- **Windows manual (save/compare/restore + restart):** Not run in this agent environment. Leave checkbox open for human QA.

### Review round 1 (Grok 4.7)

- **Coordinator apply readback:** `desktopShellSnapshots.test.tsx` applies staged edits and asserts `subscribeInvalidation` receives `tools-profiles`, `tools-installations`, and `shell-overview`, plus a follow-up tool inventory rescan (test fails if `endEnvironmentWrite` stops invalidating those scopes).
- **Replace staged map:** `computeStageSnapshot(..., replacePendingStaged)` rebuilds from an empty staged map when the user confirmed replace; `stagingLogic.test.ts` covers orphan pending drops vs merge.
- **Legacy dock:** `SnapshotPanelDock` passes `pendingStagedCount={staged.size}` from `LegacyEnvironmentView`.
- **List/delete errors:** `useSnapshotPanel` surfaces `snapshot.error_list` / `snapshot.error_delete` instead of silent `console.error` + empty list (`SnapshotPanel.test.tsx`).
- **Restore fixture:** Shell test registry includes removal + value-kind delta; `stagingLogic.test.ts` asserts staged delete and `ExpandString` kind change.

### Review round 2 (Grok 4.7)

- **Profile reload lock:** `ShellToolsProvider` dispatches `loadProfiles` only when invalidation includes `tools-profiles` (installation/overview rescan still follows `environment-*` via existing subscribers). Apply-staged shell test asserts `listProfiles` runs after success, not just scope names in a test-local listener — dropping `tools-profiles` from `readbackScopes` fails while `environment-variables` rescan remains. Background `loadProfiles` no longer clears stale-plan or install-failure errors (`reduce`).
