# 20: ทำความสะอาด PATH

**What to build:** แอปเสนอให้ลบรายการใน PATH ที่ซ้ำ และรายการที่ชี้ไปโฟลเดอร์ที่ไม่มีอยู่แล้ว ผู้ใช้เห็นทุกรายการใน diff ก่อน Apply และ Undo ได้เหมือนการ Apply อื่น

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] บนเครื่องทดสอบ เสนอให้ลบ `%USERPROFILE%\go\bin` ที่ซ้ำ และพาธ Ollama ที่ไม่มีอยู่แล้ว โดยไม่ลบเอง (C-1)
- [ ] รายการที่ใช้ตัวแปร เช่น `%JAVA_HOME%\bin` ขยายตัวแปรก่อนตัดสิน และไม่ถูกเสนอให้ลบถ้าโฟลเดอร์มีอยู่จริง (C-2)
- [x] ทำผ่านแผน, Journal และ Undo เดียวกับ Apply — แผนไม่บันทึกการเลือกเครื่องมือ (records_selection = false); test applying_a_path_cleanup_leaves_selections_alone
- [x] มี test ที่ core ด้วยของปลอม — test removes_duplicate_entries และ applying_a_path_cleanup_leaves_selections_alone
