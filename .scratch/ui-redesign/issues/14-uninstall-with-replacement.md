# 14: ถอนการติดตั้งพร้อมเลือกตัวแทนและตรวจการใช้งาน

**What to build:** ถอนจากแผงรายละเอียดได้โดยเห็นวิธีถอน ผลกระทบ และแผนสลับตัวแทนก่อน พร้อมผลตรวจว่าถอนครบจริงหรือไม่.

**Blocked by:** 08: สลับการติดตั้งผ่านแผนจริงและ Undo.

**Status:** resolved

**Kind:** Vertical slice / removal journey

- [x] ใช้ uninstall plan/use case เดิมสำหรับ Managed และ External Installations พร้อมแสดง method, usage/process/folder locks, affected profiles และ refusal reasons.
- [x] ตัวที่เป็น Selection หรือ Effective Installation ต้องเลือกและ review ตัวแทนก่อนถอน; plan ที่ยืนยันต้องตรงกับที่แสดง และ stale switch ต้องให้ตรวจใหม่.
- [x] คง normal external uninstaller behaviour, ไม่มี silent/kill เพิ่มเอง, folder-only/Recycle Bin protection และ incomplete/cancelled outcomes.
- [x] มี repoint choices, open-folder/rescan และ unfinished-uninstall actions ที่เกี่ยวข้อง; ผลจริงถูก refresh ผ่าน coordinator.
- [ ] ทดสอบ app/API success/refused/in-use/stale/cancel/incomplete และลอง managed หรือ disposable external/folder fixture บน Windows; ไม่ถอน working tools เพื่อให้ได้ coverage.

## Comments

- **Shell:** Developer tools inspector `ShellInstallationDetail` reuses production `UninstallSection` and tools store intents (`planUninstall`, `chooseReplacement`, `confirmUninstall`, unfinished banners with open folder/rescan).
- **Coordinator / plan binding:** `effects.ts:confirmUninstall` passes the on-screen `switchPlan` to `tools.uninstall`; `canConfirmUninstall` requires the chosen replacement to match `switchPlan.selected.root`; stale/blocked outcomes re-trigger replacement planning (see `effects.test.ts`).
- **Tests:** `desktopShellUninstall.test.tsx` (plan/method, replacement gate, uninstall with shown switch plan, refused path); harness coverage for stale/blocked remains in `effects.test.ts`.
- **Windows manual (disposable uninstall fixture):** Not run in this agent environment. Leave checkbox open for human QA.

### Review round 1 (Grok 4.7)

- **Plan-id / baseline gate:** `chooseReplacement` calls `registerReviewedPlan`; `confirmUninstall` uses `beginPlanApply` + `isPlanApplyCurrent` before `uninstall` and in `shouldCommitToolMutation`. Stale baseline rebuilds via `chooseReplacement` (`effects.test.ts`, `desktopShellUninstall.test.tsx`).
- **Coordinator refresh:** Shell test asserts `listToolInstallations` reloads after successful confirm (fails if `readbackToolsState` / write completion path drops refresh).
- **Branch coverage:** Shell fakes for in-use, folder lock, affected profiles/repoint, cancelled, and incomplete outcomes (`UninstallSection` paths).

### Review round 2 (Grok 4.7)

- **Coordinator invalidate lock:** Success shell test subscribes to `subscribeInvalidation` and asserts `tools-installations` or `shell-overview` is published after confirm — fails if `endToolsWrite` drops tools-scope invalidation while `readbackToolsState` still lists installations directly.

### Review round 2 approval

- Approved. The success test fails unless a post-confirm invalidation batch includes `tools-installations` or `shell-overview`. That batch comes from `endToolsWrite`, so a `listToolInstallations` bump from `readbackToolsState` cannot satisfy it. The Windows disposable-uninstall checkbox stays open and is not a pass.
