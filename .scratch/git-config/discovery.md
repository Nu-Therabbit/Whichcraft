# Git config — ผลสำรวจและแนวทางฟีเจอร์

วันที่: 3 พฤศจิกายน 2026 (Asia/Bangkok)

สถานะ: สำรวจและเสนอขอบเขต ยังไม่ใช่ spec ที่ตกลงแล้ว และยังไม่ได้เพิ่มฟีเจอร์ในแอป

## สิ่งที่ตรวจจริง

อ่าน system/global config, ไฟล์ include ใน home, config ของ 9 repository ที่อยู่ชั้นแรกใต้ `E:\Dev` และ directive ที่เกี่ยวข้องใน `~/.ssh/config` ไม่ได้สแกนทั้งเครื่อง ไม่อ่าน private key หรือ credential store และไม่เปลี่ยน Git/SSH config

ใช้ `git config --includes --list --show-origin --show-scope` ตรวจแหล่งที่มาของค่า แล้วอ่านซ้ำด้วย `git --no-pager` สำหรับการเทียบ repository ไม่เก็บ dump config เต็ม อีเมลเต็ม remote URL เต็ม และข้อมูลภายใน GitButler ลงบันทึกนี้

ผลจากไฟล์ในเครื่องเป็นหลักฐานเฉพาะเวลาที่ตรวจ ไม่ได้หมายความว่า IDE/terminal ทุกตัวจะใช้ environment และ Git executable เดียวกัน

| แหล่งข้อมูล | สิ่งที่พบ |
| --- | --- |
| `C:\Program Files\Git\etc\gitconfig` | LFS filters, `http.sslBackend=schannel`, `core.autocrlf=true`, `core.fscache=true`, `core.symlinks=false`, `pull.rebase=false`, `credential.helper=manager`, Azure `useHttpPath=true`, `init.defaultBranch=master` |
| `~/.gitconfig` | ชื่อส่วนตัวและอีเมล Gmail พร้อม `includeIf` 4 เงื่อนไขตาม Bitbucket remote URL: SCP-style SSH, ssh://, HTTPS และ HTTPS ที่มี username |
| `~/.gitconfig-gosoft` | ชื่อและอีเมลงาน ใช้เมื่อเงื่อนไข Bitbucket ตรง |
| `~/.ssh/config` | `Host bitbucket.org` เลือก identity file สำหรับงาน และ `IdentitiesOnly=yes`; อ่านเฉพาะ directive ไม่อ่านไฟล์กุญแจ |
| Whichcraft `.git/config` | อีเมล GitHub noreply ทับ global; `core.sshCommand` เลือกกุญแจส่วนตัวพร้อม `IdentitiesOnly=yes`; เปิด `extensions.worktreeConfig=true` แต่ไม่พบ `config.worktree` ของ worktree ปัจจุบัน |
| `~/.config/git/config` | ไม่พบไฟล์ ณ เวลาที่ตรวจ |

`init.defaultBranch=master` เป็นค่าที่ตั้งสำหรับสร้าง repo ใหม่ ไม่ใช่ชื่อ branch ปัจจุบันของทุก repo

## ตัวอย่างผลที่มีผลจริงแยกตาม repository

| Repository | Remote host | แหล่งตัวตนที่ตรวจพบ |
| --- | --- | --- |
| `7-eleven-ios` | Bitbucket | ชื่อและอีเมลงานจาก conditional include |
| `all-member-android` | Bitbucket | โหลด conditional include แต่ชื่อและอีเมลงานจาก local มีผลท้ายสุด |
| `mob-lam-lamap-mobile-app` | Bitbucket (2 remotes) | โหลด conditional include แต่ชื่อและอีเมลงานจาก local มีผลท้ายสุด |
| `mob-sdl-sdlap-staff-android` | Bitbucket | ชื่อและอีเมลงานจาก conditional include; มีตั้ง `core.longpaths` ใน local ด้วย |
| `angkorgit` | GitHub (2 remotes) | ตัวตนส่วนตัวจาก global |
| `flutter` | GitHub | ตัวตนส่วนตัวจาก global |
| `keyboard-asmr` | ไม่พบ remote | ตัวตนส่วนตัวจาก global |
| `poc share sevennow` | GitHub | ตัวตนส่วนตัวจาก global |
| `Whichcraft` | GitHub | ชื่อจาก global แต่อีเมล noreply จาก local |

พบ config ของ GitButler ใน `all-member-android` และ `extensions.worktreeConfig` ทั้งใน repo นี้กับ Whichcraft; editor ต้องคง key ที่ไม่รู้จักและข้อมูลที่เครื่องมืออื่นดูแล

