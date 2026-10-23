# 13: ตั้งค่าที่เก็บและติดตั้งเครื่องมือจาก desktop UI

**What to build:** ตั้ง Install Store/Scan Roots/Terminal ใน Settings และติดตั้งเครื่องมือที่รองรับจากหน้า Developer tools ได้ พร้อมสถานะดาวน์โหลดและผล inventory จริง.

**Blocked by:** 04: ประสานการเขียนและรีเฟรช Tools กับ Environment; 06: ให้สถานะและการเตรียม mise ผ่าน application; 07: เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A.

**Status:** ready-for-agent

**Kind:** Vertical slice / install journey

- [ ] Settings รองรับ Install Store confirmation/history, Scan Roots และ preferred terminal; การเปลี่ยนที่เก็บไม่ทำให้การติดตั้งในที่เก็บเก่าหายจากรายการ.
- [ ] หน้า install ใช้ catalog/download/disk information และ pinned mise lifecycle ของ application จริง; Git ไม่เสนอ install/update.
- [ ] การติดตั้งมี progress/error/cancellation ที่ไม่หายเมื่อเปลี่ยนหน้า; environment ไม่เปลี่ยนเพียงเพราะติดตั้งโดยยังไม่ได้เลือกใช้.
- [ ] ใช้ ToolsStore ระดับอายุแอปและ coordinator จาก 04 สำหรับ invalidation/refresh หลัง install success, failure หรือ cancellation; late inventory responses ไม่ทับข้อมูลใหม่ และ navigation ไม่สร้าง operation/subscription ซ้ำ.
- [ ] ใช้ที่เก็บ/config ของ Whichcraft แยกจาก mise ของผู้ใช้ และคง Java vendor/Flutter backend/plugin pinning ตาม requirements.
- [ ] ทดสอบ UI/API journey และลอง first-use store/mise กับตัวอย่าง managed install บน Windows จริง รวม failed/cancelled download และ refresh inventory.
- [ ] รองรับ settings เดิม/old stores หลังรีสตาร์ทโดยไม่เปลี่ยน schema หรือกำหนด sample paths เป็น production defaults.
