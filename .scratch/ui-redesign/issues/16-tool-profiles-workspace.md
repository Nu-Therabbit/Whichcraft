# 16: จัดการและ Apply Tool profiles จาก workspace ใหม่

**What to build:** สร้าง/ลบโปรไฟล์ เลือกเฉพาะเครื่องมือที่ต้องการ ดูว่าตรงกับการติดตั้งที่มีผลจริงหรือไม่ และติดตั้งตัวที่ขาดก่อน Apply ได้.

**Blocked by:** 08: สลับการติดตั้งผ่านแผนจริงและ Undo; 13: ตั้งค่าที่เก็บและติดตั้งเครื่องมือจาก desktop UI.

**Status:** ready-for-agent

**Kind:** Vertical slice / profile journey

- [ ] ใช้ saved profiles จริงและ vendor/full-version pins ตาม domain; ไม่มี active-profile mode หรือการใช้ Snapshot แทน Tool Profile.
- [ ] create/delete/review/apply กระทบเฉพาะ tools ที่รวมในโปรไฟล์ และสถานะ match ถูกรีเฟรชหลัง external/environment changes.
- [ ] กรณี unavailable/missing pins ไม่ Apply ครึ่งชุด; install-missing/store confirmation/download information ใช้ workflow จริงและไม่เสนอสิ่งที่ติดตั้งผ่านแอปไม่ได้.
- [ ] รู้จัก affected profile/repoint outcomes จาก update/uninstall โดยไม่ทำ duplicate write; conflicting Environment staging ใช้ coordinator เดิม.
- [ ] ทดสอบ app/API partial profile, duplicate-installation pin, unavailable/missing และ profile refresh พร้อมลอง partial-profile/install-missing ที่ควบคุมได้บน Windows.
