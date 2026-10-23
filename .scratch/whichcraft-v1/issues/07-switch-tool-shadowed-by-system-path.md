# 07: สลับเครื่องมือที่ถูก System PATH บัง (ขอ UAC เฉพาะตอนเขียน System)

**What to build:** ผู้ใช้เลือก Node ตัวอื่นขณะที่ `C:\Program Files\nodejs` อยู่ใน System PATH แผนเสนอให้เอารายการนั้นออกจาก System พร้อมคำเตือนว่ากระทบผู้ใช้ทุกคน เมื่อยืนยัน แอปขอ UAC เฉพาะส่วนที่ต้องเขียน System แล้ว process ใหม่ได้ Node ที่เลือก

**Blocked by:** 03, 06

**Status:** ready-for-agent

- [ ] แผนแยกรายการ User และ System และไม่มีพาธใต้ `%LOCALAPPDATA%` ถูกเขียนลง System (A-1, ADR-0004)
- [ ] การเขียน HKLM ทำผ่าน process ตัวช่วยที่ elevate เฉพาะครั้งนั้น แทน `restart_as_admin` ของ Envarly ส่วน HKCU ให้ process ปกติเขียน (A-7)
- [ ] หลังยืนยัน UAC แล้ว process ใหม่ได้ Node ที่เลือก (A-2)
- [ ] ถ้ายกเลิก UAC จะไม่เขียนอะไรเลย รวมถึงส่วน User และ registry ตรงกับก่อน Apply (A-3)
- [ ] ตรวจว่าแผนไม่เก่าอีกครั้งหลังได้ UAC ก่อนเขียน HKLM (A-9)
- [ ] Undo และ Journal ใช้กับการแก้ System ได้
- [ ] มี test ที่ core ด้วยของปลอม (กรณีบัง และ UAC ถูกยกเลิก) และมี adapter contract test บน Windows จริงตามแบบงานพิสูจน์ข้อ 1
