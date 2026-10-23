# 08: สลับการติดตั้งผ่านแผนจริงและ Undo

**What to build:** เลือกการติดตั้งในแผงรายละเอียด ดู diff User/System ยืนยัน Apply แล้วเห็นผลจริงใหม่ และ Undo ได้จาก desktop UI.

**Blocked by:** 04: ประสานการเขียนและรีเฟรช Tools กับ Environment; 05: ควบคุมเวลาและ Operation IDs ผ่าน application capability; 07: เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A.

**Status:** ready-for-agent

**Kind:** Vertical slice / tool write journey

- [ ] ใช้ backend plan เดิมพร้อม plan ID/baseline ไม่ใช้ illustrative diff ของ prototype; unavailable installations เลือกไม่ได้.
- [ ] ยืนยันแผนเดียวกับที่แสดง คง User-area/System scope warnings, UAC เฉพาะตาม contract, stale-plan rebuild, cancellation และ rollback.
- [ ] หลัง apply/undo refresh read models ผ่าน coordinator; ไม่ยืนยัน Effective Installation ด้วยการคัดลอก Selection ลงหน้าจอ.
- [ ] Undo ย้อนเฉพาะสิ่งที่ Whichcraft เปลี่ยน รายงาน conflicts และไม่ลบ external PATH additions; local edit undo มีขอบเขตแยก.
- [ ] app-level tests ครอบคลุม success, stale, declined UAC, failed apply, navigation และ delayed replies โดยใช้ state/effects จริง.
- [ ] ลอง User-only และ mixed-scope switch/Undo บน Windows ที่ควบคุมได้ พร้อมเปรียบเทียบ Registry types, new-process resolution และ UI; บันทึกกรณีที่ยังต้องใช้บัญชี/เครื่องอื่นในชุดตรวจท้าย.
