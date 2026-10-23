# 06: ค้นหาเครื่องมือที่เหลือและโฟลเดอร์ค้นหา

**What to build:** นอกจาก Java ผู้ใช้เห็นการติดตั้งของ Node.js, Python, Go, Flutter และ Git พร้อมการติดตั้งที่มีผลจริงของแต่ละเครื่องมือ และเห็นว่าการติดตั้งแต่ละชุดมาจากตัวติดตั้งชนิดใด เพิ่มโฟลเดอร์ค้นหาเองได้ และการติดตั้งที่หายไปแสดงเป็น "ใช้งานไม่ได้"

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] InstallationProbe ยืนยันรากการติดตั้งของ Node, Go, Python, Flutter และ Git ตาม spec (Flutter ใช้ `bin\cache\flutter.version.json` เพราะรุ่นใหม่ไม่มีไฟล์ `version`)
- [ ] บนเครื่องทดสอบ พบ Node 24.20.0, Python 3.14.6, Go 1.27.0 และ Git 2.55.0.5 ส่วน Flutter 3.32.4 จะพบหลังเพิ่ม `E:\Dev` เป็นโฟลเดอร์ค้นหา (D-1, D-6)
- [ ] InstallerCatalog อ่านรายการ uninstall จาก HKLM, WOW6432Node และ HKCU แล้วจับคู่ได้ครบ รวม Node และ Go ที่ InstallLocation ว่าง ซึ่งต้องหาผ่าน MSI ที่ Windows cache ไว้ (D-4)
- [ ] จัดชนิดของตัวติดตั้งเป็น MSI, Inno Setup, Python install manager, "มีเครื่องมืออื่นดูแล" และโฟลเดอร์ล้วน แล้วแสดงใน UI
- [ ] ไม่สแกนไดรฟ์อื่นเอง
- [ ] การติดตั้งที่โฟลเดอร์หายไปแสดงเป็น "ใช้งานไม่ได้" ไม่สรุปว่าถูกถอน (D-5)
- [ ] มี test ที่ core ด้วยของปลอม (รวม MSI ที่ InstallLocation ว่าง) และมี adapter contract test ของ InstallerCatalog บน Windows จริงแบบอ่านอย่างเดียว
