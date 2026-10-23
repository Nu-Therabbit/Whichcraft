# 06: ให้สถานะและการเตรียม mise ผ่าน application

**What to build:** การเปิดแอปและหน้า install ยังแสดง/เตรียม pinned mise ได้ตามเดิม แต่ Tauri commands เรียก application capability แทน concrete mise helpers.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Kind:** Prefactor / installer lifecycle correction

- [ ] เพิ่ม installer lifecycle status/preparation capability ที่ application เรียกผ่าน port และ composition เชื่อมกับ mise implementation เดิม.
- [ ] สถานะและการเตรียม mise เรียกผ่าน application methods; concrete download/process/checksum work ไม่รันบล็อก UI thread.
- [ ] คง prepare-on-start, first-use, pinned version/checksum, old-mise/offline และการโหลด Flutter plugin ที่ pin ไว้ตาม contract เดิม.
- [ ] ไม่เปลี่ยน wire response หรือ install-store/config isolation และไม่เพิ่ม dependency ต่อ mise หรือ Envarly ของผู้ใช้.
- [ ] application tests ใช้ fake lifecycle ตรวจ status/preparation success/failure/offline และ regression ของการเริ่มแอป/หน้า install; ตรวจ build ของ Windows path ที่เกี่ยวข้อง.
