# 11: ติดตั้ง Temurin, Python และ Go

**What to build:** ผู้ใช้ติดตั้ง Temurin, Python และ Go จากในแอปได้ ด้วยขั้นตอนเดียวกับ Node และเห็นผู้จำหน่ายกับเวอร์ชันเต็มที่ถูกต้อง

**Blocked by:** 10

**Status:** ready-for-agent

- [x] Java มีให้เลือกเฉพาะ Temurin (I-3) — ls-remote กรองเฉพาะ `temurin-*`; test java_remote_versions_are_temurin_only
- [ ] ติดตั้ง Temurin 21, Python 3.13 และ Go 1.26 แล้วรันจากโฟลเดอร์ของการติดตั้งได้ (I-1)
- [x] JDK ที่ติดตั้งแสดงผู้จำหน่ายและเวอร์ชันจากไฟล์ `release` ไม่ใช่ชื่อที่ mise ตั้ง (D-2) — inventory อ่าน `release` ผ่าน probe ไม่ใช้ชื่อเวอร์ชันของ mise
- [x] junction ที่ mise สร้างไม่ถูกนับเป็นการติดตั้งแยก (D-3) — probe ปฏิเสธ reparse point; ยังไม่มี test กับ junction จริง
- [x] Git ไม่มีปุ่มติดตั้ง (I-4) — backend ปฏิเสธการติดตั้ง Git; ยังไม่มีหน้าจอติดตั้ง
- [ ] มี test ที่ core ด้วยของปลอม และมี adapter contract test กับ mise จริง
