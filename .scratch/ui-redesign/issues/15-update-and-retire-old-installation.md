# 15: อัปเดตในสายเดิม สลับ และเสนอถอนตัวเก่า

**What to build:** กด Update แล้วติดตั้งตัวใหม่ ดูแผนสลับ ย้าย profile references ตามที่เลือก และเสนอถอนตัวเก่าเป็น flow ต่อเนื่อง.

**Blocked by:** 13: ตั้งค่าที่เก็บและติดตั้งเครื่องมือจาก desktop UI; 14: ถอนการติดตั้งพร้อมเลือกตัวแทนและตรวจการใช้งาน.

**Status:** ready-for-agent

**Kind:** Vertical slice / update journey

- [ ] ใช้ same-line Update contract เดิม; ไม่อัปเดตทับ Installation Root เก่า และไม่เปลี่ยน defaults ก่อนยืนยัน switch.
- [ ] pending update, reviewed plan, affected profiles/repoint choice และ suggested uninstall replacement ผูกกับ installation/operation ที่ถูกต้อง.
- [ ] stale/failed/cancelled switch ไม่ย้าย profile references หรือเริ่มถอนผิดจังหวะ และ progress/outcome อยู่ต่อเมื่อ navigation เปลี่ยน.
- [ ] หน้าต่างเลือกไม่อ้าง fixture versions และ Git ไม่มี Update action.
- [ ] ทดสอบ app/API journey ตั้งแต่ install → review switch → repoint → uninstall offer และลอง update จริงใน environment ที่ควบคุมได้ พร้อมเทียบ old/new roots, profiles และ Registry.
