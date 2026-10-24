# 15: อัปเดตในสายเดิม สลับ และเสนอถอนตัวเก่า

**What to build:** กด Update แล้วติดตั้งตัวใหม่ ดูแผนสลับ ย้าย profile references ตามที่เลือก และเสนอถอนตัวเก่าเป็น flow ต่อเนื่อง.

**Blocked by:** 13: ตั้งค่าที่เก็บและติดตั้งเครื่องมือจาก desktop UI; 14: ถอนการติดตั้งพร้อมเลือกตัวแทนและตรวจการใช้งาน.

**Status:** in-review

**Kind:** Vertical slice / update journey

- [x] ใช้ same-line Update contract เดิม; ไม่อัปเดตทับ Installation Root เก่า และไม่เปลี่ยน defaults ก่อนยืนยัน switch.
- [x] pending update, reviewed plan, affected profiles/repoint choice และ suggested uninstall replacement ผูกกับ installation/operation ที่ถูกต้อง.
- [x] stale/failed/cancelled switch ไม่ย้าย profile references หรือเริ่มถอนผิดจังหวะ และ progress/outcome อยู่ต่อเมื่อ navigation เปลี่ยน.
- [x] หน้าต่างเลือกไม่อ้าง fixture versions และ Git ไม่มี Update action.
- [ ] ทดสอบ app/API journey ตั้งแต่ install → review switch → repoint → uninstall offer และลอง update จริงใน environment ที่ควบคุมได้ พร้อมเทียบ old/new roots, profiles และ Registry.

## Comments

- **Shell:** `ShellInstallationDetail` mounts production `UpdateList` + check-for-updates; Git inspector omits update (switch-only).
- **Binding:** Same `registerReviewedPlan` / `applyToolPlan(reviewed)` path as legacy tools effects; repoint + `planUninstall` after successful switch unchanged.
- **Tests:** `desktopShellUpdate.test.tsx` asserts `applyToolPlan` receives the on-screen `planId` after update install; Git has no update button.
- **Windows manual (controlled update):** Not run in this agent environment. Leave checkbox open.

### Review round 1 (Grok 4.7 on cb458b4)

- **Plan-id gate:** `applyPlan` checks `isPlanApplyCurrent` before `applyToolPlan`; stale baseline, failed apply, and UAC/cancel paths assert no `repointProfiles` / `planUninstall`. Shell + effects tests cover invalidated reviewed plan after update install.
- **Tool scoping:** `updateInstalled` / `updateSwitched` carry `tool`; `selectTool` drops another tool’s pending update, plan, and uninstall; late cross-tool update results are dropped in reduce.
- **Git / happy-path assertions:** `/check for updates/i`, no Update button; `updateInstallation("java", "21.0.13")`, no `applyToolPlan` before Apply, repoint roots and uninstall offer on success.
- **Verification:** `npm test -- --run` (478 passed), `npm run lint` (clean).

### Review round 2 (Grok re-review on f5f2fc1)

- **Late uninstall plan:** `uninstallPlanned` and `switchPlanned` carry `tool`; reduce drops results for a non-current panel tool; `confirmUninstall` / `chooseReplacement` guard on `plan.installation.tool`.
- **Tests:** Shell `does not apply a late java uninstall offer to another tool when planUninstall is in flight`; effects/reduce late-plan cases; stale rebuild asserts `repointProfiles` not called on first stale apply.
- **Verification:** `npm test -- --run` (486 passed), `npm run lint` (clean).

### Review round 3 (Grok re-review on 4dbce98)

- **Tool locks:** `uninstallPlanned` / `switchPlanned` bypass the generic reduce tool gate; scope via `msg.tool ?? plan.installation.tool` / `msg.tool ?? plan.tool`. Effects tests assert production dispatches include `tool`; reduce test drops events that omit `tool` on the wrong panel.
- **In-flight:** Shell late `planUninstall` test releases the pending promise after switching tools, then asserts no cross-tool offer or `uninstall`; effects cover late `chooseReplacement` / `switchPlanned` the same way.
- **Confirm wedge:** Reduce refuses `confirmUninstall` busy when the stored plan is for another tool; effect clears `uninstall.busy` via `toolMutationDropped` when a mismatched confirm would otherwise stick.
- **Verification:** `npm test -- --run` (497 passed), `npm run lint` (clean).
