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

### Review round 1 (Grok 4.7)

- **Race binding:** Superseding read `requestId` per scope (`inv:`, `profiles`, `shell:`, `environment`, `result:`) plus account/tools/environment revisions; `registerReviewedPlan` stores plan id + baseline (`environmentRevision` at review). Tool results carry `tool` on `applyFinished`/`undone`/`recoveryResolved`; shell checks and profile loads use bound reads.
- **Readback:** Write `failure`/`success` (not `cancel`) publishes invalidation/readback scopes; tools `readbackToolsState` reloads inventory + profiles; legacy invalidation dispatches `loadProfiles` and bound `checkShell`; external diff detection invalidates cross-feature scopes; shell `rescan` calls `notifyAccountContextChanged` when account sid changes.
- **Pending:** `useStaged` publishes pending synchronously via `onPendingChange`; diff apply admission denial sets `applyError`.
- **Tests:** `writeCoordination.review.test.tsx` (legacy screen stage → apply/cleanup refused), `effects.test.ts` (delayed reload, shell check supersede, late apply after tool switch), `writeCoordination.behavior.test.tsx` (subscription failure), shell rescan account binding; `createToolsRuntime` requires explicit coordinator (no silent default).

### Review round 2 (Grok 4.7)

- **External diff loop:** `useDiff` fires cross-feature invalidation once per diff episode; invalidation subscribers refresh env/path only (no re-entry into `checkForExternalChanges`). External callback omits `environment-external-diff` scope.
- **Stuck `plan.applying`:** Dropped late apply/undo/recovery/uninstall dispatches `toolMutationDropped` (clears applying even after tool switch); effects use live `getState().tool` plus binding checks before commit.
- **Plan eligibility:** `isPlanApplyCurrent` compares live `environmentRevision` to reviewed baseline (not only account/plan id).
- **Tool-tagged events:** `planBuilt` and `uninstallFinished` include `tool`; `createProfile`/`deleteProfile` gated like other profile writes.
- **Tests:** `writeCoordination.review-round2.test.tsx` (single external invalidate, diff apply busy error, profile apply refused, shell rescan → coordinator token); `effects.test.ts` (delayed profiles, late undo/recovery not stuck); `createWriteCoordinator.test.ts` (environment revision retires plan).
