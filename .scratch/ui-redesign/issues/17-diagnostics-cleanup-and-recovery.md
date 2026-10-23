# 17: ดูแล PATH, external changes และกู้คืนงานที่ค้าง

**What to build:** จาก UI ใหม่ยังตรวจ diagnostics, review external changes, ทำความสะอาด PATH และกู้คืน Apply ที่ค้างได้ โดยไม่ต้องย้อนกลับไปหน้า Envarly เดิม.

**Blocked by:** 08: สลับการติดตั้งผ่านแผนจริงและ Undo; 09: แก้ Environment variables ผ่าน workspace ใหม่.

**Status:** ready-for-agent

**Kind:** Vertical slice / maintenance journey

- [ ] Environment diagnostics และ externally detected changes แสดง context/affected scopes พร้อม review/actions ตาม contract เดิม ไม่ถูกลบไปพร้อม old header.
- [ ] PATH cleanup เสนอ duplicates/unavailable directories ผ่าน plan/diff, ยืนยัน Apply และ Undo; entries ที่อ้าง Environment variables ถูกขยายก่อนตัดสิน.
- [ ] startup/reopen แสดง incomplete journal และ actual readback พร้อม resume/rollback ที่มีอยู่ แม้ผู้ใช้ยังไม่เปิด tool inspector.
- [ ] recovery, partial failure, Undo conflict และ unfinished operations อยู่ในสถานะแอปและใช้ write admission เดียวกัน; ไม่มีการใช้ UI reset แทน backend recovery.
- [ ] ทดสอบ app/API maintenance journeys และลอง cleanup/Undo กับ controlled interruption/reopen บน Windows fixture พร้อมหลักฐาน Registry/journal และการคง external entries.
