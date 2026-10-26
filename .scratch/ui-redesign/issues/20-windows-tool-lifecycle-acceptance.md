# 20: ตรวจ Windows จริง: inventory และวงจรการติดตั้งเครื่องมือ

**What to build:** มีผลทดสอบ packaged app ตั้งแต่ค้นหาเครื่องมือจนติดตั้ง สลับ อัปเดต โปรไฟล์ และถอน พร้อมเทียบกับไฟล์/เวอร์ชัน/ค่าเริ่มต้นจริง.

**Blocked by:** 18: เปิด UI ใหม่เป็นค่าเริ่มต้นใน candidate build พร้อม legacy fallback.

**Status:** ready-for-human

**Kind:** Acceptance / Windows end-to-end

- [ ] ใช้ candidate build จาก 18 โดยยังเก็บ legacy fallback; ผูกผลกับเกณฑ์รับงานจริง `D-1`–`D-7`, `E-1`–`E-2`, `E-5`, `I-1`–`I-17`, `S-1`–`S-2`, `R-1`–`R-13`, `P-1`, `F-1`–`F-6` ตามตาราง section/ID mapping และเชื่อมหลักฐาน switch/Undo กับชุด 19 โดยไม่ใช้ Q decision IDs แทน case IDs.
- [ ] ตรวจ representative discovery ของ managed/external/duplicate-version/unavailable installations, Scan Roots, junction exclusions, Python supplemental และ Inventory Only SDKs.
- [ ] เก็บ acceptance evidence ผ่าน UI ใหม่; ใช้ผล fallback startup smoke จาก 18/19 หรือเติมเฉพาะที่ยังขาด โดยปิด instance เดิมแล้วเปิดใหม่ก่อนเลือกอีกโหมด ไม่เปิดสองโหมดพร้อมกันและไม่ใช้ผล legacy UI แทน production acceptance ของ UI ใหม่.
- [ ] ตรวจ supported install backends, first-use/store/mise preparation, pinned config/plugin/checksum behaviour และ failed/cancelled/offline cases ที่เกี่ยวข้องกับ UI ใหม่.
- [ ] ตรวจ switch actual Effective Installation, same-line update, profile-match/partial profile/install-missing/repoint และสถานะหลัง restart/เปลี่ยนที่เก็บ; ใช้ backend-known versions จริง ไม่ใช่ fixture expectations.
- [ ] ตรวจ managed uninstall และ representative external/folder-only methods, replacement preview, in-use/refused/incomplete/cancelled removal โดยใช้ disposable fixtures แทน working installations.
- [ ] เทียบ roots/executable versions, Registry/new-process results, store contents และ profile references; บันทึก pass/fail/blocked พร้อมสาเหตุเมื่อเครือข่าย บัญชี หรือ shell variant ใช้ไม่ได้.
- [ ] รวบรวม evidence จาก slices ที่ตรวจ Windows ไปแล้วและเติม cross-flow/regression ที่เหลือ; ประเมินร่วมกับชุด Environment ก่อนสรุป production acceptance.
- [ ] required fail/blocked ยังไม่ถือว่า gate ของ 21 ผ่าน; เก็บ fallback สำหรับเปรียบเทียบ/ใช้งานระหว่างแก้ regression และห้ามถอดก่อนทั้งสองชุดผ่าน.

## Comments

### Initial agent result (2026-10-24; superseded by installed-candidate report below)

Blocked, not passed. No packaged app and no disposable Windows install, switch, update, profile, or uninstall session.

At that checkpoint every required case was recorded as **blocked**: `D-1`–`D-7`, `E-1`, `E-2`, `E-5`, `I-1`–`I-17`, `S-1`, `S-2`, `R-1`–`R-13`, `P-1`, `F-1`–`F-6`. Fake-API results are not acceptance. Ticket 21 must not remove the legacy fallback while these stay blocked.

- 2026-10-24: Partial agent evidence (not a suite run) is recorded in [ticket 18](18-production-cutover-and-contract.md) under the "Agent Windows run" sections and covers D-* discovery on this machine, I-1/I-7/R-1 and the Temurin/Python/Go, two-store, old-mise and Flutter plugin contracts, the full Flutter install (uninstall blocked by a Windows service), a Java switch with Undo, and the shell check. Required cases that need UAC, other accounts or a clean machine are still open.


### Current installed-candidate result (24–25 October 2026)

**Partial; not a suite pass.** [Detailed evidence, package hashes, restoration and every original case ID](../acceptance/2026-10-24/RESULT.md) replace the initial blanket-blocked assessment above. New UI results are kept separate from legacy smoke, prior non-packaged runs and backend contracts.

Installed candidate verified Inventory Only SDK/Python details, managed Java/Go install without environment changes, real Go same-line update/switch/old-install retirement/Undo and managed removal, plus a saved Java-only profile and match status. Corrected the actual Go plan before applying it: unrelated System PATH entries now remain. Full real Flutter contract passed after a bounded safe retry of Windows Appraisal usage refusal. All owned test installations/packages were removed; working tools remain intact.

Continuation on 25 October: D-5 passed with a disposable JDK that became unavailable after its folder moved. F-2 passed with nothing written. F-3 showed the install-missing offer for Node.js 22.23.4 at 0 MB and did not download. F-5 showed the affected profile and the repoint checkbox already checked, then the dialog was dismissed without uninstalling. F-4 was not run. Still required: full representative ownership/refusal/external-uninstaller cases, a completed replacement flow, duplicate-pin preference, offline/checksum/cancellation presentation and store/upgrade combinations listed in the report. Exact Temurin update and expanded profile scenarios are partial rather than inferred from equivalent Go/single-profile results. Keep status `ready-for-human` and fallback intact.


### Autonomous continuation (25 October 2026)

Corrected the 0 MB download estimate: real missing Node.js 22.23.4 now displays 34 MB in the row and action. No download/install-missing flow was started in this continuation, so F-3 remains partial. Remaining lifecycle scenarios and status are unchanged. See [evidence and precise remaining gates](../acceptance/2026-10-25/RESULT.md).


### Continuation (26 October 2026)

F-4 passed in the verified production release GUI with real identical-version managed/external Temurin copies, actual preferred-root Apply, disappearance/restart/fallback Apply, and exact native Undo. R-10 named the owned running Java process with the Gradle hint and refused removal; R-11 refused while an owned process held the test folder. F-6 exposed a stale-focus regression, now fixed and verified in final installed NSIS across two successive external edits and restoration. The isolated JDK and package were removed; working tools and original app data remain intact. These cases no longer remain missing; other lifecycle cases are unchanged. Status stays ready-for-human; see [current report](../acceptance/2026-10-26/RESULT.md).
