# 09: เปิด Terminal ด้วย environment ใหม่ และปุ่มตรวจใน shell

**What to build:** หลัง Apply ผู้ใช้กดเปิด Terminal จากแอปแล้วได้เวอร์ชันใหม่ทันที โดยไม่ต้องรีสตาร์ทแอปหรือ Windows Terminal ผู้ใช้ตั้งได้ว่าจะใช้ Windows Terminal, PowerShell หรือ cmd และกด "ตรวจใน shell" เพื่อดูว่า shell ที่โหลด profile แล้วเรียกตัวไหน

**Blocked by:** 02

**Status:** resolved

- [x] TerminalLauncher ส่ง environment จาก EnvironmentResolver ให้ `wt.exe` หรือ shell เสมอ ไม่ปล่อยให้สืบทอดจากแอป (T-1) — CreateEnvironmentBlock ไม่สืบทอด + env_clear ก่อนใส่ environment ใหม่; test the_terminal_gets_exactly_the_fresh_environment
- [x] ได้ค่าใหม่แม้มี Windows Terminal เปิดค้างอยู่ก่อน (T-2) — ทดสอบโดยเปิด Windows Terminal ค้างไว้ก่อน Apply แล้ว wt.exe -w new กับ environment ใหม่ได้ค่าใหม่ (อยู่ใน contract test ของ User)
- [x] `;` ในคำสั่งหรือพาธถูก escape สำหรับ `wt.exe` (T-3) — escape_wt ใช้กับ --startingDirectory; test windows_terminal_opens_a_new_window_and_escapes_semicolons
- [x] การตั้งค่า Terminal เลือกได้ 3 แบบ และค่าเริ่มต้นเป็น Windows Terminal (T-4) — การตั้งค่า Terminal ในแผงตั้งค่า (Windows Terminal เป็นค่าเริ่มต้น)
- [x] "ตรวจใน shell" แสดงความต่างเมื่อ profile แก้ PATH (E-3) และแสดงว่าตรงกันเมื่อไม่มี profile (E-4) — ShellCheckResult; E-3 ทดสอบด้วยของปลอม (เครื่องนี้ไม่มี profile), E-4 ผ่านบนเครื่องจริงทั้ง PowerShell และ cmd
- [x] มี test ที่ core ด้วยของปลอม และมี adapter contract test บน Windows จริงตามแบบงานพิสูจน์ข้อ 2 — unit tests 4 ข้อ + contract_shell_check_on_this_machine (อ่านอย่างเดียว ไม่เปิดหน้าต่าง)
