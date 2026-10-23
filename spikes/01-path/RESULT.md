# งานพิสูจน์ข้อ 1: User PATH กับ System PATH — ผล

ทดสอบเมื่อ 23 ตุลาคม 2026

**ผล: ผ่าน** ยืนยันว่าการแก้แค่ User PATH ไม่พอเมื่อมีรายการใน System PATH บังอยู่ และกฎของ [ADR-0004](../../docs/adr/0004-user-scope-paths-only-in-user-environment.md) ที่ให้เอารายการที่บังออกจาก System ทำให้ตัวที่เลือกมีผลจริง

## วิธีทดสอบ

- **ดูผลแบบ process ใหม่:** [fresh-env.ps1](fresh-env.ps1) ใช้ `CreateEnvironmentBlock` (userenv.dll, ไม่สืบทอด environment) สร้าง environment จาก registry แบบเดียวกับที่ process ที่เปิดใหม่จะได้ แล้วรัน `where node` กับ `node --version` ด้วย environment นั้น ผลจึงไม่ขึ้นกับ environment เก่าที่ค้างอยู่ใน shell ที่ใช้ทดสอบ
- **ตัวที่เลือก:** Node 22.23.4 ที่ติดตั้งด้วย mise (การติดตั้งที่แอปจัดการ อยู่ใต้โฟลเดอร์ของผู้ใช้)
- **ตัวที่บัง:** Node 24.20.0 ที่ `C:\Program Files\nodejs\` ใน System PATH
- **วิธีเขียน registry:** ผ่าน `envarly.exe` จากงานพิสูจน์ข้อ 4 ส่วนขั้นที่แก้ System ใช้ [system-test.ps1](system-test.ps1) ผ่าน UAC
- **สำรองก่อนเริ่ม:** [backup/](backup/)

## ผล

| ขั้น | User PATH | System PATH | process ใหม่ได้ |
|---|---|---|---|
| ก่อนทดสอบ | เดิม | เดิม | `C:\Program Files\nodejs\node.exe` v24.20.0 |
| ใส่ Node 22 **ไว้หน้าสุด** ของ User PATH | Node 22 อยู่หน้าสุด | เดิม | **ยังได้ v24.20.0** (`where` แสดง Program Files ก่อน) |
| เอา `C:\Program Files\nodejs\` ออกจาก System (UAC) | Node 22 อยู่หน้าสุด | ไม่มี nodejs | **v22.23.4** |
| คืน System PATH | Node 22 อยู่หน้าสุด | เดิม (ตรงทุกตัวอักษร, `REG_EXPAND_SZ`) | v24.20.0 |
| คืน User PATH | เดิม | เดิม | v24.20.0 |

**ตรวจหลังทดสอบ:** export `HKCU\Environment` และ `HKLM\...\Session Manager\Environment` ใหม่ แล้วเทียบกับไฟล์สำรอง ไม่มีบรรทัดที่ต่างกัน

## สิ่งที่ได้สำหรับการออกแบบ

- การติดตั้งที่มีผลจริงคำนวณด้วย `CreateEnvironmentBlock` ได้ตรงกับที่ process ใหม่ได้รับ ใช้ได้ทั้งในการแสดงผลของแอป และตอนเปิด Terminal (งานพิสูจน์ข้อ 2)
- แค่ตรวจว่ามีพาธของตัวที่เลือกอยู่ใน PATH ไม่พอ ต้องเรียงลำดับ System ก่อน User แล้วหาตัวแรกที่ชนะ (`where` แสดงทั้งสองตัว)
- เมื่อเอารายการออกจาก System, Node 24 ใน Program Files จะไม่อยู่ใน PATH ของผู้ใช้ทุกคนในเครื่อง ตรงกับคำเตือนที่ ADR-0004 กำหนดไว้
