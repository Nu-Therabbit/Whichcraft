# Git config / SSH — โครงการ community ที่เกี่ยวข้อง

ตรวจเอกสารโครงการ: 3 พฤศจิกายน 2026 (Asia/Bangkok)

เป็นการคัดกรองจาก primary repository/README/หน้า release ยังไม่ได้ติดตั้งหรือทดสอบกับ config จริงของผู้ใช้ และยังไม่ใช่การตัดสินใจเพิ่ม dependency หรือ fork

## ตัวเลือกฝั่ง Git

| โครงการ | สิ่งที่โครงการระบุว่าทำได้ | Stack / Windows | License ที่ระบุ |
| --- | --- | --- | --- |
| [DevSwitch](https://github.com/umesh-saini/DevSwitch) | Git profiles, สร้าง/import SSH keys, สร้าง host aliases, copy public key, agent และ CLI ร่วมกับ desktop | Electron + React + TypeScript; รองรับ Windows แต่ README ระบุว่า agent อาจต้องตั้งค่าเพิ่ม | MIT ตาม README และ metadata; การดึงเนื้อหา LICENSE โดยตรงรอบนี้ไม่สำเร็จ |
| [git-ego](https://github.com/bgreenwell/git-ego) | โปรไฟล์ตามโฟลเดอร์ผ่าน `includeIf`, SSH/signing settings และ HTTPS credential helper/keychain | Go CLI; มี Windows package instructions และ Windows release artifact | [MIT — อ่านไฟล์ LICENSE แล้ว](https://github.com/bgreenwell/git-ego/blob/main/LICENSE) |
| [gitch](https://github.com/orzazade/gitch) | identity rules ตาม directory/remote, SSH/GPG keys, TUI และ VS Code extension | Go CLI/TUI; README ระบุ Windows ZIP แต่ coverage CI เน้น macOS/Linux | MIT ตาม README และ metadata; การดึงเนื้อหา LICENSE โดยตรงรอบนี้ไม่สำเร็จ |

สำหรับ git-ego หน้า [Releases](https://github.com/bgreenwell/git-ego/releases) ที่เข้าถึงได้แสดง v0.2.4 วันที่ 14 กรกฎาคม 2026; README บน main อาจใหม่กว่าพฤติกรรมใน binary ที่ release แล้ว ไม่ถือว่าอ่าน README เท่ากับทดสอบ version นั้น

สำหรับ DevSwitch/gitch ยังไม่ได้ยืนยันวันที่ release ล่าสุดจากหน้า release ที่เข้าถึงไม่ได้ จึงไม่สรุปความถี่การดูแลหรือความพร้อม production จากคำอธิบายโครงการอย่างเดียว

## ข้อเสนอสำหรับ Whichcraft

- **DevSwitch เป็นตัวเทียบฟีเจอร์รวม Git + SSH ที่ตรงที่สุดในชุดนี้** มี React/TypeScript ใกล้ frontend ของเรา แต่ shared core ยังใช้ Node/Electron จึงไม่ใช่ Rust backend ที่นำมาเสียบตรง ๆ
- **git-ego น่าศึกษาเรื่อง generated include files และการแยก identity/credentials** แต่ใช้ directory rules ต่างจาก remote-based `includeIf` ที่พบในเครื่องนี้ จึงยังไม่ยืนยันว่าจะใช้แทน setup ปัจจุบันได้ครบ
- **gitch น่าศึกษา rule matching และประสบการณ์ป้องกันใช้ตัวตนผิด** ต้องตรวจ Windows behavior และผลกระทบของ shell/hook integration ก่อนเลือกใช้
- ยังไม่พบหลักฐานจากชุดที่คัดกรองว่าโครงการใดครอบคลุม inspector ที่อธิบาย system/global/local/worktree, conditional includes, external edits และ granular Undo ครบตามข้อเสนอของ Whichcraft
- ขั้นถัดไปหากจะนำโค้ดมาใช้จริง: pin commit, อ่าน implementation และ LICENSE ของ revision นั้น แล้วลองกับ fixture ที่เลียนแบบ config ของผู้ใช้ โดยไม่ทดลองเขียนลง home จริง

ฝั่ง SSH GUI/TUI และ parser อยู่ใน [SSH community notes](../ssh/community.md)
