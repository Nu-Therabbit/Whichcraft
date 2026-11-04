# Community solutions: SSH configuration

ตรวจเมื่อ 3 พฤศจิกายน 2026 จาก repository, README, LICENSE และ release ของผู้พัฒนาโดยตรง ยังไม่ได้ติดตั้งหรือทดสอบโปรแกรม คำว่า “รองรับ” ด้านล่างหมายถึงสิ่งที่ผู้พัฒนาระบุ ไม่ใช่ผลทดสอบบนเครื่องนี้

| ตัวเลือก | สิ่งที่ตรงกับโจทย์ | Windows / stack | ข้อจำกัดสำหรับ Whichcraft |
|---|---|---|---|
| [sshush](https://github.com/s-johri/sshush) | รวม keys, fingerprint, agent load state และ host ที่ใช้ key; แก้ config เดิม, ตาม Include, backup, แสดง Match แบบอ่านอย่างเดียว | Go TUI; README กล่าวถึง Windows clipboard แต่ยังยืนยัน Windows release/native agent จากไฟล์ build ไม่ได้ | ใกล้กับงาน config มากที่สุด แต่ไม่ใช่ component Rust/React และการบันทึกอาจเปลี่ยน formatting ทั้งไฟล์ |
| [OpenSSH-GUI](https://github.com/frequency403/OpenSSH-GUI) | GUI จัดการ key, fingerprints, passphrase, key format, known_hosts/authorized_keys; อ่าน Host เพื่อ quick-connect | ผู้พัฒนาระบุ Windows/Linux/macOS; Avalonia + ReactiveUI + .NET 10 | README ระบุชัดว่า **SSH config editing ยังไม่ทำ** มีเพียงเมนู placeholder; ไม่ใช่ตัวแทน config editor ที่ต้องการ |
| [sshs](https://github.com/quantumsheep/sshs) | อ่าน config เดิมเพื่อค้นหาและเชื่อมต่อ Host | Rust + Ratatui/Crossterm; README ระบุ prebuilt Windows และ Chocolatey | เหมาะดูแนวทาง host browser/launcher; หลักฐานที่อ่านไม่ได้ระบุ GUI editor หรือ key/agent manager |
| [SSH Pilot](https://github.com/mfat/sshpilot) | ใช้ config เดิม, connection manager, terminal/SFTP, key transfer และ known_hosts management | Python + GTK4/libadwaita; README ปัจจุบันระบุ Windows installer ด้วย | เป็น SSH client เต็มตัว ขอบเขตกว้างกว่าฟีเจอร์ config; runtime/UI คนละชุดกับ Whichcraft |

ข้อเท็จจริงในตารางอ้างอิง [sshush README](https://github.com/s-johri/sshush#features), [OpenSSH-GUI README และ Known Limitations](https://github.com/frequency403/OpenSSH-GUI#known-limitations), [sshs README](https://github.com/quantumsheep/sshs#readme), [sshs Cargo.toml](https://github.com/quantumsheep/sshs/blob/master/Cargo.toml), [SSH Pilot README](https://github.com/mfat/sshpilot#readme)

## License ที่ตรวจได้

- **OpenSSH-GUI: MIT** อ่านตัวบท [LICENSE](https://github.com/frequency403/OpenSSH-GUI/blob/master/LICENSE) แล้ว
- **sshs: MIT** อ่านตัวบท [LICENSE](https://github.com/quantumsheep/sshs/blob/master/LICENSE) แล้ว
- **SSH Pilot: GPL v3** อ่านตัวบท [LICENSE](https://github.com/mfat/sshpilot/blob/main/LICENSE) แล้ว
- **sshush: README และ GitHub ระบุ MIT** แต่การเปิดตัวบท [LICENSE](https://github.com/s-johri/sshush/blob/main/LICENSE) ผ่านเครื่องมือค้นคว้าครั้งนี้ล้มเหลว จึงยังไม่ถือว่ายืนยันตัวบทเพื่อดึงโค้ดมาใช้

ยังไม่ได้คัดลอกโค้ดหรือประเมินเงื่อนไขการนำไปแจกจ่ายใน Whichcraft

## สัญญาณการดูแลที่พบ

Release ที่หน้า `latest` แสดง ณ วันที่ตรวจ: [sshush v1.0.0](https://github.com/s-johri/sshush/releases/tag/v1.0.0) วันที่ 1 ตุลาคม, [OpenSSH-GUI v3.2.4](https://github.com/frequency403/OpenSSH-GUI/releases/tag/v3.2.4) วันที่ 10 กรกฎาคม, [sshs 4.8.0](https://github.com/quantumsheep/sshs/releases/tag/4.8.0) วันที่ 28 สิงหาคม และ [SSH Pilot v6.3.6](https://github.com/mfat/sshpilot/releases/tag/v6.3.6) วันที่ 19 ตุลาคม หน้า release ไม่แสดงปีในข้อความที่เครื่องมือส่งกลับ จึงไม่เติมปีเอง และไม่ได้สรุปอัตราการดูแลจากจำนวนดาว

## สิ่งที่นำมาใช้เป็นแนวทางได้

**ข้อเสนอ:** ใช้ sshush เป็นตัวอย่างการเชื่อม “key นี้ใช้กับ host ไหน / อยู่ใน agent หรือยัง” เพราะตรงกับงานของเรา ส่วน OpenSSH-GUI เป็นตัวอย่างหน้าจอ Windows สำหรับ key inventory; sshs เป็นตัวอย่างโค้ด Rust สำหรับ host browsing เลือกยืมแนวทางเฉพาะส่วนแทนเพิ่มโปรแกรม client ทั้งตัวเป็น dependency

sshush ระบุว่าเก็บ comments, ลำดับ และ options ที่ไม่รู้จัก แต่ยอมรับว่าการเขียนทั้งไฟล์อาจเปลี่ยน tabs, spacing, case และ CRLF; หลีกเลี่ยงการตรวจด้วย `ssh -G` เมื่อมี `Match exec` ข้อจำกัดนี้ควรถูกนำมาเป็น acceptance case ของ editor เราด้วย [sshush: config editing](https://github.com/s-johri/sshush#features)

สำหรับ Rust มี [veeso/ssh2-config](https://github.com/veeso/ssh2-config) เป็น parser/query/serializer ที่ควรประเมิน รุ่น [0.9.0](https://docs.rs/crate/ssh2-config/0.9.0) เผยแพร่ 20 ตุลาคม 2026 และ repo ระบุ MIT แต่ README ยังระบุ `Match` และ tokens เป็น missing features จึงไม่ควรถือว่าเทียบเท่า OpenSSH ทุกกรณี การค้นคว้านี้ไม่พบคำรับประกันเรื่องรักษา comments/format แบบครบถ้วน จึงยังไม่เสนอให้ใช้ serializer เขียนทับไฟล์ผู้ใช้

ตัวอย่างที่ระบุเรื่องรักษา comments โดยตรงคือ [kevinburke/ssh_config](https://github.com/kevinburke/ssh_config) แต่เป็น Go และไม่รองรับ Match ตาม README; ใช้ศึกษาโครงสร้างได้ โดยยังไม่ได้ตรวจ license เพื่อคัดลอกโค้ด
