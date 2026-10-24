# 18: เปิด UI ใหม่เป็นค่าเริ่มต้นใน candidate build พร้อม legacy fallback

**What to build:** เปิด candidate build ของ Whichcraft แล้วได้ desktop UI ใหม่ที่ทำงานครบเป็นค่าเริ่มต้น และยังกลับไปใช้ legacy UI ได้หากพบ regression ระหว่างตรวจ Windows จริง.

**Blocked by:** 10: ใช้ Snapshots จริงจาก Environment; 11: นำเข้าและส่งออก Environment ผ่านไฟล์จริง; 12: ตรวจคำสั่ง ผลใน shell และเปิด Terminal จริง; 15: อัปเดตในสายเดิม สลับ และเสนอถอนตัวเก่า; 16: จัดการและ Apply Tool profiles จาก workspace ใหม่; 17: ดูแล PATH, external changes และกู้คืนงานที่ค้าง.

**Status:** in-review

**Kind:** Integration / candidate cutover

- [x] เปิด Developer tools เป็นค่าเริ่มต้นโดยไม่ต้องมี prototype query; ทุกเมนูใน spec เข้าถึง production flow จริง ไม่มี placeholder/simulate action.
- [x] เก็บ legacy entry point/presentation และ compatibility ที่ต้องใช้เป็น fallback ระหว่างชุด Windows 19/20; ใบนี้ไม่ลบ UI เดิม และไม่ถือเป็น final release gate.
- [x] เลือก presentation ผ่าน startup flag ที่มีเอกสาร: ค่าเริ่มต้นเป็น UI ใหม่ และ fallback เป็น legacy UI; ต้องปิด instance เดิมแล้วเปิดแอปใหม่เพื่อเปลี่ยนโหมด ห้ามสลับระหว่างงานที่กำลังทำหรือเปิดสองโหมดพร้อมกัน. ในแต่ละ process เลือกและ mount เพียงหนึ่ง presentation ก่อน bootstrap โดยใช้ composition/controller/coordinator ที่ย้ายแล้วจาก 03/04; ไม่มี root เดิมสร้าง services, listeners หรือ write path อีกชุด.
- [x] ยืนยันว่า implementation branch ตั้งต้นจาก production base และไม่มี prototype variants/switcher/state inspector/sample actions ปนมา; ใช้ primary source บน throwaway branch เป็น reference โดยไม่ลบ Environment backend/types ที่ยังจำเป็น.
- [x] ตรวจ action/parity inventory ที่ 02 เก็บไว้ตั้งแต่ต้น รวม themes/languages, update notice, refresh, licences/attribution, account context, diagnostics, Undo/recovery และ settings ให้แต่ละรายการมีผลลัพธ์/ตำแหน่งใหม่ ไม่เริ่ม audit รายการหลัง migration เสร็จ (`desktopShellHeaderParity.test.tsx` locks language/update/licences on default shell).
- [ ] app-level journeys, relevant frontend/Rust tests, architecture dependency checks และ packaged build ผ่าน; ตรวจ desktop minimum/default sizes, keyboard/focus, themes และขอบเขต subscriptions ระหว่าง navigation.
- [ ] ตรวจ startup ของทั้งสองโหมดว่ามี bootstrap/subscriptions เพียงชุดเดียวและเข้า shared write admission/refresh จริง; ทดสอบปิดแอปแล้วเปิดอีกโหมดและอ่าน Windows state/recovery กลับตาม contract เดิม ไม่อ้างว่า pending edits หรือ operation ในหน่วยความจำย้ายข้าม process ได้. ชุด 19/20 ต้องเก็บ acceptance จาก UI ใหม่ ส่วนการเปิด fallback แยกเป็น fallback smoke/regression comparison.
- [ ] wire/storage compatibility และ Windows integration contracts ไม่เปลี่ยนโดยไม่มีข้อกำหนด; แพ็กเกจทำงานโดยไม่ต้องติดตั้ง/เปิด Envarly แยก (`npm run tauri build` not run in agent environment).
- [x] ระบุ candidate build และวิธีเปิด fallback ให้ผู้ทดสอบใช้; งานถอด fallback/compatibility ที่ไม่ใช้ถูกกำหนดไว้ใน 21 ซึ่งรอให้ 19 และ 20 ผ่านก่อน.

## Comments

### Startup flag (ticket 18)

- **Default:** Desktop shell (`DesktopShellApp`) with no query flag.
- **Legacy fallback:** Relaunch with `?presentation=legacy` in the URL. `main.tsx` calls `freezeAppPresentation(window.location.search)` once before `ReactDOM.createRoot`; `App` receives the frozen value and does not re-read `location.search`.
- **No live switch:** Removed Legacy UI link and preview footer from `DesktopShellApp`. Change mode by closing the app and relaunching with or without the legacy flag.
- **Shared bootstrap:** Both modes mount under the same `AppServicesProvider` and `WriteCoordinatorProvider` in `main.tsx`.
- **Tests:** `App.presentation.test.tsx` — default shell vs legacy startup, no flip after query change; `appPresentation.test.ts` — parse/freeze and shell href without `presentation` param.
- **Packaged / relaunch evidence:** Not produced in this agent environment (`npm run tauri build` not run here). Windows manual checkboxes for 19/20 remain open.
- **Verification:** `npm test -- --run` (504 passed), `npm run lint` (clean). `npm run build` failed in this environment on existing `src/features/tools/effects.ts` / `reduce.ts` TS errors (not introduced by cutover). `npm run tauri build` not run.

### Build fix (follow-up)

- **TypeScript:** `applyPlan` stale rebuild uses a mutable box so CFA sees the post-`withToolsWrite` dispatch; `uninstallPlanned` / `switchPlanned` reduce via dedicated type guards in `uninstallPlanEvents.ts` (generic tool gate unchanged for other events).
- **Verification:** `npx tsc --noEmit` (clean), `npm test -- --run` (504 passed), `npm run lint` (clean), `npm run build` (succeeded).

### Review round 1 (Grok on 19f0fbd..f23576f)

- **Plan events:** `uninstallPlanEvents.ts` requires the event `tool` field (no fallback to `plan.installation.tool` / `plan.tool`); null `switchPlanned` clears only when `tool` matches the panel.
- **Shell parity:** `ShellAppHeaderActions` on `DesktopShellApp` — language (`useI18n`), update notice (`useUpdateCheck` + opener), licences (`setDialog("licenses")` → production `LicensesPanel`); `ShellRegistryErrorBanner` on default tools page.
- **Evidence:** Packaged-app / `tauri build` checkboxes remain open; Windows relaunch unchanged.
- **Verification:** `npx tsc --noEmit` (clean), `npm test -- --run` (507 passed), `npm run lint` (clean), `npm run build` (succeeded). `npm run tauri build` not run.
