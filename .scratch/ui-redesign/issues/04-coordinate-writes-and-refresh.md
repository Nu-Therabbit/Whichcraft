# 04: ประสานการเขียนและรีเฟรช Tools กับ Environment

**What to build:** การสลับเครื่องมือกับการแก้ Environment ไม่เขียนชนกัน และทุกหน้าปรับข้อมูลตาม Windows หลังเปลี่ยนแปลง โดย pending edits และ progress ไม่หายเมื่อนำทาง.

**Blocked by:** 03: ย้าย Environment workflows เข้า feature controller บนหน้าจอเดิม.

**Status:** in-review

**Kind:** Prefactor / shared orchestration

- [x] มี coordinator ระดับแอปสำหรับ admission ของ conflicting UI writes และ scoped invalidation; feature controllers ไม่ import state ภายในของกันและกัน.
- [x] pending Environment edits ต้องถูก apply/discard อย่างชัดเจนก่อน tool/profile/cleanup write ที่ขัดกัน; การติดตั้งโดยไม่สลับยังใช้ contract เดิมได้.
- [x] refresh หลัง success, external change, stale/failure และ recovery readback ครอบคลุม variables, Effective Installation/Selection, profile match, diagnostics และผลใน shell ที่หมดอายุ.
- [x] request/account/scope/revision ถูกผูกกับผลลัพธ์และ reviewed plan; late responses และการเปลี่ยนบัญชีไม่เขียนทับหน้าปัจจุบันหรือเปลี่ยน target-account semantics ของ Tools.
- [x] ทุก error/cancel/completion path ปลด write admission และเก็บสถานะสำหรับอ่านกลับ/กู้คืนได้ โดยไม่แทน backend stale checks, journal, UAC หรือ rollback ด้วย UI lock.
- [x] ทดสอบสอง workspace ผ่านหน้าจอและ state/effects จริงบน fake API รวม delayed replies, pending edits และ subscription failure; หน้าจอเดิมยังใช้ได้.

## Comments

- **Coordinator:** `src/coordination/createWriteCoordinator.ts` with app-lifetime `WriteCoordinatorProvider` in `main.tsx`. Features talk to it only through `WriteCoordinatorFacade` on `ToolsRuntime.coordination` (tools effects) and `useWriteCoordinator()` (environment controller, shell overview, legacy tools invalidation). No cross-import of reducers or private hooks.
- **Admission:** One active UI write at a time. `setEnvironmentPending` blocks tool apply/undo/recovery/uninstall (not install-only flows). Environment staged and external-diff apply take environment admission. Success publishes scoped invalidation; failure/cancel always releases admission (including apply-progress subscription failure before `applyEnvChanges`).
- **Refresh / races:** Invalidation subscribers in `useEnvironmentController`, `LegacyAppRoot`, and `DesktopShellApp` re-read authoritative APIs. Tools `reload`/`loadProfiles`, shell `useToolsOverview`, and environment `useEnvVars` bind results to account/environment/tools revisions and plan apply binding drops late plan results after account change.
- **Tests:** `createWriteCoordinator.test.ts`, `writeCoordination.behavior.test.tsx`, `effects.test.ts` (pending env blocks apply), existing `environment.behavior.test.tsx` / `desktopShell.test.tsx` / `appStartup.test.tsx` wrapped with the provider.
