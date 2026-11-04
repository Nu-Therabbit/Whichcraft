# SSH — ผลสำรวจและแนวทางฟีเจอร์

วันที่: 3 พฤศจิกายน 2026 (Asia/Bangkok)

สถานะ: สำรวจต่อจาก Git config ตามคำถามผู้ใช้ ยังไม่ใช่ spec ที่ตกลงแล้ว

## หลักฐานจากเครื่อง

- `~/.ssh/config` มี `Host bitbucket.org`, `IdentityFile ~/.ssh/fork_home_anusorn_gosoft` และ `IdentitiesOnly yes` ไม่พบ Host block อื่นในไฟล์นี้
- พบ public key 2 ไฟล์: `fork_home_anusorn_gosoft.pub` และ `fork_nutherabbit.pub`; ตรวจด้วย `ssh-keygen -lf` แล้วทั้งคู่เป็น ED25519 256-bit และมีไฟล์ชื่อคู่กันที่ไม่มีนามสกุล `.pub` ไม่ได้เปิดอ่านไฟล์ private key จึงไม่ได้ยืนยันว่าคู่กุญแจตรงกันหรือมี passphrase
- Whichcraft ตั้ง `core.sshCommand=ssh -i ~/.ssh/fork_nutherabbit -o IdentitiesOnly=yes` ใน local Git config ตามผลสำรวจรอบก่อน
- พบ `known_hosts` และ `known_hosts.old` โดยอ่านเฉพาะรายการชื่อไฟล์ ไม่อ่านเนื้อหา
- `ssh` และ `ssh-add` ที่ shell นี้ค้นพบอยู่ใน `C:\Windows\System32\OpenSSH`; `ssh -V` รายงาน `OpenSSH_for_Windows_9.5p2`
- พบ executable อีกตัวที่ `C:\Program Files\Git\usr\bin\ssh.exe` แต่ตรวจเวอร์ชันใน sandbox ไม่สำเร็จเพราะ MSYS permission error จึงยังไม่สรุปเวอร์ชันหรือว่า Git ใช้ตัวนี้จริง
- การตรวจครั้งนี้ไม่พบ Windows service ชื่อ `ssh-agent` และ process นี้ไม่มี `SSH_AUTH_SOCK`, `GIT_SSH` หรือ `GIT_SSH_COMMAND` ไม่ได้ตรวจ agent ทุกชนิดหรือ process ของ IDE อื่น จึงยังสรุปไม่ได้ว่าเครื่องนี้ไม่มี agent ใช้งานอยู่เลย
- ไม่พบ `%PROGRAMDATA%\ssh\ssh_config` ณ เวลาตรวจ

รอบนี้อ่านเฉพาะ config, รายชื่อไฟล์ และ public-key fingerprint ไม่เชื่อมต่อ server ไม่เพิ่ม/ลบ key ไม่เปลี่ยน config หรือ known_hosts

## ข้อเสนอสำหรับ Whichcraft

1. **Hosts** — ดูและแก้ host/alias, hostname, user, port และ identity file พร้อม preview/diff/undo ตัวอย่างแยก GitHub งาน/ส่วนตัวด้วย alias เมื่อใช้ host เดียวกันหลายบัญชี
2. **Keys** — แสดง public key, fingerprint, algorithm, พาธ และ host ที่อ้างถึง มีปุ่ม copy public key; การสร้าง key หรือเพิ่มเข้า agent เป็น action แยกที่ต้องกำหนดรายละเอียดภายหลัง
3. **เชื่อมกับ Git config** — เลือก repo แล้วแสดง remote host, `core.sshCommand` และ SSH host rule ร่วมกัน ช่วยอธิบายว่าตั้ง key ตรงไหน และแยกจากชื่อ/อีเมลใน commit
4. **ตรวจการเชื่อมต่อ** — ผู้ใช้เลือก host แล้วสั่งทดสอบ แสดงผลแยกการเชื่อมต่อ, host verification, authentication และข้อความตอบจากบริการ ต้องกำหนด command/timeout/known_hosts behavior ให้ชัดก่อนทำจริง
5. **Agent และ SSH client** — บอก executable/agent ที่กำลังตรวจ แสดง fingerprint ของ key ที่โหลดอยู่ และเพิ่ม/ถอด key แบบเจาะจงในระยะต่อไป โดยไม่เหมารวม Windows OpenSSH กับ Git-bundled SSH ว่าใช้ agent เดียวกัน
6. **Advanced** — ProxyJump, port forwarding, keepalive และ known_hosts inspection ภายหลัง ไม่ควรเสนอ auto-delete host key เมื่อพบ mismatch

แนะนำรุ่นแรกเป็น Hosts + Keys inventory/copy public key + Git explanation + diff/undo โดยให้การทดสอบ connection เป็น action ที่ผู้ใช้เลือก ต่างจาก inventory ซึ่งไม่ควรติดต่อ network

ต้องรักษาลำดับ Host/Match/Include และ comment พร้อมรองรับ directive ที่ยังไม่มีฟอร์มแก้ ไม่ควรใช้กฎ override ของ Git มาแทน SSH เพราะ resolution ต่างกัน เอกสารอ้างอิงและข้อควรพิสูจน์อยู่ใน [reference.md](reference.md)

ฟีเจอร์นี้ขยายจากการจัดการเครื่องมือไปสู่การตั้งค่าการเชื่อมต่อ จึงเสนอพื้นที่ SSH ของตัวเองและเชื่อมข้อมูลกับ Git config โดยยังไม่ได้เปลี่ยน navigation หรือโค้ดแอป
