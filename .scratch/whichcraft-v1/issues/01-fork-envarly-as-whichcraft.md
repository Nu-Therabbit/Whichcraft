# 01: Fork Envarly เป็น Whichcraft

**What to build:** เริ่มโค้ดของ Whichcraft จาก Envarly ที่ commit `f0ad0ff67508bb55091b46bba524667984531350` เมื่อเสร็จ แอปต้อง build และเปิดได้ในชื่อ Whichcraft และมีโครงของ Whichcraft core ฝั่ง Rust พร้อม port ทั้งหมดตาม spec แต่ละ port มีของปลอมในหน่วยความจำ ทำให้เขียน test ที่ API ของ core ได้ตั้งแต่ ticket ถัดไป ใบนี้เป็นงานเตรียมโค้ด (prefactor) ยังไม่มีฟีเจอร์ใหม่

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] โค้ดของ Envarly อยู่ใน repo นี้ โดยบันทึก commit ต้นทางและไลเซนส์ MIT ของ Envarly ไว้
- [x] ชื่อแอป, bundle identifier และชื่อหน้าต่างเปลี่ยนเป็น Whichcraft และ installer ที่ build ได้ใช้ชื่อ Whichcraft
- [x] `npm run tauri build` ผ่าน และ test เดิมของ Envarly ผ่านทั้งฝั่ง Rust (`cargo test`) และ vitest
- [x] มีโมดูล Whichcraft core ที่ Tauri command เรียกได้ และไม่พึ่ง Windows โดยตรง
- [x] มี port ตามที่ spec กำหนด (EnvBackend เดิม และตัวใหม่ เช่น EnvironmentResolver, InstallationProbe, InstallerCatalog, ToolManager, UsageProbe, Uninstaller, Journal, TerminalLauncher, ShellProbe) แต่ละตัวมีของปลอมในหน่วยความจำ และมี test ตัวอย่างหนึ่งข้อที่เรียก core ผ่านของปลอม
- [x] มีโครงสำหรับ adapter contract tests แบบเปิดใช้เองที่ไม่รันใน CI ปกติ
