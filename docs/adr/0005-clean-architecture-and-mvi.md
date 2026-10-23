# ฝั่ง Rust แยกชั้นแบบ Clean Architecture และฝั่ง React ใช้ MVI

ผลประเมินใน `docs/architecture-assessment.md` พบว่า:
- services ฝั่ง Rust หลายตัวทำ I/O เอง และการประสานงานบางส่วนอยู่ใน Tauri commands
- ฝั่ง React เก็บ state ของหน้าเครื่องมือไว้ใน hook เดียวที่มี `useState` 35 ตัว บั๊กในรีวิวล่าสุดมาจากโครงนี้

จึงกำหนดให้โค้ดของ Whichcraft แบ่งดังนี้:

- **Rust**
  - `whichcraft/domain`: type และกฎล้วน ไม่มี I/O
  - `whichcraft/application`: use case ที่เรียกโลกภายนอกผ่าน port เท่านั้น
  - `whichcraft/ports`: trait ที่ application ใช้
  - `whichcraft/adapters`: ตัวจริงของ port (winreg, process, mise, ไฟล์, HTTP)
  - `commands`: แปลง input แล้วเรียก use case จาก composition root ที่สร้าง adapter ครั้งเดียว
  - dependency ชี้เข้าด้านในเท่านั้น
- **React**
  - หน้าเครื่องมือมี state เดียวแบบ immutable
  - สิ่งที่ผู้ใช้หรือระบบทำเป็น intent
  - reducer เป็นฟังก์ชันล้วน
  - การเรียก api อยู่ใน effects ที่ dispatch ผลกลับมาเป็น event
  - component รับแค่ state กับ dispatch
  - ใช้ `useReducer` ไม่เพิ่มไลบรารี

ส่วนที่ fork มาจาก Envarly (`env_store`, `model`, `commands/path`, `path_manage`) ไม่ถูกย้ายเข้า domain แต่ถือเป็น adapter และ type ภายนอก Whichcraft ใช้ผ่าน port (`EnvBackend`) ส่วน type อย่าง `EnvSnapshot` ยังใช้ตรงได้ เพื่อไม่ต้องแก้ส่วนที่ fork มา

## Considered Options

- **คงโครงเดิม:** ใช้งานได้และ contract test ผ่าน แต่ flow หลายขั้นในหน้าเครื่องมือ test ไม่ได้ และเพิ่มฟีเจอร์แล้วบั๊กง่าย
- **Zustand หรือ Redux Toolkit:** ได้ devtools แต่เพิ่ม dependency ขณะที่ `useReducer` กับ effect runner เล็ก ๆ ก็ test reducer ได้ตรงเหมือนกัน
- **ย้าย type ของ Envarly เข้า domain:** แยกขาดกว่า แต่ต้องแก้โค้ดที่ fork มาจำนวนมาก โดยไม่ได้อะไรเพิ่มในรุ่นแรก
