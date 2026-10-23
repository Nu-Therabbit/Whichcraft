# 18: โปรไฟล์ — สร้าง Apply และสถานะว่าตรงหรือไม่

**What to build:** ผู้ใช้สร้างโปรไฟล์เครื่องมือที่ตั้งชื่อได้และระบุแค่บางเครื่องมือ แล้ว Apply ได้ในครั้งเดียว เครื่องมือที่ไม่ได้ระบุคงค่าเดิม ถ้ามีตัวใดใช้งานไม่ได้ แอปจะไม่ Apply เลย หน้ารายการโปรไฟล์บอกว่าแต่ละโปรไฟล์ตรงกับการติดตั้งที่มีผลจริงหรือไม่

**Blocked by:** 07

**Status:** ready-for-agent

- [x] Apply โปรไฟล์ A (Java 17 + Node 20) แล้ว Apply B (Java 21 อย่างเดียว) ผลคือ Java 21 และ Node 20 (F-1) — test a_later_profile_changes_only_the_tools_it_names (JAVA_HOME เป็น 21, jdk17\bin ถูกเอาออกจาก User PATH ในแผนเดียวกัน, Node 20 อยู่ครบ)
- [x] ถ้ามีการติดตั้งตัวใดใช้งานไม่ได้ ไม่เขียนอะไรเลยและแสดงรายการที่ต้องแก้ (F-2) — test: a_missing_version_is_unavailable_instead_of_another_one
- [x] โปรไฟล์อ้างถึงด้วยผู้จำหน่าย + เวอร์ชันเต็ม และใช้รากการติดตั้งที่จำไว้ก่อนเมื่อมีหลายชุด (F-4) — test: the_remembered_root_wins_among_identical_versions_and_others_stand_in
- [x] ไม่มีสถานะ "โปรไฟล์ที่ใช้อยู่" แต่ละโปรไฟล์แสดงว่าตรงหรือไม่ และอัปเดตเมื่อ environment ถูกแก้จากนอกแอป (F-6) — profile_status คำนวณใหม่ทุกครั้ง; แท็บ Profiles โหลดใหม่ทุกครั้งที่รายการการติดตั้งรีเฟรช (รวมตอนหน้าต่างได้ focus)
- [x] Apply โปรไฟล์ใช้แผน, UAC, Journal และ Undo เดียวกับการเลือกทีละเครื่องมือ — รวมเป็นแผนเดียว, journal เดียว, UAC ครั้งเดียว (0f6b22b)
- [x] มี test ที่ core ด้วยของปลอม — test 4 ข้อใน services/profiles
