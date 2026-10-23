# 11: นำเข้าและส่งออก Environment ผ่านไฟล์จริง

**What to build:** Import / Export ใช้ file dialogs และไฟล์จริง พร้อม preview, scope/ตัวแปรที่เลือก และ Apply ผ่าน flow staging เดิม.

**Blocked by:** 09: แก้ Environment variables ผ่าน workspace ใหม่.

**Status:** in-review

**Kind:** Vertical slice / transfer journey

- [x] JSON/REG import ใช้ parser เดิม พร้อม validation, legacy types, row selection และ merge/replace; ไม่ใช้ parser จำกัดของ prototype.
- [x] Export รองรับ All/User/System/Custom และ JSON, REG, PowerShell, DSC v2/v3, Ansible ตามเดิม; ใช้ destination และผล cancel/save/error จริง.
- [x] รักษา secret-related confirmation และ value-kind compatibility; preview/import ไม่เขียน Registry ก่อนยืนยัน pending changes.
- [x] การ import ไม่ทิ้ง staged work เดิมโดยไม่แจ้ง; export และ tab navigation ไม่กระทบการติดตั้งเครื่องมือ.
- [ ] ทดสอบ app/API journey รวม cancelled dialogs, invalid files และ progress/error states และตรวจไฟล์ที่ผลิตจริงบน Windows พร้อม round-trip ที่รองรับ.

## Comments

- **Shell:** Environment → Import / Export tab mounts production `ImportExportPanel` (`ImportTab` / `ExportTab`) with injected `useEnvironmentApi()` (`env=import-export`).
- **Replace staged:** `ImportTab` confirms via `import.confirm_replace_staged` when staging would replace existing pending edits.
- **No premature writes:** Parse/preview/stage only call `onStage`; Registry writes remain on Apply staged through the environment controller/coordinator.
- **Tests:** `desktopShellImportExport.test.tsx` (parse/stage without `applyEnvChanges`/`setEnvVar`, parse error UI, export via `exportVars` without extra installation rescans).
- **Windows manual (file dialogs, cancel/save, round-trip):** Not run in this agent environment. Leave checkbox open for human QA.
