# 05: ควบคุมเวลาและ Operation IDs ผ่าน application capability

**What to build:** การสร้างแผน การบันทึก Apply และถอนการติดตั้งยังทำงานเดิม แต่ use cases ทดสอบเวลาและ ID ได้แน่นอนโดยไม่เรียก persistence หรือ wall clock โดยตรง.

**Blocked by:** None (can start immediately).

**Status:** in-review

**Kind:** Prefactor / Rust dependency correction

- [x] เพิ่ม Time/Operation IDs capability ขนาดเล็กที่ application เป็นเจ้าของ; composition จริงจัดหา adapter และ application tests ใช้ค่าควบคุมได้.
- [x] ย้ายการสร้าง plan/journal/uninstall IDs และ recorded timestamps ที่เกี่ยวข้องออกจาก concrete persistence และ direct wall-clock reads ใน production application.
- [x] ไม่เปลี่ยน persisted identifier/timestamp compatibility, schema, recovery/Undo semantics หรือ Tauri contracts; journal I/O ยังคงผ่าน Store.
- [x] ตรวจ plan, profile plan, PATH cleanup, apply และ uninstall ผ่าน application seam ด้วย fake dependencies โดย assert outcomes/records ที่มองเห็นได้.
- [x] ขยาย dependency checks ให้แยก production กับ cfg(test) และ inherited adapter/type exception ตาม ADR-0005; ไม่ตีความ test-only filesystem imports เป็นข้อผิดพลาด production.

## Comments

- 2026-10-24: Added `OperationIds` port, `SystemOperationIds` adapter, and `FakeOperationIds`; wired through `App`, plan/apply/profile/PATH/uninstall use cases, and a production-only dependency scan in `application/mod.rs` tests.
- Review round 1: Profile seam test asserts `plan_id` uses injected IDs; removed dead `new_journal_id` from persistence; dependency scan strips `pub(crate) mod` test blocks and lives in `layer_tests.rs`.
