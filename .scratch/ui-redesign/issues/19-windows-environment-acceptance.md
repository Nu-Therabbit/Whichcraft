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

### Agent result (2026-10-24)

Blocked, not passed. No packaged Tauri build was produced (`npm run tauri build` was not run). No real Windows session recorded Registry, UAC, account, shell, snapshot, or file-transfer evidence.

Every required case is **blocked**: `E-3`, `E-4`, `A-1`–`A-9`, `U-1`–`U-4`, `T-1`–`T-4`, `C-1`–`C-2`, `X-1`–`X-4`, plus the spec's added Environment, snapshot, and transfer cases. Frontend tests and `npm run build` are not acceptance. Ticket 21 must not remove the legacy fallback while these stay blocked.
