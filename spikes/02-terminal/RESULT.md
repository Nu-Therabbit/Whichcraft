# งานพิสูจน์ข้อ 2: Terminal ใหม่ได้ environment จาก registry — ผล

ทดสอบเมื่อ 23 ตุลาคม 2026 กับ Windows Terminal 1.25.2733.0 ระหว่างทดสอบมีหน้าต่าง Windows Terminal เปิดค้างอยู่ 1 process ส่วน default profile คือ Windows PowerShell 5.1 และเครื่องนี้ไม่มี PowerShell 7

**ผล: ผ่าน โดยมีเงื่อนไข** แอปต้องคำนวณ environment จาก registry แล้วส่งให้ Terminal เองทุกครั้ง ถ้าปล่อยให้ Terminal สืบทอด environment ของแอป จะได้ค่าเก่า

## Terminal เห็นค่าหลัง Apply หรือไม่

ผมตั้งตัวแปร User `SWITCHYARD_SPIKE=terminal-test` ผ่าน envarly (ซึ่ง broadcast `WM_SETTINGCHANGE` ให้ด้วย) จากนั้นใช้ shell ที่เปิดไว้ก่อน Apply ทำหน้าที่แทน "แอปที่รันอยู่" แล้วเปิด Terminal 4 แบบด้วย [launch-test.ps1](launch-test.ps1)

| วิธีเปิด | environment ที่ส่งให้ | ค่าที่เห็น |
|---|---|---|
| `powershell.exe` | สืบทอดจากแอป | `[]` ค่าเก่า |
| `wt.exe -w new powershell.exe …` | สืบทอดจากแอป | `[]` **ค่าเก่า** แม้ Windows Terminal รันอยู่แล้ว และได้รับ broadcast แล้ว |
| `powershell.exe` | `CreateEnvironmentBlock` | `[terminal-test]` ✓ |
| `wt.exe -w new powershell.exe …` | `CreateEnvironmentBlock` | `[terminal-test]` ✓ |

ทั้งหมดนี้ไม่ต้องรีสตาร์ทแอปหรือ Windows Terminal

## profile ของ shell แก้ PATH ("ตรวจใน shell")

เครื่องนี้ไม่มี PowerShell profile และไม่มี cmd AutoRun ผมจึงจำลองด้วย [test-profile.ps1](test-profile.ps1) ซึ่งใส่ Node 22 ไว้หน้า PATH แล้ว dot-source แทนการแตะ `$PROFILE` จริง

| วิธีตรวจ | node ที่ได้ |
|---|---|
| environment จาก registry (การติดตั้งที่มีผลจริง) | `C:\Program Files\nodejs\node.exe` |
| `powershell -NoProfile` + environment จาก registry | `C:\Program Files\nodejs\node.exe` |
| `powershell` + environment จาก registry + โหลด profile | `…\node\22.23.4\node.exe` (v22.23.4) |

ปุ่ม "ตรวจใน shell" ทำได้โดยรัน shell ด้วย environment จาก registry ให้โหลด profile ตามปกติ แล้วถาม `Get-Command <tool>` ถ้าผลไม่ตรงกับการติดตั้งที่มีผลจริง ก็แสดงความต่าง

## สิ่งที่ได้สำหรับการออกแบบ

- ปุ่ม "เปิด Terminal" ของแอปต้องสร้าง environment ด้วย `CreateEnvironmentBlock` (ไม่สืบทอด) แล้วส่งให้ `wt.exe` หรือ shell เสมอ จะพึ่ง broadcast หรือการที่ Windows Terminal โหลด environment ใหม่เองไม่ได้
- ถ้า Windows Terminal รันอยู่แล้ว `wt.exe -w new` ยังใช้ environment ที่แอปส่งไปให้ แต่**แท็บที่ผู้ใช้เปิดเองในหน้าต่าง Windows Terminal เดิมจะได้ค่าอะไร ยังไม่ได้ทดสอบ** ส่วนนี้อยู่นอกการควบคุมของแอป ควรอธิบายในหน้าข้อจำกัด
- คำสั่งที่ส่งให้ `wt.exe` ห้ามมี `;` เพราะ `wt` ใช้เป็นตัวแยกคำสั่ง ต้อง escape เป็น `\;`
- ยังไม่ได้ทดสอบกับ PowerShell 7 และ cmd ที่มี AutoRun เพราะเครื่องนี้ไม่มีทั้งสองอย่าง

**ตรวจหลังทดสอบ:** ลบตัวแปรทดสอบแล้ว และ registry ตรงกับไฟล์สำรองใน [backup/](backup/) ทุกบรรทัด
