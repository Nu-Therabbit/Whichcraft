# 14: ถอนการติดตั้งพร้อมเลือกตัวแทนและตรวจการใช้งาน

**What to build:** ถอนจากแผงรายละเอียดได้โดยเห็นวิธีถอน ผลกระทบ และแผนสลับตัวแทนก่อน พร้อมผลตรวจว่าถอนครบจริงหรือไม่.

**Blocked by:** 08: สลับการติดตั้งผ่านแผนจริงและ Undo.

**Status:** ready-for-agent

**Kind:** Vertical slice / removal journey

- [ ] ใช้ uninstall plan/use case เดิมสำหรับ Managed และ External Installations พร้อมแสดง method, usage/process/folder locks, affected profiles และ refusal reasons.
- [ ] ตัวที่เป็น Selection หรือ Effective Installation ต้องเลือกและ review ตัวแทนก่อนถอน; plan ที่ยืนยันต้องตรงกับที่แสดง และ stale switch ต้องให้ตรวจใหม่.
- [ ] คง normal external uninstaller behaviour, ไม่มี silent/kill เพิ่มเอง, folder-only/Recycle Bin protection และ incomplete/cancelled outcomes.
- [ ] มี repoint choices, open-folder/rescan และ unfinished-uninstall actions ที่เกี่ยวข้อง; ผลจริงถูก refresh ผ่าน coordinator.
- [ ] ทดสอบ app/API success/refused/in-use/stale/cancel/incomplete และลอง managed หรือ disposable external/folder fixture บน Windows; ไม่ถอน working tools เพื่อให้ได้ coverage.
