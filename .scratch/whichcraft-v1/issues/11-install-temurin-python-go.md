# 11: ติดตั้ง Temurin, Python และ Go

**What to build:** ผู้ใช้ติดตั้ง Temurin, Python และ Go จากในแอปได้ ด้วยขั้นตอนเดียวกับ Node และเห็นผู้จำหน่ายกับเวอร์ชันเต็มที่ถูกต้อง

**Blocked by:** 10

**Status:** resolved

- [x] Java มีให้เลือกเฉพาะ Temurin (I-3) — ls-remote กรองเฉพาะ `temurin-*`; test java_remote_versions_are_temurin_only
- [x] ติดตั้ง Temurin 21, Python 3.13 และ Go 1.26 แล้วรันจากโฟลเดอร์ของการติดตั้งได้ (I-1) — contract_mise_installs_temurin_python_go_and_uninstalls_them_cleanly: Temurin 21.0.12+101.0.LTS, Python 3.13.17, Go 1.26.10 รันจากโฟลเดอร์ของตัวเองได้ (2026-10-23)
- [x] JDK ที่ติดตั้งแสดงผู้จำหน่ายและเวอร์ชันจากไฟล์ `release` ไม่ใช่ชื่อที่ mise ตั้ง (D-2) — inventory อ่าน `release` ผ่าน probe ไม่ใช้ชื่อเวอร์ชันของ mise
- [x] junction ที่ mise สร้างไม่ถูกนับเป็นการติดตั้งแยก (D-3) — ทดสอบจริงแล้ว: mise สร้าง junction temurin-21, temurin-21.0, latest แต่ inventory แสดงชุดเดียว
- [x] Git ไม่มีปุ่มติดตั้ง (I-4) — backend ปฏิเสธการติดตั้ง Git; ยังไม่มีหน้าจอติดตั้ง
- [x] มี test ที่ core ด้วยของปลอม และมี adapter contract test กับ mise จริง — core ครบ; contract test เดียวกันติดตั้ง ตรวจรายการ แล้วถอนทั้งสามตัว
