# 10: ติดตั้ง Node ผ่าน mise ที่ pin ไว้

**What to build:** ผู้ใช้เปิดรายการเวอร์ชันของ Node ที่ติดตั้งได้ เห็นขนาดดาวน์โหลด แล้วกดติดตั้ง ครั้งแรกแอปเลือกที่เก็บการติดตั้ง แจ้งขนาด แล้วโหลด mise เวอร์ชันที่ pin ไว้มาตรวจ hash ก่อนใช้ Node ที่ติดตั้งแล้วแสดงเป็นการติดตั้งที่แอปจัดการ แต่ยังไม่แตะ PATH จนกว่าผู้ใช้จะเลือก ใบนี้เป็นเส้นทางแรกของ ToolManager

**Blocked by:** 06

**Status:** resolved

- [x] ครั้งแรกถามที่เก็บการติดตั้ง ค่าเริ่มต้นคือ `%LOCALAPPDATA%\Whichcraft\installs` (I-5) — InstallSection ถามที่เก็บก่อนติดตั้งครั้งแรก (installStoreConfirmed) ค่าเริ่มต้น %LOCALAPPDATA%\Whichcraft\installs
- [x] โหลด mise เวอร์ชันที่ pin ไว้ ตรวจ SHA256 กับค่าที่ฝังในแอป แล้วเก็บที่ `%LOCALAPPDATA%\Whichcraft\mise\<version>\` (I-10) ถ้า hash ไม่ตรงให้ลบทิ้งและหยุด (I-11) — ตรวจทั้ง zip และ mise.exe, แตกไฟล์แบบ partial แล้วค่อย rename; test 4 ข้อ
- [x] ถ้าออฟไลน์หรือโหลดไม่ได้ ให้แจ้ง โดยการค้นหา สลับ Apply และ Undo ยังใช้ได้ (I-12) และ installer ของแอปไม่มี mise อยู่ข้างใน (I-13) — ติดตั้งล้มเหลวแสดง error ส่วนการค้นหา/สลับ/Apply/Undo ไม่พึ่ง mise; tauri.conf.json ไม่มี resources หรือ externalBin ของ mise
- [x] ทุกคำสั่ง mise ใช้ dir แยกทั้ง 5 ตัว และไม่อ่านหรือแก้ config ของ mise ที่ผู้ใช้ติดตั้งเอง (I-6) ใช้แค่ `install`, `ls --json` และ `ls-remote --json` — dir แยก 5 ตัวต่อที่เก็บ; Flutter ใช้ `plugins ls/install/uninstall` เพิ่มเพื่อ pin ปลั๊กอิน
- [x] ติดตั้งแล้วไม่เขียน PATH, registry หรือ config ใด ๆ (I-7) และ Node รันได้จากโฟลเดอร์เวอร์ชันจริง (I-1) — contract_mise_installs_node_without_touching_the_environment_and_uninstalls_it: ติดตั้ง Node 22.12.0 ลงที่เก็บชั่วคราว node --version ได้ v22.12.0 จากโฟลเดอร์ของมัน HKCU/HKLM Environment ตรงกับไฟล์สำรองทุกไบต์ และไม่มีโฟลเดอร์ค่าเริ่มต้นของ mise เกิดขึ้น (2026-10-23)
- [x] แสดงขนาดก่อนติดตั้ง (I-9) ถ้าล้มเหลวหรือยกเลิกจะไม่มีไฟล์ค้างในที่เก็บ (I-8) — ขนาดจาก HEAD (Node/Go/Flutter; Java/Python แจ้งว่าไม่ทราบ) และแจ้งขนาด mise ครั้งแรก; ติดตั้งล้มเหลวสั่ง mise uninstall เก็บกวาด (test a_failed_install_is_cleaned_out_of_the_store)
- [x] เลือก Node ที่ติดตั้งแล้วเป็นค่าเริ่มต้นได้ด้วยแผนเดียวกับใบที่ 03 — การติดตั้งที่แอปจัดการถูกค้นพบจาก `_mise\data\installs` แล้วใช้ create_tool_plan เดียวกัน
- [x] มี test ที่ core ด้วยของปลอม (รวม hash ไม่ตรงและออฟไลน์) และมี adapter contract test ของ ToolManager กับ mise จริงในที่เก็บแยก — core ครบ; contract test เดียวกันโหลด mise ที่ pin ไว้ ตรวจ hash ติดตั้ง แล้วถอน (ราว 27 วินาที)
