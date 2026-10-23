# 04: ประสานการเขียนและรีเฟรช Tools กับ Environment

**What to build:** การสลับเครื่องมือกับการแก้ Environment ไม่เขียนชนกัน และทุกหน้าปรับข้อมูลตาม Windows หลังเปลี่ยนแปลง โดย pending edits และ progress ไม่หายเมื่อนำทาง.

**Blocked by:** 03: ย้าย Environment workflows เข้า feature controller บนหน้าจอเดิม.

**Status:** ready-for-agent

**Kind:** Prefactor / shared orchestration

- [ ] มี coordinator ระดับแอปสำหรับ admission ของ conflicting UI writes และ scoped invalidation; feature controllers ไม่ import state ภายในของกันและกัน.
- [ ] pending Environment edits ต้องถูก apply/discard อย่างชัดเจนก่อน tool/profile/cleanup write ที่ขัดกัน; การติดตั้งโดยไม่สลับยังใช้ contract เดิมได้.
- [ ] refresh หลัง success, external change, stale/failure และ recovery readback ครอบคลุม variables, Effective Installation/Selection, profile match, diagnostics และผลใน shell ที่หมดอายุ.
- [ ] request/account/scope/revision ถูกผูกกับผลลัพธ์และ reviewed plan; late responses และการเปลี่ยนบัญชีไม่เขียนทับหน้าปัจจุบันหรือเปลี่ยน target-account semantics ของ Tools.
- [ ] ทุก error/cancel/completion path ปลด write admission และเก็บสถานะสำหรับอ่านกลับ/กู้คืนได้ โดยไม่แทน backend stale checks, journal, UAC หรือ rollback ด้วย UI lock.
- [ ] ทดสอบสอง workspace ผ่านหน้าจอและ state/effects จริงบน fake API รวม delayed replies, pending edits และ subscription failure; หน้าจอเดิมยังใช้ได้.
