# 09: แก้ Environment variables ผ่าน workspace ใหม่

**What to build:** เข้า Environment → Variables แล้วค้นหา สร้าง แก้ ลบ และดูรายการเปลี่ยนแปลงก่อน Apply/Discard กับข้อมูล Windows จริง.

**Blocked by:** 04: ประสานการเขียนและรีเฟรช Tools กับ Environment; 07: เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A.

**Status:** resolved

**Kind:** Vertical slice / environment edit journey

- [x] mount Environment controller ใน navigation ใหม่และสร้าง accessible tab container สำหรับ Variables, Snapshots, Import / Export, Check command; แท็บที่ยังย้ายไม่ครบยังเข้าถึง production workflow เดิมได้ระหว่าง migration.
- [x] Variables ใช้บัญชีและ scope จริง แสดง supported value kinds และ list/PATH editors พร้อม search/filter, create/edit/delete และ validation เดิม.
- [x] staging/review/apply/discard, progress/error และ local undo ทำงานผ่าน controller/coordinator; เปลี่ยนแท็บไม่เขียน Windows หรือทิ้ง pending edits.
- [x] คง account selection/permission semantics รวมการห้ามเปลี่ยน context ขณะมี staged changes และไม่รับ late response ของบัญชีเก่า.
- [x] ทดสอบตั้งแต่ UI ถึง injected API รวม conflicts กับ tool writes และ apply-progress setup failure.
- [ ] ลอง edit/apply/discard ของ string, expand-string และ PATH บน Windows จริง เปรียบเทียบค่ากับชนิดใน Registry และผล refresh ของ tool overview.

## Comments

- **Shell:** `?presentation=desktop-shell&page=environment&env=…` — `ShellEnvironmentWorkspace` mounts `EnvironmentProvider` / `useEnvironmentController` with tab panels for Variables (`Sidebar` + `DetailPanel`), Snapshots (`SnapshotPanel`), Import/Export (`ImportExportPanel`), Check command (`CheckCommandPanel`). Staging modals reuse `AppModals`.
- **Coordinator:** Staged edits set environment pending; tool apply blocked while pending (`desktopShellEnvironment.test.tsx`). Apply-staged uses write admission; progress subscription failure tested.
- **Windows manual (string/expand-string/PATH):** Not run in this agent environment (no driven desktop + Registry verification). Leave checkbox open for human QA on a real Windows machine.

### Review round 1 (Grok 4.7)

- **Apply-progress test:** `desktopShellEnvironment.test.tsx` now asserts visible subscribe error, no `applyEnvChanges`, retry apply without `WRITE_BUSY`, and cross-page staged-modal error retention.
- **Modal state:** `ShellEnvironmentUiProvider` keeps `AppModals` mounted across shell pages; reopens staged dialog while `stagedBusy` / `stagedError`.
- **DetailHeader:** `restartAsAdmin` uses injected `platform.restartAsAdmin()` via `useAppServices`.
- **Inventory UI-03–09:** Evidence cells distinguish production wiring vs what `desktopShellEnvironment.test.tsx` actually exercises.

### Review round 1 approval

- Approved. The apply-progress test fails if the subscribe catch or admission release is removed. The staged error stays visible after leaving Environment. Restart-as-administrator uses the injected platform API. The Windows Registry checkbox stays open and is not a pass.
