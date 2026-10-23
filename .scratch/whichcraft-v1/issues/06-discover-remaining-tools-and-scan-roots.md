# 06: ค้นหาเครื่องมือที่เหลือและโฟลเดอร์ค้นหา

**What to build:** นอกจาก Java ผู้ใช้เห็นการติดตั้งของ Node.js, Python, Go, Flutter และ Git พร้อมการติดตั้งที่มีผลจริงของแต่ละเครื่องมือ และเห็นว่าการติดตั้งแต่ละชุดมาจากตัวติดตั้งชนิดใด เพิ่มโฟลเดอร์ค้นหาเองได้ และการติดตั้งที่หายไปแสดงเป็น "ใช้งานไม่ได้"

**Blocked by:** 02

**Status:** resolved

- [x] InstallationProbe ยืนยันรากการติดตั้งของ Node, Go, Python, Flutter และ Git ตาม spec (Flutter ใช้ `bin\cache\flutter.version.json` เพราะรุ่นใหม่ไม่มีไฟล์ `version`) — probe ของทุกเครื่องมืออยู่ใน tools/probes; Flutter ใช้ flutter.version.json
- [x] บนเครื่องทดสอบ พบ Node 24.20.0, Python 3.14.6, Go 1.27.0 และ Git 2.55.0.5 ส่วน Flutter 3.32.4 จะพบหลังเพิ่ม `E:\Dev` เป็นโฟลเดอร์ค้นหา (D-1, D-6) — contract_discovers: Node 24.20.0, Python 3.14.6, Go 1.27.0, Git 2.55.0.windows.5, Flutter 3.32.4 หลังเพิ่ม E:\Dev
- [x] InstallerCatalog อ่านรายการ uninstall จาก HKLM, WOW6432Node และ HKCU แล้วจับคู่ได้ครบ รวม Node และ Go ที่ InstallLocation ว่าง ซึ่งต้องหาผ่าน MSI ที่ Windows cache ไว้ (D-4) — แก้ให้หาโฟลเดอร์ MSI ผ่าน MsiGetComponentPathW; contract_msi_products_without_install_location_resolve_to_their_folder ผ่านบนเครื่องจริง
- [x] จัดชนิดของตัวติดตั้งเป็น MSI, Inno Setup, Python install manager, "มีเครื่องมืออื่นดูแล" และโฟลเดอร์ล้วน แล้วแสดงใน UI — แสดงเป็น badge แปลภาษาใน UI รวม Installed by Whichcraft
- [x] ไม่สแกนไดรฟ์อื่นเอง — ค้นเฉพาะ PATH, ตำแหน่งมาตรฐาน, โฟลเดอร์ค้นหา และที่เก็บของแอป
- [x] การติดตั้งที่โฟลเดอร์หายไปแสดงเป็น "ใช้งานไม่ได้" ไม่สรุปว่าถูกถอน (D-5) — with_missing_selection: การติดตั้งที่เลือกไว้แต่โฟลเดอร์หายแสดงเป็นใช้งานไม่ได้
- [x] มี test ที่ core ด้วยของปลอม (รวม MSI ที่ InstallLocation ว่าง) และมี adapter contract test ของ InstallerCatalog บน Windows จริงแบบอ่านอย่างเดียว — unit tests ของ classify/product code/long name + contract tests อ่านอย่างเดียว 2 ข้อ
