# 03: ย้าย Environment workflows เข้า feature controller บนหน้าจอเดิม

**What to build:** ผู้ใช้แก้ตัวแปร ใช้ Snapshots, Import / Export และ Check command ผ่านหน้าจอเดิมได้ครบ แต่ root ไม่ต้องประสาน Environment transactions และทุก flow ใช้ services ที่ inject ไว้.

**Blocked by:** 02: ขยาย feature contracts และจุดประกอบ API แบบรักษาความเข้ากันได้.

**Status:** ready-for-agent

**Kind:** Prefactor / migrate consumers

- [ ] Environment controller เป็นเจ้าของ variables, account context, staging, baseline/external diff, apply progress และ workflows; root เหลือ composition และ presentation.
- [ ] ย้าย consumers ใน Variables, Snapshots, Import / Export และ Check command ให้ผ่าน injected Environment contract ครบ รวม file interactions และ progress subscription; ไม่มี hidden singleton ที่เลี่ยง test seam.
- [ ] นำ dialog/tab/selection setters ออกจากขอบเขต apply/import/restore orchestration; presentation ตอบสนองต่อ state/actions/outcomes โดยยัง reuse hooks และ pure helpers ที่ทดสอบแล้วได้.
- [ ] pending edits, operation status และ subscriptions อยู่ตลอดอายุแอป ไม่สูญเมื่อปิดแผง; รักษา local edit undo, tool Undo, value types และ account-switch restrictions แยกความหมายชัดเจน.
- [ ] กรณี subscribe progress ล้มเหลวต้องออกจาก busy และจัดการข้อผิดพลาดได้; subscription ถูกเก็บ/ยกเลิกถูกต้องทุกเส้นทาง.
- [ ] ใช้ app-level behaviour tests กับ fake API ตรวจ flow ตัวแปรและแต่ละ subpanel โดยคงพฤติกรรมเดิม; การย้ายนี้ยังไม่เปลี่ยน navigation หรือ wire/storage contracts.
