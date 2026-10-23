# งานพิสูจน์ข้อ 4: Envarly — ผล

ทดสอบเมื่อ 23 ตุลาคม 2026

**ผล: ผ่าน** build ได้ และ Apply กับ rollback ทำงานถูกต้องบน registry จริง ทั้ง User และ System แต่ต้องสร้างส่วนที่ขาดอีก 4 ข้อ (ดูหัวข้อ "ส่วนที่ไม่ตรงกับการตัดสินใจ")

## commit ที่ pin

`f0ad0ff67508bb55091b46bba524667984531350` บน `main` (16 ต.ค. 2026) ซึ่งอยู่หลัง tag `v1.7.0` (`09417199`, 11 ส.ค. 2026) 87 commit

เลือก commit นี้แทน v1.7.0 เพราะหลัง v1.7.0 มีการแก้โค้ดของแอปที่เกี่ยวกับงานนี้โดยตรง:
- `7bb129a` fix: roll back only completed environment mutations
- `dade2ea` fix: validate environment inputs before mutation
- `def0da8` fix(deps): update vulnerable desktop tooling dependencies
- `b3fa067` fix: detect incomplete account privilege assignment

commit ที่เหลือส่วนใหญ่เป็นงานของ landing page (`lp/`)

## Build

- **เครื่องมือที่ใช้:**
  - Node 22.23.4 ติดตั้งด้วย mise ที่เก็บแยกจากงานพิสูจน์ข้อ 3 และใส่ใน PATH เฉพาะ process ที่ build
  - Rust 1.98.1 stable-msvc จาก rustup ของเครื่อง
  - WebView2 155.0.4283.62
- **`npm ci`:** ผ่านใน 22 วินาที npm audit รายงานช่องโหว่ 17 รายการ (critical 3, high 9, moderate 5) ยังไม่ได้ตรวจว่าเป็น dependency ฝั่ง runtime หรือ dev
- **`npm run tauri build`:** ผ่านใน 98 วินาที ได้
  - `envarly.exe` (12 MB)
  - MSI (4.9 MB)
  - NSIS setup (3.0 MB)
- **`cargo test`:** ผ่าน 119 ข้าม 1 ตัว ทุก test ใช้ `MemBackend` จึงไม่มี test ไหนแตะ registry จริง

## สิ่งที่พบในโค้ด Apply และ rollback

อ้างอิง `src-tauri/src/env_store.rs` และ `env_backend.rs`

**ส่วนที่ใช้ต่อได้**
- **Apply (`apply_changes_with`):**
  - ตรวจ input ทั้งชุดก่อนเริ่มเขียน
  - เขียนทีละรายการ และอ่านค่ากลับมาตรวจทุกครั้ง
  - จดบันทึกทุกรายการที่เขียนสำเร็จ
- **ถ้ามีขั้นใดล้มเหลว (`rollback_changes`):**
  - ย้อนกลับจากรายการล่าสุด
  - ถ้าค่าปัจจุบันไม่ตรงกับที่ตัวเองเขียนไว้ จะไม่เขียนทับ แต่รายงาน "rollback conflict"
  - ถ้าผลการเขียนไม่ชัดเจน จะรายงาน "mutation outcome unknown" และไม่เดาเอง
- เขียนผ่าน `winreg` ที่ `HKCU\Environment` และ `HKLM\...\Session Manager\Environment` คงชนิด `REG_SZ`/`REG_EXPAND_SZ` ไว้ และ broadcast `WM_SETTINGCHANGE` ทุกครั้งที่จบ

