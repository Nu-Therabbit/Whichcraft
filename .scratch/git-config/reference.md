# Git config: เอกสารอ้างอิงเพื่อออกแบบฟีเจอร์

สำรวจเอกสาร: 3 พฤศจิกายน 2026 — ยังเป็นข้อเสนอ ไม่ใช่ spec ที่ตกลงแล้ว

## ข้อเท็จจริงจาก Git

- ลำดับทั่วไปคือ system → global (XDG ก่อน `~/.gitconfig`) → local → worktree → command; ค่าชนิดหลายรายการอาจสะสมข้ามไฟล์ จึงใช้กฎ “ตัวสุดท้ายชนะ” กับทุก key ไม่ได้ [Git config: files/scopes](https://git-scm.com/docs/git-config#FILES)
- Include แทรกค่าตรงตำแหน่งประกาศ; relative path อิงไฟล์ผู้ประกาศ ส่วน `hasconfig:remote.*.url` จับคู่ remote ใดก็ได้ และไฟล์ที่ include ผ่านเงื่อนไขนี้ห้ามประกาศ remote URL [Git config: includes](https://git-scm.com/docs/git-config#_includes)
- `--includes`, `--show-origin`, `--show-scope`, `--null` ช่วยอ่านค่าพร้อมแหล่งที่มา; การระบุไฟล์หรือ scope ปิด includes โดยปริยาย [Git config: options](https://git-scm.com/docs/git-config#OPTIONS)
- Config ของ repository ใช้ร่วมกันระหว่าง worktree โดยปริยาย; เมื่อเปิด `extensions.worktreeConfig` จึงมีไฟล์แยก ควรหาไฟล์ผ่าน `git rev-parse --git-path config.worktree` [Git worktree: configuration](https://git-scm.com/docs/git-worktree#_configuration_file)
- `--worktree` จะทำงานเหมือน `--local` ถ้ายังไม่เปิด extension จึงต้องตรวจให้ชัดก่อนเขียน [Git config: options](https://git-scm.com/docs/git-config#OPTIONS)
- `credential.helper` เป็นลำดับของโปรแกรมที่เรียกจนได้ credentials ครบ; ค่าเปล่าล้างลำดับก่อนหน้า `credential.useHttpPath` กำหนดให้แยก credentials ตาม path ด้วย [Git credentials](https://git-scm.com/docs/gitcredentials#_configuration_options)
- ใช้ `git --no-pager` เพื่อไม่เรียก pager ระหว่างอ่าน; environment อาจ override config และข้อมูลลับอาจอยู่ในชื่อ key เช่น `url.<base>.insteadOf` ด้วย [Git: options](https://git-scm.com/docs/git#_options), [Git: environment](https://git-scm.com/docs/git#_other)

## ข้อเสนอสำหรับ Whichcraft

ข้อเสนอต่อไปนี้เป็นการออกแบบของเรา ไม่ใช่ความสามารถที่ Git รับประกันให้แอป:

- เริ่มจากการเลือก repository แล้วอธิบายค่าที่มีผลจริง พร้อม scope, ไฟล์, ลำดับ และเหตุผลที่ include ทำงาน/ไม่ทำงาน ให้ Git รุ่นที่ใช้อยู่เป็นผู้ resolve; การดูเฉพาะ global ไม่สามารถสรุปผลของทุก repository ได้
- แยก “ไม่มีค่าที่ตั้งไว้” ออกจากค่าเริ่มต้นของ Git และแยกค่าจากไฟล์ออกจาก environment ของ process ที่กำลังตรวจ
- จัด editor ตามงาน: ตัวตน, เงื่อนไขแยกงาน/ส่วนตัว, SSH/credential helper, line endings, pull/push, signing และ advanced keys; ตัวตน commit กับบัญชีที่ใช้ยืนยันตัวตนเป็นคนละเรื่อง
- อย่าเรียก helper, alias, editor, SSH, filter, diff หรือ hook เพียงเพื่อแสดง config; การทดสอบการเชื่อมต่อควรเป็นคำสั่งแยกที่ผู้ใช้เลือก
- ก่อนเขียนต้องระบุไฟล์เป้าหมายและผลกระทบให้ชัด แสดง diff แล้ว Apply/Undo โดยตรวจการแก้พร้อมกัน ไม่ serialize config ทั้งหมดจากรายการ key/value เพราะจะทำให้ comment, ลำดับ และโครง include เสียได้
- ทดลองการแก้ผ่าน Git กับไฟล์สำเนาก่อนนำมาใช้จริง รวม comment, inline comment, newline, repeated key, empty helper และ include; อย่าสัญญาว่าคำสั่ง Git จะรักษารูปแบบทุกอย่างโดยยังไม่มีหลักฐาน
- Undo ควรย้อนเฉพาะรายการที่แอปแก้ หากพบการแก้จากโปรแกรมอื่นให้แสดง conflict แทนคืนไฟล์เก่าทั้งก้อน; การแก้หลายไฟล์ต้องมี journal และรายงานกรณีสำเร็จเพียงบางไฟล์
- ปิดบังค่าและชื่อ key ที่อาจมี token/password ในหน้าจอ, diff, export และ log; อย่าอ่าน private key หรือ credential store เพื่อทำ inventory

## ประเด็นที่ต้องพิสูจน์ก่อนเขียน spec

- เวอร์ชัน Git ขั้นต่ำและ syntax ที่รองรับ รวมกรณีสลับการติดตั้ง Git แล้ว system config เปลี่ยน
- การตรวจ include ที่ไม่ได้ทำงาน: แสดงได้เพียงหลักฐานจาก context ที่เลือก หรือจำเป็นต้องมีตัวอธิบายเงื่อนไขเพิ่มเติม
- จะให้แก้ system config ในรุ่นแรกหรืออ่านอย่างเดียว และการแก้ local/worktree จะรวมอยู่ในขอบเขตใด
- การรักษารูปแบบไฟล์และการป้องกัน race ระหว่าง preview, Apply และ Undo ต้องทดสอบกับ backend จริง
