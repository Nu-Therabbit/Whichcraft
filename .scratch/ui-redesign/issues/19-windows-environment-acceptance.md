# 19: ตรวจ Windows จริง: Environment, permissions, shell และ recovery

**What to build:** มีผลทดสอบจาก packaged app ยืนยันว่าหน้าใหม่ตรงกับ Registry, account permissions, shell และข้อมูล Environment จริง ไม่ได้ผ่านเฉพาะ API จำลอง.

**Blocked by:** 18: เปิด UI ใหม่เป็นค่าเริ่มต้นใน candidate build พร้อม legacy fallback.

**Status:** ready-for-human

**Kind:** Acceptance / Windows end-to-end

- [ ] ใช้ candidate build จาก 18 โดย legacy fallback ยังอยู่; ผูกผลกับเกณฑ์รับงานจริง `E-3`–`E-4`, `A-1`–`A-9`, `U-1`–`U-4`, `T-1`–`T-4`, `C-1`–`C-2`, `X-1`–`X-4` และ Environment/snapshot/transfer cases ที่เพิ่มใน spec โดยอ้างตาราง section/ID mapping; Q หมายถึงที่มาของ decision ไม่ใช่ test-case ID.
- [ ] ตรวจ production app navigation/keyboard/themes/window sizes และ Variables, supported types, staging/apply/discard, diagnostics, external changes, PATH cleanup/Undo.
- [ ] เก็บ acceptance evidence ผ่าน UI ใหม่; ตรวจ fallback smoke แยกโดยปิด instance เดิมแล้วเปิดใหม่ด้วย startup flag ตาม 18 ยืนยัน mount/bootstrap/subscriptions ชุดเดียวและ recovery/readback จากข้อมูลจริง ไม่ใช้ผลจาก legacy UI แทนผลของ UI ใหม่.
- [ ] ตรวจ User/System writes, UAC consent/cancel, alternate administrator account/OtherUser ตามสภาพแวดล้อมที่ต้องใช้, stale plans, rollback, conflicts และ controlled interruption/recovery.
- [ ] ตรวจ persistent Snapshots, real JSON/REG transfer, export formats/scopes, legacy/value-kind/secret-confirmation paths และ cancellation/readback ตาม spec.
- [ ] ตรวจ command lookup รวม full path/PATHEXT/no-match/shadowing และ actual shell/terminal resolution ด้วย non-inherited process environment ไม่ใช้ PATH ของ test runner เป็นหลักฐาน.
- [ ] บันทึก OS/build/account configuration, steps, expected/actual state และหลักฐานก่อน/หลัง; backup/readback/restore ตาม acceptance procedure และแยก pass/fail/blocked ไม่ถือ skipped เป็น passed.
- [ ] ใช้ isolated/disposable fixtures หรือบัญชี/เครื่องทดสอบที่เหมาะสมสำหรับกรณีเขียน/ขัดจังหวะ; รวมผลกับชุด Windows เครื่องมือโดยไม่รันซ้ำเมื่อไม่มีเหตุใหม่ และรายงานข้อจำกัดที่ยังไม่ผ่าน.
- [ ] รายงาน required cases ที่ fail/blocked อย่างชัดเจน และไม่ถือว่าเกณฑ์พร้อมลบ fallback ใน 21 ผ่านจนกว่าจะจัดการครบ; เมื่อพบ regression ให้ใช้ fallback ที่ยังคงไว้สำหรับเปรียบเทียบ/ทำงานต่อ.

## Comments

### Initial agent result (2026-10-24; superseded by installed-candidate report below)

Blocked, not passed. No packaged Tauri build was produced (`npm run tauri build` was not run). No real Windows session recorded Registry, UAC, account, shell, snapshot, or file-transfer evidence.

At that checkpoint every required case was recorded as **blocked**: `E-3`, `E-4`, `A-1`–`A-9`, `U-1`–`U-4`, `T-1`–`T-4`, `C-1`–`C-2`, `X-1`–`X-4`, plus the spec's added Environment, snapshot, and transfer cases. Frontend tests and `npm run build` are not acceptance. Ticket 21 must not remove the legacy fallback while these stay blocked.

- 2026-10-24: Partial agent evidence (not a suite run) is recorded in [ticket 18](18-production-cutover-and-contract.md) under the "Agent Windows run" sections and covers U-1/A-2/T-2 (HKCU apply and Undo), C-1 (command lookup), real snapshot save/compare/stage-restore, `.reg` import and export cancellation, and PATH cleanup with Undo. Required cases that need UAC, other accounts or a clean machine are still open.


### Current installed-candidate result (24–25 October 2026)

**Partial; not a suite pass.** [Detailed evidence, package hashes, restoration and every original case ID](../acceptance/2026-10-24/RESULT.md) replace the initial blanket-blocked assessment above. New UI results are kept separate from legacy smoke, prior non-packaged runs and backend contracts.

Real packaged User Java/profile and mixed User/System Go switch/Undo, actual shell readback, native custom JSON export, keyboard tabs/themes and cross-mode persisted recovery are recorded. Final Registry exports match both baselines byte-for-byte; original Selection/app-data configuration was restored. Seeded recovery proves readback/resume/rollback, not an actual process kill. Cancellation contract cleans up then fails when no native prompt appears; the user confirmed no UAC dialog was shown, so A-3 remains blocked.

Continuation on 25 October, same release executable, UI Automation: U-2 and U-3 passed on User Environment and were restored; U-4 was not forced. E-3 passed with a temporary PowerShell profile that was removed. T-4 passed for Windows PowerShell and cmd; the setting was returned to Windows Terminal. A test snapshot was saved and renamed. One earlier acceptance snapshot file was deleted by a mis-aimed confirmation and was not recovered. Still required: interactive consent/cancel and account boundaries, partial Undo failure, real interrupted Apply, full value-kind/secret/export coverage, a live T-3 tab count, and minimum-size review. Alternate admin account and configured shell variants are unavailable here. Keep status `ready-for-human` and fallback intact.


### Autonomous continuation (25 October 2026)

Native 900x600 Environment editing/restore/JSON+REG round-trip/all-six-format fixture export and legacy/delete/secret cancellation now have direct evidence. A-9 User review path passed with two external edits preserved and a fresh diff; waiting-for-UAC is still unavailable. Real child-process interruption resume/rollback passed separately, not an installed-GUI kill. Fixed stale snapshot staging, async native confirmations, narrow detail overflow and raw PATH merge loss. Required cases still open are listed explicitly; status and legacy gate remain unchanged. See [evidence and precise remaining gates](../acceptance/2026-10-25/RESULT.md).

Final installed NSIS U-2 retest also passed: after a real User Java Apply and external PATH append, native Undo preserves the original empty PATH segment and the external entry exactly, restores JAVA_HOME/kinds, and leaves the chosen Selection mismatch. Final MSI/NSIS install/startup/CLI/uninstall and MSI legacy startup passed; both Registry exports still match the baseline exactly.
