# 20: ตรวจ Windows จริง: inventory และวงจรการติดตั้งเครื่องมือ

**What to build:** มีผลทดสอบ packaged app ตั้งแต่ค้นหาเครื่องมือจนติดตั้ง สลับ อัปเดต โปรไฟล์ และถอน พร้อมเทียบกับไฟล์/เวอร์ชัน/ค่าเริ่มต้นจริง.

**Blocked by:** 18: เปิด UI ใหม่เป็นค่าเริ่มต้นใน candidate build พร้อม legacy fallback.

**Status:** ready-for-agent

**Kind:** Acceptance / Windows end-to-end

- [ ] ใช้ candidate build จาก 18 โดยยังเก็บ legacy fallback; ผูกผลกับเกณฑ์รับงานจริง `D-1`–`D-7`, `E-1`–`E-2`, `E-5`, `I-1`–`I-17`, `S-1`–`S-2`, `R-1`–`R-13`, `P-1`, `F-1`–`F-6` ตามตาราง section/ID mapping และเชื่อมหลักฐาน switch/Undo กับชุด 19 โดยไม่ใช้ Q decision IDs แทน case IDs.
- [ ] ตรวจ representative discovery ของ managed/external/duplicate-version/unavailable installations, Scan Roots, junction exclusions, Python supplemental และ Inventory Only SDKs.
- [ ] เก็บ acceptance evidence ผ่าน UI ใหม่; ใช้ผล fallback startup smoke จาก 18/19 หรือเติมเฉพาะที่ยังขาด โดยปิด instance เดิมแล้วเปิดใหม่ก่อนเลือกอีกโหมด ไม่เปิดสองโหมดพร้อมกันและไม่ใช้ผล legacy UI แทน production acceptance ของ UI ใหม่.
- [ ] ตรวจ supported install backends, first-use/store/mise preparation, pinned config/plugin/checksum behaviour และ failed/cancelled/offline cases ที่เกี่ยวข้องกับ UI ใหม่.
- [ ] ตรวจ switch actual Effective Installation, same-line update, profile-match/partial profile/install-missing/repoint และสถานะหลัง restart/เปลี่ยนที่เก็บ; ใช้ backend-known versions จริง ไม่ใช่ fixture expectations.
- [ ] ตรวจ managed uninstall และ representative external/folder-only methods, replacement preview, in-use/refused/incomplete/cancelled removal โดยใช้ disposable fixtures แทน working installations.
- [ ] เทียบ roots/executable versions, Registry/new-process results, store contents และ profile references; บันทึก pass/fail/blocked พร้อมสาเหตุเมื่อเครือข่าย บัญชี หรือ shell variant ใช้ไม่ได้.
- [ ] รวบรวม evidence จาก slices ที่ตรวจ Windows ไปแล้วและเติม cross-flow/regression ที่เหลือ; ประเมินร่วมกับชุด Environment ก่อนสรุป production acceptance.
- [ ] required fail/blocked ยังไม่ถือว่า gate ของ 21 ผ่าน; เก็บ fallback สำหรับเปรียบเทียบ/ใช้งานระหว่างแก้ regression และห้ามถอดก่อนทั้งสองชุดผ่าน.
