# 13: ตั้งค่าที่เก็บและติดตั้งเครื่องมือจาก desktop UI

**What to build:** ตั้ง Install Store/Scan Roots/Terminal ใน Settings และติดตั้งเครื่องมือที่รองรับจากหน้า Developer tools ได้ พร้อมสถานะดาวน์โหลดและผล inventory จริง.

**Blocked by:** 04: ประสานการเขียนและรีเฟรช Tools กับ Environment; 06: ให้สถานะและการเตรียม mise ผ่าน application; 07: เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A.

**Status:** resolved

**Kind:** Vertical slice / install journey

- [x] Settings รองรับ Install Store confirmation/history, Scan Roots และ preferred terminal; การเปลี่ยนที่เก็บไม่ทำให้การติดตั้งในที่เก็บเก่าหายจากรายการ.
- [x] หน้า install ใช้ catalog/download/disk information และ pinned mise lifecycle ของ application จริง; Git ไม่เสนอ install/update.
- [x] การติดตั้งมี progress/error/cancellation ที่ไม่หายเมื่อเปลี่ยนหน้า; environment ไม่เปลี่ยนเพียงเพราะติดตั้งโดยยังไม่ได้เลือกใช้.
- [x] ใช้ ToolsStore ระดับอายุแอปและ coordinator จาก 04 สำหรับ invalidation/refresh หลัง install success, failure หรือ cancellation; late inventory responses ไม่ทับข้อมูลใหม่ และ navigation ไม่สร้าง operation/subscription ซ้ำ.
- [x] ใช้ที่เก็บ/config ของ Whichcraft แยกจาก mise ของผู้ใช้ และคง Java vendor/Flutter backend/plugin pinning ตาม requirements.
- [x] ทดสอบ UI/API journey (`desktopShellSettingsInstall.test.tsx`).
- [ ] ลอง first-use store/mise กับตัวอย่าง managed install บน Windows จริง รวม failed/cancelled download และ refresh inventory.
- [x] รองรับ settings เดิม/old stores หลังรีสตาร์ทโดยไม่เปลี่ยน schema หรือกำหนด sample paths เป็น production defaults.

## Comments

- **Settings:** `ShellSettingsView` reuses `ToolsSettings`; loads settings via app-lifetime `ShellToolsProvider` (`started` + `refresh` on mount). Store change triggers rescan without dropping installations from the previous store path (tested).
- **Install:** `?presentation=desktop-shell&install=1` opens `ShellInstallView` with production `InstallSection`; `selectTool` before `openInstallList`. Footer shows `status_installing` while `install.busy`. Git install button disabled / switch-only message.
- **Coordinator:** Invalidation after install flows through existing `effects.ts` + `subscribeInvalidation` on the single shell tools store; overview reads no longer call `beginToolsRead` (avoids racing settings load).
- **Windows manual (first-use store/mise, failed/cancel download):** Not run in this agent environment. Leave checkbox open for human QA.

### Review round 1 (Grok 4.7)

- Install success/failure/tool-switch now calls `coordination.invalidate` (`tools-installations`, `shell-overview`, …) and reloads the panel; overview uses `overview-inventory` read keys so tools-store reloads do not cancel in-flight grid reads.
- `ShellInstallView` skips repeat `openInstallList` when versions are already loaded or install is busy; install errors survive `install=1` navigation via `install.retainErrorOnRefresh`.
- Tests: `effects.test.ts` (install invalidate paths), `useToolsOverview.test.ts` (read key + revision drop), expanded `desktopShellSettingsInstall.test.tsx` (overview refresh after install, settings fields, Git install/update exclusion, no `applyToolPlan` on install-only).

### Review round 1 approval

- Approved. Install success, failure, and a tool switch during install invalidate the coordinator, and those tests fail if `invalidate()` is removed. Remounting the install page does not start a second catalog fetch or clear the error. The Windows first-use checkbox stays open and is not a pass. Switching away does not abort an in-flight download; it still invalidates and clears the busy flag when the download finishes.
