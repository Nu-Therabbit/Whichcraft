# 06: ให้สถานะและการเตรียม mise ผ่าน application

**What to build:** การเปิดแอปและหน้า install ยังแสดง/เตรียม pinned mise ได้ตามเดิม แต่ Tauri commands เรียก application capability แทน concrete mise helpers.

**Blocked by:** None (can start immediately).

**Status:** in-review

**Kind:** Prefactor / installer lifecycle correction

- [x] เพิ่ม installer lifecycle status/preparation capability ที่ application เรียกผ่าน port และ composition เชื่อมกับ mise implementation เดิม.
- [x] สถานะและการเตรียม mise เรียกผ่าน application methods; concrete download/process/checksum work ไม่รันบล็อก UI thread.
- [x] คง prepare-on-start, first-use, pinned version/checksum, old-mise/offline และการโหลด Flutter plugin ที่ pin ไว้ตาม contract เดิม.
- [x] ไม่เปลี่ยน wire response หรือ install-store/config isolation และไม่เพิ่ม dependency ต่อ mise หรือ Envarly ของผู้ใช้.
- [x] application tests ใช้ fake lifecycle ตรวจ status/preparation success/failure/offline และ regression ของการเริ่มแอป/หน้า install; ตรวจ build ของ Windows path ที่เกี่ยวข้อง.

## Comments

- 2026-10-24: Added `InstallerLifecycle` port with `MiseStatus` DTO, `MiseInstallerLifecycle` adapter, and `FakeInstallerLifecycle`; `whichcraft_mise_status` / `whichcraft_prepare_mise` now call `App` (prepare still uses `off_main`).
- Review round 1: Added `prepare_fails` fake (checksum) distinct from offline; ready-app test calls `prepare_mise` and lists offered remote versions via fake tool catalog.
