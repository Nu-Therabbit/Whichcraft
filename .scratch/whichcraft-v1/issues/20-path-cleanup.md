# 20: ทำความสะอาด PATH

**What to build:** แอปเสนอให้ลบรายการใน PATH ที่ซ้ำ และรายการที่ชี้ไปโฟลเดอร์ที่ไม่มีอยู่แล้ว ผู้ใช้เห็นทุกรายการใน diff ก่อน Apply และ Undo ได้เหมือนการ Apply อื่น

**Blocked by:** 04

**Status:** resolved

- [x] บนเครื่องทดสอบ เสนอให้ลบ `%USERPROFILE%\go\bin` ที่ซ้ำ และพาธ Ollama ที่ไม่มีอยู่แล้ว โดยไม่ลบเอง (C-1) — contract_path_cleanup_on_this_machine (อ่านอย่างเดียว) เสนอลบ go\bin ที่ซ้ำ 2 รายการ (รวม %USERPROFILE%\go\bin) และ Ollama ที่ไม่มีแล้ว ผ่านแผนและ diff; ปุ่ม Clean up PATH แสดงเหตุผลรายการละบรรทัด
- [x] รายการที่ใช้ตัวแปร เช่น `%JAVA_HOME%\bin` ขยายตัวแปรก่อนตัดสิน และไม่ถูกเสนอให้ลบถ้าโฟลเดอร์มีอยู่จริง (C-2) — ขยายตัวแปรจาก registry (User ทับ System) ไม่ใช่ environment ของโปรเซสแอปซึ่งค้างหลังสลับ; ตัวแปรที่ขยายไม่ได้ไม่ถูกเสนอลบ; ใช้ตัวขยายเดียวกันใน inventory, แผน, terminal และ Android SDK (test variables_are_expanded_from_the_registry_before_judging, a_system_java_home_bin_entry_follows_the_new_java_home_and_is_not_removed)
- [x] ทำผ่านแผน, Journal และ Undo เดียวกับ Apply — แผนไม่บันทึกการเลือกเครื่องมือ (records_selection = false); test applying_a_path_cleanup_leaves_selections_alone
- [x] มี test ที่ core ด้วยของปลอม — test removes_duplicate_entries และ applying_a_path_cleanup_leaves_selections_alone
