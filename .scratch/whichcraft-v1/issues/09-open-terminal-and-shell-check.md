# 09: เปิด Terminal ด้วย environment ใหม่ และปุ่มตรวจใน shell

**What to build:** หลัง Apply ผู้ใช้กดเปิด Terminal จากแอปแล้วได้เวอร์ชันใหม่ทันที โดยไม่ต้องรีสตาร์ทแอปหรือ Windows Terminal ผู้ใช้ตั้งได้ว่าจะใช้ Windows Terminal, PowerShell หรือ cmd และกด "ตรวจใน shell" เพื่อดูว่า shell ที่โหลด profile แล้วเรียกตัวไหน

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] TerminalLauncher ส่ง environment จาก EnvironmentResolver ให้ `wt.exe` หรือ shell เสมอ ไม่ปล่อยให้สืบทอดจากแอป (T-1)
- [ ] ได้ค่าใหม่แม้มี Windows Terminal เปิดค้างอยู่ก่อน (T-2)
- [ ] `;` ในคำสั่งหรือพาธถูก escape สำหรับ `wt.exe` (T-3)
- [ ] การตั้งค่า Terminal เลือกได้ 3 แบบ และค่าเริ่มต้นเป็น Windows Terminal (T-4)
- [ ] "ตรวจใน shell" แสดงความต่างเมื่อ profile แก้ PATH (E-3) และแสดงว่าตรงกันเมื่อไม่มี profile (E-4)
- [ ] มี test ที่ core ด้วยของปลอม และมี adapter contract test บน Windows จริงตามแบบงานพิสูจน์ข้อ 2
