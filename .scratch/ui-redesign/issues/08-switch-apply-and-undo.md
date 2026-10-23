# 08: สลับการติดตั้งผ่านแผนจริงและ Undo

**What to build:** เลือกการติดตั้งในแผงรายละเอียด ดู diff User/System ยืนยัน Apply แล้วเห็นผลจริงใหม่ และ Undo ได้จาก desktop UI.

**Blocked by:** 04: ประสานการเขียนและรีเฟรช Tools กับ Environment; 05: ควบคุมเวลาและ Operation IDs ผ่าน application capability; 07: เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A.

**Status:** in-review

**Kind:** Vertical slice / tool write journey

- [x] ใช้ backend plan เดิมพร้อม plan ID/baseline ไม่ใช้ illustrative diff ของ prototype; unavailable installations เลือกไม่ได้.
- [x] ยืนยันแผนเดียวกับที่แสดง คง User-area/System scope warnings, UAC เฉพาะตาม contract, stale-plan rebuild, cancellation และ rollback.
- [x] หลัง apply/undo refresh read models ผ่าน coordinator; ไม่ยืนยัน Effective Installation ด้วยการคัดลอก Selection ลงหน้าจอ.
- [x] Undo ย้อนเฉพาะสิ่งที่ Whichcraft เปลี่ยน รายงาน conflicts และไม่ลบ external PATH additions; local edit undo มีขอบเขตแยก.
- [x] app-level tests ครอบคลุม success, stale, declined UAC, failed apply, navigation และ delayed replies โดยใช้ state/effects จริง.
- [ ] ลอง User-only และ mixed-scope switch/Undo บน Windows ที่ควบคุมได้ พร้อมเปรียบเทียบ Registry types, new-process resolution และ UI; บันทึกกรณีที่ยังต้องใช้บัญชี/เครื่องอื่นในชุดตรวจท้าย.

## Comments

- **UI:** Desktop detail pane (`ShellInstallationDetail.tsx` in `DesktopShellApp`) — pick installation → `buildPlan` → `PlanDiffList` (real backend diffs) → `applyPlan`; Undo via existing `undoLast` / conflict display. Unavailable rows cannot start a plan.
- **Coordinator / MVI:** `useShellToolsWrite` wires `useToolsStore` + `createToolsRuntime(..., coordination)`; invalidation triggers `refresh` (same scopes as legacy). Apply/undo use existing effects (`registerReviewedPlan`, `beginPlanApply`, tool-result bindings, `readbackToolsState`). Overview selection/effective labels stay on rescan data, not copied from plan state.
- **Tests:** `desktopShellSwitch.test.tsx` (success, unavailable, stale rebuild, UAC via `applyToolPlanWithUac`, failed apply, late apply after tool switch, undo restored count). Minor reducer tweak: `refresh` no longer clears apply error so post-apply invalidation does not hide stale/UAC messages.
- **Windows manual (User-only / mixed-scope):** Not run in this agent environment (no driven Tauri desktop + Registry verification here). Leave checkbox open for human QA on a real Windows machine.

### Review round 1 (Grok 4.7)

- **Plan id:** Tests assert `applyToolPlan` / `applyToolPlanWithUac` receive the reviewed plan object; baseline invalidation before apply completes drops the result via existing `isPlanApplyCurrent` (plan UI remains, no false success).
- **Post-apply readback:** Success test flips Effective only after apply; detail **Effective installation** shows `17.0.2` not pre-apply `21.0.1`.
- **Errors:** `refreshed` clears `error` only when `loading` was true (inventory refresh); apply stale/UAC messages survive readback. `refresh` intent still does not clear apply errors.
- **NITs:** `selectTool` clears installations and sets loading; footer distinguishes **Building plan…** vs **Applying changes…**.
