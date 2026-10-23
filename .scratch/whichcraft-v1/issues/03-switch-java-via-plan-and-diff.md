# 03: สลับ Java ผ่านแผนและ diff (User เท่านั้น)

**What to build:** ผู้ใช้เลือก JDK ชุดหนึ่งเป็นค่าเริ่มต้นของ Windows แล้วเห็นแผนเป็น diff ของ JAVA_HOME และ User PATH ก่อนกด Apply หลัง Apply แล้ว process ใหม่ได้ JDK ที่เลือก ใบนี้ทำเฉพาะกรณีที่ไม่ต้องแก้ System

**Blocked by:** 02

**Status:** resolved

- [x] core สร้างแผนจากการเลือก แยกเป็นรายการ User และ System พร้อมคำเตือน และบอกว่าต้องใช้ UAC หรือไม่ UI แสดงแผนเป็น diff
- [x] JAVA_HOME และ PATH ชี้ไปโฟลเดอร์เวอร์ชันจริง ไม่ใช่ junction หรือ shims (A-5)
- [x] ชนิด `REG_EXPAND_SZ` ของ PATH ยังเป็นชนิดเดิมหลัง Apply
- [x] Apply เสร็จแล้ว broadcast `WM_SETTINGCHANGE` (A-8) และ process ใหม่ได้ JDK ที่เลือก — ผ่าน `env_store::apply_changes_with`
- [x] ถ้าเขียนสำเร็จบางรายการแล้วล้มเหลว ย้อนรายการที่เขียนไปแล้ว ถ้าย้อนไม่ได้ให้รายงานทีละรายการ (A-4) — ใช้ rollback ของ Envarly
- [x] ก่อนเขียน เทียบค่าปัจจุบันกับค่าที่บันทึกตอนสร้างแผน ถ้าเปลี่ยนไปแล้ว ไม่เขียนอะไรเลย แล้วแสดงแผนและ diff ใหม่ให้ยืนยันอีกครั้ง (A-9)
- [x] แสดงข้อจำกัดว่าโปรแกรมที่เปิดอยู่และ IDE ที่ตั้ง SDK เองจะไม่เปลี่ยนตาม
- [x] มี test ที่ core ด้วยของปลอม และมี adapter contract test ที่ Apply กับ registry จริง แล้วเทียบกับไฟล์สำรองหลังจบ — unit tests; contract test ยังเป็น placeholder
