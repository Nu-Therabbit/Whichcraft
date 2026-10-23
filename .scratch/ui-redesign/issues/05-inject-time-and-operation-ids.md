# 05: ควบคุมเวลาและ Operation IDs ผ่าน application capability

**What to build:** การสร้างแผน การบันทึก Apply และถอนการติดตั้งยังทำงานเดิม แต่ use cases ทดสอบเวลาและ ID ได้แน่นอนโดยไม่เรียก persistence หรือ wall clock โดยตรง.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Kind:** Prefactor / Rust dependency correction

- [ ] เพิ่ม Time/Operation IDs capability ขนาดเล็กที่ application เป็นเจ้าของ; composition จริงจัดหา adapter และ application tests ใช้ค่าควบคุมได้.
- [ ] ย้ายการสร้าง plan/journal/uninstall IDs และ recorded timestamps ที่เกี่ยวข้องออกจาก concrete persistence และ direct wall-clock reads ใน production application.
- [ ] ไม่เปลี่ยน persisted identifier/timestamp compatibility, schema, recovery/Undo semantics หรือ Tauri contracts; journal I/O ยังคงผ่าน Store.
- [ ] ตรวจ plan, profile plan, PATH cleanup, apply และ uninstall ผ่าน application seam ด้วย fake dependencies โดย assert outcomes/records ที่มองเห็นได้.
- [ ] ขยาย dependency checks ให้แยก production กับ cfg(test) และ inherited adapter/type exception ตาม ADR-0005; ไม่ตีความ test-only filesystem imports เป็นข้อผิดพลาด production.
