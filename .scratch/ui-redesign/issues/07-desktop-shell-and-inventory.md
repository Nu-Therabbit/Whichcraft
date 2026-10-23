# 07: เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A

**What to build:** เปิดหน้า desktop A ที่ค้นหา/สแกนเครื่องมือจริงได้ เห็นการติดตั้งที่มีผลจริงและการเลือกที่ต่างกัน แล้วเปิดรายละเอียดด้านข้าง รวม Inventory Only ของ SDK.

**Blocked by:** 02: ขยาย feature contracts และจุดประกอบ API แบบรักษาความเข้ากันได้.

**Status:** resolved

**Kind:** Vertical slice / read journey

- [x] สร้าง production desktop shell จากดีไซน์ A: navigation สี่ส่วน, compact command/status bars และ docked details; ไม่มี headline แบบ marketing หรือ fixture values.
- [x] ใบนี้เป็น read-only journey: ทำ query/request/account isolation ที่จำเป็นได้โดยไม่ต้องรอ Environment refactor/coordinator ทั้งมด; ไม่เพิ่ม write entry point ใหม่จาก shell ก่อน flow นั้นมี coordinator และยังใช้ legacy entry สำหรับ flow ที่ยังไม่ได้ย้าย โดยไม่เริ่ม bootstrap/subscriptions ซ้ำเพราะเปิด view ใหม่.
- [x] โหลด per-tool inventory สำหรับ Java, Node.js, Python, Go, Flutter, Git ด้วย API เดิม; แยก overview state จาก selected-tool state และผูก late results กับ request/tool/account identity.
- [x] แสดง Installation Root, full version/vendor, ownership, unavailable และจำนวนการติดตั้งจากข้อมูลจริง; แสดง Selection กับ Effective Installation แยกกัน ไม่ใช้เพียงการมี entry ใน PATH เป็นหลักฐาน.
- [x] ค้นหาและ Rescan ได้ พร้อม loading/empty/error states รายเครื่องมือ; Android/MSVC เป็น Inventory Only และ Python launcher/Store stub แสดงข้อมูลแยกตาม contract เดิม.
- [x] ธีม ภาษาที่รองรับ accessible names/focus และขนาดหน้าต่างเดิมใช้งานได้; legacy presentation ยังเข้าถึงได้ระหว่างย้าย และไม่เปลี่ยน default เป็นหน้าที่เหลือ placeholder จน cutover.
- [ ] ทดสอบ read journey ผ่าน UI/controller/API seam และลอง discovery/read-only บน Windows จริง พร้อมเก็บหลักฐานที่หน้าต่าง 1200×760 และ 900×600.

## Comments

- Preview entry: `?presentation=desktop-shell` (default remains legacy). Link back via `Legacy UI` / clearing the query (`src/lib/appPresentation.ts`).
- Production shell: `src/features/shell/DesktopShellApp.tsx` + `useToolsOverview.ts` (request/account generation binding, no Tools `started` / mise bootstrap in this view).
- Non-tool nav items and Install tool route to legacy UI; read-only status bar documents preview mode.
- Automated evidence: `src/features/shell/desktopShell.test.tsx` (fake API read journey, selection vs effective in docked inspector).
- **Windows screenshots (1200×760, 900×600):** not captured in this agent environment (desktop app not launched here); checkbox left open.

### Review round 1

- `useToolsOverview`: account token bound to scan generation; stale results clear in-flight loading; account read errors surfaced (not `"local"`). Tests in `useToolsOverview.test.ts`.
- Overview cards show “Scanning installations…” instead of `0` while loading; `desktopShell.test.tsx` clicks Rescan and asserts API calls.
- `desktop_shell` i18n keys copied to ja/ko/vi/zh-CN/ru (English strings until translated).

### Review round 2

- Failed/superseded rescans retire `activeScan`, clear `sdkLoading`, and `loadTool` requires current request generation so stale lists cannot commit after account failure (`useToolsOverview.test.ts`).

### Review round 3

- Approved. A failed newer account read retires the scan, and an older in-flight list cannot commit under the error banner. Windows screenshots at 1200×760 and 900×600 were not captured; that checkbox stays open and is not a pass.
