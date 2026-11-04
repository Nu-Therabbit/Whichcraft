# SSH: เอกสารอ้างอิงเพื่อออกแบบฟีเจอร์

สำรวจเอกสาร: 3 พฤศจิกายน 2026 — ข้อเสนอเบื้องต้น ยังไม่ใช่ spec ที่ตกลงแล้ว ไม่มีการอ่านไฟล์ส่วนตัวหรือทดสอบเชื่อมต่อในงานค้นคว้านี้

## ข้อเท็จจริง

- OpenSSH อ่าน command line → user config → system config และโดยทั่วไปใช้ค่าที่พบก่อน; `Host` รองรับหลาย pattern และ negation ส่วน `IdentityFile` หลายรายการสะสมเป็นลำดับ [ssh_config](https://man.openbsd.org/ssh_config)
- `Include` รองรับ glob และประมวลผลตามลำดับชื่อไฟล์ โดยอาจอยู่ใน `Host`/`Match`; `IdentityAgent` เลือก agent และ `IdentitiesOnly` จำกัด identities ที่จะเสนอ [ssh_config](https://man.openbsd.org/ssh_config)
- `ssh -G host` แสดงค่าหลังประเมิน `Host` และ `Match` แล้วจบ [ssh](https://man.openbsd.org/ssh#G) แต่ `Match exec` เรียกคำสั่ง shell [ssh_config: Match](https://man.openbsd.org/ssh_config#Match) ดังนั้น **อนุมานได้ว่า `-G` ไม่ใช่การอ่านเฉย ๆ สำหรับ config ใดก็ได้**
- ลำดับเลือกคำสั่ง SSH ของ Git 2.56.0 คือ `GIT_SSH_COMMAND` → `core.sshCommand` → `GIT_SSH` → `ssh`; `ssh.variant`/`GIT_SSH_VARIANT` ยังเปลี่ยนรูปแบบ arguments ได้ [Git 2.56.0 source: get_ssh_command / fill_ssh_args](https://github.com/git/git/blob/v2.56.0/connect.c#L1096), [Git environment](https://git-scm.com/docs/git#_other)
- Windows OpenSSH กับ OpenSSH ที่ bundled มากับ Git อาจอยู่พร้อมกัน การใช้ client หรือ `ssh-add` คนละตัวอาจทำให้ใช้ agent คนละชุด [Git for Windows FAQ](https://gitforwindows.org/faq#i-get-permission-denied-publickey-when-using-git-pull-or-git-clone)
- `ssh-add -l` แสดง fingerprints ของ identities ใน agent; `-L` แสดง public keys ขณะที่ `ssh-add` แบบไม่มี arguments จะเพิ่ม keys จึงห้ามใช้แทนคำสั่ง inventory [ssh-add](https://man.openbsd.org/ssh-add)
- ใช้ `ssh-keygen -lf <public-key.pub>` ดู fingerprint โดยไม่ต้องอ่าน private key [ssh-keygen](https://man.openbsd.org/ssh-keygen#l) Private key ต้องป้องกันเหมือนรหัสผ่าน ส่วน public key แชร์ได้ [Microsoft: key pairs](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement#key-pairs)
- การเชื่อมต่อจริงอาจเพิ่มหรืออัปเดต `known_hosts` ตามการตั้งค่า `StrictHostKeyChecking`, `CheckHostIP` และ `UpdateHostKeys` [ssh_config: host verification](https://man.openbsd.org/ssh_config#StrictHostKeyChecking)

## ข้อเสนอสำหรับ Whichcraft

ส่วนนี้เป็นการออกแบบที่เสนอ ไม่ใช่พฤติกรรมที่ OpenSSH รับประกันให้แอป:

1. **ดูว่า Git ของ repo จะใช้ SSH ตัวไหน** พร้อมแหล่งที่มาของคำสั่ง, version, arguments และ agent ที่ตรวจพบ แยก “พบโปรแกรม” จาก “Git จะใช้ตัวนี้”
2. **ดู Host aliases และไฟล์ต้นทาง** พร้อม `HostName`, `User`, `Port`, `IdentityFile`, `IdentitiesOnly`, `IdentityAgent`, `ProxyJump` และลำดับ include; อย่าสรุปว่า Host block แต่ละอันเป็นการเชื่อมต่อที่แยกขาด เพราะหลาย block อาจตรงกัน
3. **ดู public key inventory**: ชื่อไฟล์, algorithm, SHA256 fingerprint และการพบ fingerprint เดียวกันใน agent; public comment เป็นเพียงป้ายกำกับ ไม่ใช่หลักฐานว่าเป็นบัญชี Git ใด
4. **แก้ค่าพื้นฐานผ่าน diff/Apply/Undo** โดยรักษา comments, ลำดับ block, include และ directives ที่แอปไม่รู้จัก ตรวจ conflict หากโปรแกรมอื่นแก้ไฟล์ ไม่เขียนไฟล์ใหม่จาก flattened effective values
5. **ตรวจปัญหาที่อธิบายได้** เช่น identity path ไม่มีอยู่, alias ไม่ตรง remote, client กับ agent ไม่สัมพันธ์, config ถูก global wildcard ก่อนหน้าบัง และ Git override เลี่ยง config ที่กำลังดู

รุ่นแรกควรเน้นดูข้อมูลและแก้ user client config พื้นฐาน ผูกกับ Git config inspector โดยให้ agent inventory เป็นการตรวจแยก ใช้ executable ที่ระบุแน่นอน ไม่เปิด/ปิด service หรือเพิ่ม/ลบ keys อัตโนมัติ

การสร้าง key, เปลี่ยน passphrase, ลงทะเบียน key กับ GitHub/Bitbucket, จัดการ SSH server, tunnels และแก้ host trust ควรแยกเป็นงานถัดไปตามความต้องการจริง

## ข้อจำกัดที่ต้องแสดงในฟีเจอร์

- ตัวอ่านแบบ static ควรแสดง “ยังประเมินไม่ได้” สำหรับ `Match exec` หรือเงื่อนไขซับซ้อน แทนทำงานแทนผู้ใช้เงียบ ๆ; `ssh -G` ควรเป็นคำสั่งตรวจที่แสดงผลกระทบก่อน และไม่เรียก arbitrary wrapper จาก Git config อัตโนมัติ
- ตรวจ capability จาก client ที่ใช้อยู่จริง คู่มือ OpenBSD รุ่นล่าสุดอาจมี options ที่ Windows หรือ bundled OpenSSH รุ่นเก่าไม่รองรับ
- การมี key ในไฟล์หรือ agent ไม่พิสูจน์ว่า server จะยอมรับ key นั้น และ config ที่เลือก identity ไว้ก็ไม่พิสูจน์ว่าเป็น key ที่ใช้ยืนยันตัวตนสำเร็จ
- ปุ่มทดสอบเชื่อมต่อเป็นการทำงานบนเครือข่ายและอาจเรียก proxy/คำสั่งจาก config ต้องแยกจากการอ่าน inventory; ห้ามเสนอ “แก้” โดยปิด host-key verification อัตโนมัติ
- Connection test ต้องกำหนดว่าจะคง `known_hosts` เดิมอย่างไร และรายงานผล authentication แยกจาก shell access; exit code อย่างเดียวอาจไม่พอสำหรับบริการ Git hosting
- `.ssh/config` อาจมีข้อมูลลับฝังในคำสั่ง proxy หรือ include; sanitize หน้าจอ, export และ log โดยไม่อ่านเนื้อหา private keys
