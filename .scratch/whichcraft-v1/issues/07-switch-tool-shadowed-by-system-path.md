# 07: สลับเครื่องมือที่ถูก System PATH บัง (ขอ UAC เฉพาะตอนเขียน System)

**What to build:** ผู้ใช้เลือก Node ตัวอื่นขณะที่ `C:\Program Files\nodejs` อยู่ใน System PATH แผนเสนอให้เอารายการนั้นออกจาก System พร้อมคำเตือนว่ากระทบผู้ใช้ทุกคน เมื่อยืนยัน แอปขอ UAC เฉพาะส่วนที่ต้องเขียน System แล้ว process ใหม่ได้ Node ที่เลือก

**Blocked by:** 03, 06

**Status:** ready-for-agent

- [x] แผนแยกรายการ User และ System และไม่มีพาธใต้ `%LOCALAPPDATA%` ถูกเขียนลง System (A-1, ADR-0004) — แผนเขียน System แค่การเอารายการที่บังออก; test ใน tool_apply และ profiles
- [x] การเขียน HKLM ทำผ่าน process ตัวช่วยที่ elevate เฉพาะครั้งนั้น แทน `restart_as_admin` ของ Envarly ส่วน HKCU ให้ process ปกติเขียน (A-7) — Elevator port + helper รับเฉพาะ System scope (0f6b22b)
- [x] หลังยืนยัน UAC แล้ว process ใหม่ได้ Node ที่เลือก (A-2) — contract_system_apply_through_uac_and_undo_restores_the_key: เขียน HKLM ผ่าน helper ที่ยกสิทธิ์แล้ว CreateEnvironmentBlock ของ process ใหม่เห็นค่าใหม่ ทดสอบด้วยตัวแปร WHICHCRAFT_TEST_SYSTEM ไม่ใช่ Node PATH จริง; เครื่องนี้ตั้ง ConsentPromptBehaviorAdmin=0 จึงไม่มีหน้าต่าง UAC ให้กด
- [x] ถ้ายกเลิก UAC จะไม่เขียนอะไรเลย รวมถึงส่วน User และ registry ตรงกับก่อน Apply (A-3) — test: cancelled_uac_writes_nothing_at_all
- [x] ตรวจว่าแผนไม่เก่าอีกครั้งหลังได้ UAC ก่อนเขียน HKLM (A-9) — helper ตรวจซ้ำก่อนเขียน; test: plan_gone_stale_while_waiting_for_uac_writes_nothing
- [x] Undo และ Journal ใช้กับการแก้ System ได้ — journal บันทึก System; Undo ส่ง System ผ่าน helper
- [x] มี test ที่ core ด้วยของปลอม (กรณีบัง และ UAC ถูกยกเลิก) และมี adapter contract test บน Windows จริงตามแบบงานพิสูจน์ข้อ 1 — core: กรณีบังและ UAC ถูกยกเลิก; contract: เขียนและ Undo System ผ่าน helper จริง HKLM ตรงกับไฟล์สำรองทุกไบต์ กรณีกด No ใน UAC ทดสอบบนเครื่องนี้ไม่ได้เพราะไม่มีหน้าต่างถาม