พบ Git สอง executable paths จากการค้นหาคำสั่ง: Git for Windows ที่ติดตั้งใน Program Files และ runtime ของ Codex การอ่านครั้งนี้ใช้ตัวแรก (`2.56.0.windows.3`) ฟีเจอร์ควรแสดง executable ที่ใช้ตรวจ เพราะเมื่อเปลี่ยน Git installation แหล่ง system config อาจเปลี่ยนด้วย

## ข้อเสนอจากเคสในเครื่องนี้

1. **ดูค่าที่มีผลจริงของ repo** — เลือก repo แล้วเห็นชื่อ/อีเมล, SSH command, behavior settings พร้อม scope, ไฟล์ต้นทาง, ค่าที่ถูกทับ และ include ที่เกี่ยวข้อง ค้นหา key ได้
2. **จัดการตัวตนงาน/ส่วนตัวและกฎ** — แก้ชื่อ/อีเมลในไฟล์ที่เลือก จัดการ include ตาม remote หรือโฟลเดอร์ และ preview ผลกับ repo ก่อน Apply แสดง local override ที่ทำให้แก้ global แล้วผลยังไม่เปลี่ยน
3. **อธิบายการยืนยันตัวตน** — แสดง `core.sshCommand`, SSH host rule และ credential helper แยกจากตัวตนที่ติดใน commit การตั้งชื่อ/อีเมลไม่ได้เปลี่ยนบัญชีที่ใช้ login และ config อย่างเดียวไม่ยืนยันบัญชีที่ server จะยอมรับ
4. **ตั้งค่าที่ใช้บ่อย** — line endings, pull merge/rebase/ff-only, push, fetch prune, default branch สำหรับ repo ใหม่, long paths; ระยะต่อไปอาจเพิ่ม signing, aliases, editor, diff/merge tools และ hooks ซึ่งยังไม่ได้พบว่ามีการตั้งส่วนใหญ่เหล่านี้ในชุดที่ตรวจ
5. **ดูผลกระทบและย้อนกลับ** — ระบุไฟล์ที่จะเขียน แสดง diff และ repo ที่รู้ว่ากระทบ ตรวจ conflict ก่อนเขียน และ Undo เฉพาะส่วนที่แอปเปลี่ยน Export แบบปิดบังค่าลับเป็นส่วนเสริมได้

ข้อเสนอรุ่นแรกคือข้อ 1–2 พร้อม editor ของค่าที่ใช้บ่อยในข้อ 4 และ Apply/Undo; system config และ SSH config เริ่มจากแสดงข้อมูลก่อน ส่วนการสร้างกุญแจ, login และทดสอบ network เป็นงานอีกชุดที่ต้องกำหนดขอบเขต

การจัดการ Git config ต่อ repo เป็นความสามารถใหม่ที่ต้องกำหนดขอบเขตแยกจากการสลับเวอร์ชันเครื่องมือต่อโปรเจกต์ใน ADR-0001 ปัจจุบันแอปมี Git inventory/switch แต่ยังไม่พบ Git config feature จากการค้นโค้ด

## ประเด็นที่ต้องระบุใน spec

- ค่าตัวตน commit กับบัญชี SSH/HTTPS เป็นคนละเรื่อง; ไม่มีสถานะบัญชีเดียวที่ใช้แทนทุก repo ได้
- Include ตาม remote ทำงานตามบริบท repo ไม่ใช่โปรไฟล์ที่เปิดใช้ทั้งเครื่อง และ remote ใดก็อาจทำให้เงื่อนไขตรง
- Config บาง key มีหลายค่า จึงห้ามใช้กฎตัวสุดท้ายชนะกับทุก key โดยเฉพาะ credential helpers
- Local config โดยปริยายใช้ร่วมกันหลาย worktree; การเพิ่ม editor ต้องบอกผลกระทบนี้ก่อนเขียน
- ค่าไม่มีใน config ไม่เท่ากับปิดความสามารถ ต้องแยกจากค่าเริ่มต้นของ Git และ environment override
- อ่านด้วย Git โดยไม่เปิด pager และไม่รัน helper, SSH, hooks หรือคำสั่งใน config เพื่อทำ inventory
- รักษา comment, ลำดับ, include และ unknown keys; ต้องพิสูจน์วิธีแก้ด้วยไฟล์ทดสอบก่อนรับรองการรักษารูปแบบ
- ต้องตรวจค่าลับทั้ง key/value ก่อนแสดง diff, export หรือ log

ข้อเท็จจริงจากเอกสาร Git และลิงก์ primary sources อยู่ใน [reference.md](reference.md) ส่วนขอบเขตด้านบนเป็นข้อเสนอจากผลสำรวจนี้
