# 02: แสดงการติดตั้ง Java และการติดตั้งที่มีผลจริง

**What to build:** เมื่อเปิดแอป ผู้ใช้เห็นการติดตั้ง Java ทุกชุดในเครื่อง พร้อมผู้จำหน่ายและเวอร์ชันเต็ม และเห็นว่าชุดไหนเป็นการติดตั้งที่มีผลจริงสำหรับ process ใหม่ ถ้าการติดตั้งที่มีผลจริงไม่ตรงกับการเลือก แอปทำเครื่องหมายไว้และบอกสาเหตุ

**Blocked by:** 01

**Status:** resolved

- [x] ค้นหา JDK จาก PATH, JAVA_HOME, Registry และโฟลเดอร์มาตรฐาน แล้วยืนยันรากการติดตั้งด้วย `release` + `bin\java.exe` และข้าม junction กับ symlink (D-3) — PATH/JAVA_HOME (User และ System)/ตำแหน่งมาตรฐานรวม LocalAppData\Programs\Eclipse Adoptium + probe; ใช้ร่วมกับ tool_inventory
- [x] บนเครื่องทดสอบ พบ Temurin ครบ 4 ชุด ผู้จำหน่ายและเวอร์ชันอ่านจาก `IMPLEMENTOR` และ `JAVA_VERSION` (D-1, D-2) — contract_discovers_the_survey_machine_tools บนเครื่องจริง (อ่านอย่างเดียว) พบครบ 4 ชุด
- [x] EnvironmentResolver คำนวณ environment แบบที่ process ใหม่จะได้ (CreateEnvironmentBlock ไม่สืบทอด) แล้วหาตัวที่ชนะโดยเรียง System ก่อน User (E-1) — ใช้ `path_manage::check_command_with`; adapter CreateEnvironmentBlock ยังไม่แยก
- [x] เมื่อการเลือกไม่ตรงกับการติดตั้งที่มีผลจริง แสดงทั้งสองค่าและเครื่องหมาย "ไม่ตรงกับที่เลือก" (E-2) — API + UI (badge Effective/Selected และ mismatchReason)
- [x] สถานะคำนวณใหม่เมื่อ environment ถูกแก้จากนอกแอป — คำนวณใหม่ทุก refresh และเมื่อหน้าต่างได้ focus กลับมา
- [x] มี test ที่ API ของ core ด้วยของปลอม และมี adapter contract test ของ EnvironmentResolver บน Windows จริง — unit tests + contract test อ่าน registry จริงคำนวณ effective; ยังไม่ได้แยก adapter CreateEnvironmentBlock
