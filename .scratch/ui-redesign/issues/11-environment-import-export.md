# 11: นำเข้าและส่งออก Environment ผ่านไฟล์จริง

**What to build:** Import / Export ใช้ file dialogs และไฟล์จริง พร้อม preview, scope/ตัวแปรที่เลือก และ Apply ผ่าน flow staging เดิม.

**Blocked by:** 09: แก้ Environment variables ผ่าน workspace ใหม่.

**Status:** resolved

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

### Review round 1 (Grok 4.7)

- **Replace-staged test:** `desktopShellImportExport.test.tsx` mirrors snapshot restore (cancel keeps pending edit; accept replaces with import-only staging). Removing `pendingStagedCount` / confirm fails the test.
- **Whole-map replace:** `computeStageImport(..., replacePendingStaged)` clears orphan pending edits when the user confirmed replace (`stagingLogic.test.ts`).
- **Legacy modal:** `AppModals` passes `pendingStagedCount={staged.size}` into `ImportExportPanel`.

### Review round 2 (Grok 4.7)

- **Replace-staged cancel lock:** After a declined import replace confirm, shell test opens KEEP on Variables and asserts staged value `pending` before the accepted second stage — fails if cancel is ignored and import replaces pending work while the count stays at one staged name.

### Review round 2 approval

- Approved. After a declined confirm, the test opens KEEP and expects `pending` before the accepted stage. An ignored cancel that replaces KEEP fails that assertion. The accept path still expects the registry value. The Windows file round-trip checkbox stays open and is not a pass.