**ส่วนที่ไม่ตรงกับการตัดสินใจของ Whichcraft และต้องทำเพิ่ม**
1. **บันทึกขั้นตอนอยู่ในหน่วยความจำเท่านั้น:** ถ้าแอป crash กลาง Apply จะไม่มีหลักฐานเหลือให้ย้อน ขัดกับตาราง "เมื่อล้มเหลวหรือถูกยกเลิกกลางทาง" ต้องเขียนบันทึกลงดิสก์ก่อนเริ่มเขียน registry
2. **ไม่มี Undo หลัง Apply สำเร็จ:** สิ่งที่ใกล้เคียงคือการ restore snapshot (`useSnapshotPanel.ts` → `onStageSnapshot`) ซึ่งเตรียมรายการเปลี่ยนแปลงให้ทุกตัวแปรกลับไปเหมือน snapshot จึงเขียนทับสิ่งที่โปรแกรมอื่นแก้ไว้ด้วย ขัดกับ Q4 ต้องสร้าง Undo ที่ย้อนเฉพาะรายการที่ Whichcraft เปลี่ยนเอง
3. **ตรวจ conflict ทั้งค่าของตัวแปร:** PATH เป็นตัวแปรเดียว ถ้าโปรแกรมอื่นเพิ่มรายการเข้า PATH จะนับเป็น conflict ทั้ง PATH ต้องเพิ่มการเปรียบเทียบทีละรายการใน PATH
4. **การขอสิทธิ์ admin:** `restart_as_admin` รีสตาร์ททั้งแอปผ่าน `ShellExecuteW("runas")` ไม่ได้ขอ UAC เฉพาะตอนเขียน System ตาม Q2
   - ถ้าบัญชีที่ใช้ไม่ใช่ admin แล้วกรอกรหัส admin ของบัญชีอื่นใน UAC แอปที่ elevate แล้วจะเห็น HKCU ของบัญชี admin นั้น
   - Envarly รับมือกรณีนี้ด้วย `user_hive.rs` (scope "OtherUser")
   - Whichcraft ควรแยก process ตัวช่วยที่ elevate ไว้เขียนเฉพาะ HKLM ส่วน HKCU ให้ process ปกติเขียน

## ทดสอบกับ registry จริง

**วิธีทดสอบ**
- สั่ง CLI ของ `envarly.exe` ที่ build ได้ ผ่าน [registry-test.ps1](registry-test.ps1) ใช้ตัวแปรทดสอบ `SWITCHYARD_SPIKE` และรายการ PATH ที่ชี้ไปโฟลเดอร์ `testbin`
- ก่อนเริ่ม สำรองด้วย `reg export` ไว้ที่ [backup/](backup/)
- บัญชีที่ใช้คือ `<user>` ซึ่งเป็น admin แบบ UAC (token ปกติมี Administrators เป็น deny-only)

| ข้อ | สิ่งที่ทำ | ผล |
|---|---|---|
| T1 | ตั้งค่าตัวแปร User แล้วลบ (ไม่ elevate) | ผ่าน |
| T2 | Apply ชุดเดียว: ตัวแปร User + เพิ่มรายการใน User PATH + ตัวแปร System **โดยไม่ elevate** | ขั้นที่ 3 (System) ล้มเหลวด้วย Access denied ตามคาด Envarly **ย้อนทั้ง 2 รายการของ User กลับ** PATH ตรงกับค่าเดิมทุกตัวอักษร (SHA ตรงกัน) และยังเป็นชนิด `REG_EXPAND_SZ` |
| T3 | Apply ชุดเดียวกันหลัง elevate ผ่าน UAC | ผ่านทั้ง 3 รายการ HKCU ที่เขียนเป็นของบัญชีเดียวกัน เพราะใช้บัญชีเดิม elevate |
| T4 | ลบทุกอย่างผ่าน envarly | ผ่าน |

**ตรวจหลังทดสอบ:** export `HKCU\Environment` และ `HKLM\...\Session Manager\Environment` ใหม่ แล้วเทียบกับไฟล์สำรอง ไม่มีบรรทัดที่ต่างกันเลย

**ยังไม่ได้ทดสอบกับ registry จริง**
- conflict ระหว่าง rollback (มีโปรแกรมอื่นแก้ค่าระหว่าง Apply) ตอนนี้มีแค่ unit test ของ Envarly
- กรณีกรอกรหัส admin ของบัญชีอื่นใน UAC (HKCU ผิดบัญชี) เพราะเครื่องนี้มีบัญชีเดียว

**ข้อสังเกตเพิ่ม**
- `envarly import` แสดงค่า PATH เต็มทั้งค่าก่อนและหลังบน stdout ถ้าตัวแปรมีความลับ ค่าจะหลุดลง log ได้ Whichcraft ไม่ควรเรียก CLI นี้แล้วเก็บ log ไว้ตรง ๆ
- parser JSON ไม่รับไฟล์ UTF-8 ที่มี BOM ซึ่ง `Set-Content -Encoding utf8` ของ Windows PowerShell 5.1 ใส่ให้
