# 11: ติดตั้ง Temurin, Python และ Go

**What to build:** ผู้ใช้ติดตั้ง Temurin, Python และ Go จากในแอปได้ ด้วยขั้นตอนเดียวกับ Node และเห็นผู้จำหน่ายกับเวอร์ชันเต็มที่ถูกต้อง

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] Java มีให้เลือกเฉพาะ Temurin (I-3)
- [ ] ติดตั้ง Temurin 21, Python 3.13 และ Go 1.26 แล้วรันจากโฟลเดอร์ของการติดตั้งได้ (I-1)
- [ ] JDK ที่ติดตั้งแสดงผู้จำหน่ายและเวอร์ชันจากไฟล์ `release` ไม่ใช่ชื่อที่ mise ตั้ง (D-2)
- [ ] junction ที่ mise สร้างไม่ถูกนับเป็นการติดตั้งแยก (D-3)
- [ ] Git ไม่มีปุ่มติดตั้ง (I-4)
- [ ] มี test ที่ core ด้วยของปลอม และมี adapter contract test กับ mise จริง
