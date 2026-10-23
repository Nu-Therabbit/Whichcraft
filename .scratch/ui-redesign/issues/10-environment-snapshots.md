# 10: ใช้ Snapshots จริงจาก Environment

**What to build:** บันทึก จัดการ เปรียบเทียบ และเตรียมกู้คืน Snapshots จากแท็บ Environment โดยยังต้องดู diff และยืนยันก่อนเขียน.

**Blocked by:** 09: แก้ Environment variables ผ่าน workspace ใหม่.

**Status:** ready-for-agent

**Kind:** Vertical slice / backup and restore journey

- [ ] เชื่อม save/list/rename/delete, compare saved snapshots และ preview เทียบกับ Environment ปัจจุบันกับ persistence เดิม.
- [ ] restore stage ความต่างจริงรวม removals และ value types ตาม schema/version ที่รองรับ; การแทน pending changes ใช้การตัดสินใจที่ชัดเจน ไม่ทิ้งงานเงียบ ๆ.
- [ ] Snapshot ไม่ถูกอธิบายเป็น Tool Profile หรือการสำรองไฟล์การติดตั้ง และไม่สร้าง pre-apply snapshot ซ้ำกับ backend.
- [ ] ข้อมูล Snapshot เดิมยังเปิดได้ มี empty/error/loading/cancel states และแก้ Environment แล้ว Tool/Profile read models ถูก refresh.
- [ ] ทดสอบ app/API journey และลอง save/compare/restore ของค่า/ชนิด/รายการลบบน Windows จริงพร้อมตรวจหลังรีสตาร์ท.
