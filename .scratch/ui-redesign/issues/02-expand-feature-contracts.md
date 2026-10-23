# 02: ขยาย feature contracts และจุดประกอบ API แบบรักษาความเข้ากันได้

**What to build:** แอปเดิมยังทำงานเหมือนเดิม แต่ประกอบด้วย API จริงหรือของจำลองได้จากจุดเดียว และแต่ละ feature ใช้ contract กับ types ของตนเองได้โดยไม่ต้องรู้จัก Tauri หรือ demo runtime.

**Blocked by:** None (can start immediately).

**Status:** in-review

**Kind:** Prefactor / expand

- [x] เริ่ม implementation branch จาก `main` ณ เวลาลงมือ และนำเฉพาะเอกสาร spec/architecture/tickets เข้าสาขานั้น; ใช้ prototype commit `6bc41ad` เป็น design reference โดยไม่ merge branch ต้นแบบหรือคัดลอก fixture components/app gate เข้าฝั่ง production.
- [x] เก็บและตรวจ action/parity inventory ของ UI เดิมก่อน refactor โดยใช้ baseline ที่ตรวจจาก source เป็นจุดเริ่ม ให้แต่ละ action มี entry เดิม, ตำแหน่งใหม่, ticket owner และช่องบันทึกหลักฐาน; อย่ารอเริ่ม audit ใน 18.
- [x] แยก Environment, Tools และ platform contracts ออกจาก Tauri transport และ launch/demo composition; feature contract เป็น type-only และไม่อาศัยการสร้าง production singleton.
- [x] ย้ายแหล่งประกาศ types ไปยังเจ้าของจริงหรือ shared transport ที่ใช้ร่วมกัน พร้อม compatibility exports ให้ callers เดิมยัง build และทำงานได้; ไม่เปลี่ยน serialized shapes, Environment value kinds หรือข้อมูลที่บันทึกอยู่.
- [x] มีจุด inject services ระดับแอปเพียงจุดเดียว โดย Tools controller และ feature consumers รับ capability ที่แคบตามหน้าที่ ไม่ใช่หลาย wrapper ที่ยังเปิด API ทั้งก้อน.
- [x] คง compatibility facade สำหรับ callers ที่ยังไม่ได้ย้าย; ยังไม่ลบของเก่าในขั้น expand และยังไม่เปลี่ยนหน้าจอ.
- [x] ทดสอบผ่าน production composition ว่า fake API คุม Tools และการเริ่มแอปได้จริง โดยไม่แตะ Tauri/Windows; build และ regression checks ที่ได้รับผลกระทบผ่าน.

## Comments

- **Types:** `src/features/environment/types.ts`, `src/features/tools/types.ts`, `src/platform/types.ts`; `src/types.ts` remains a compatibility barrel.
- **Contracts (type-only):** `src/contracts/environment.ts`, `tools.ts`, `platform.ts`; `AppServices`, `ToolsRuntime`, and legacy `EnvarlyApi` in `src/contracts/index.ts`.
- **Transport:** Tauri invoke/listen implementation moved to `src/transport/tauriEnvarlyApi.ts`; demo overlay unchanged in `src/demo/createDemoApi.ts`.
- **Injection point:** `createProductionServices()` in `src/composition/createProductionServices.ts` (real Tauri or demo); `AppServicesProvider` in `main.tsx` wires `wireLegacyApiFacade` for unmigrated hooks/components still importing `api`.
- **Tools:** `useToolsStore` and `effects` take `ToolsRuntime` (`tools` + narrow `platform` slice); `App.tsx` injects via `useAppServices()` + `createToolsRuntime`.
- **Tests:** `src/composition/composition.test.tsx` exercises fake `AppServices` through the provider and Tools refresh without Tauri; existing Tools effect/store tests updated to `fakeToolsRuntime`.
- **Not done (deferred):** Environment hooks and panels still use the legacy `api` singleton; migrating them to `EnvironmentApi` is ticket 03+. No UI or serialized shape changes.
