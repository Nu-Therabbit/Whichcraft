# SSH apps: เปรียบเทียบเชิง implementation

ตรวจวันที่ 3 พฤศจิกายน 2026 เพิ่มจาก [community.md](community.md) โดยอ่าน source ของ parser/writer/คำสั่ง/frontend ในสองตัวที่ตรงโจทย์ที่สุด ไม่ได้ติดตั้ง รัน หรือทดสอบกับ config ส่วนตัว เครื่องหมาย **✓** = พบหลักฐาน, **จำกัด** = พบแต่มีข้อจำกัด, **?** = ยังไม่มีหลักฐานพอ ไม่ได้แปลว่าไม่มี

## รุ่นและหลักฐานที่ตรึงไว้

| แอป | Source ที่ตรวจ / release | Windows / stack / license |
|---|---|---|
| SSH-AT | commit `4daae39288bb90d2b53f75257580a385e12f6709` 2 ก.ค. 2026; [v0.1.1](https://github.com/baerwang/ssh-at/releases/tag/v0.1.1) 2 ก.ค. 2026 | พบ assets `.exe` และ `.msi`, [workflow Windows](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/.github/workflows/release.yml); Tauri 2 + React 19/MUI + Rust; อ่านตัวบท [Apache-2.0](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/LICENSE) แล้ว |
| ssh-manager-tui / sshm | commit `ae755cf551b9811e7d4791b5910792b1a986c4ab` 14 ก.ค. 2026; [v1.2.0](https://github.com/nakaba-lab/ssh-manager-tui/releases/tag/v1.2.0) 29 มิ.ย. 2026; **source ที่ตรวจใหม่กว่า release** | พบ Windows MSVC `.zip`; Rust/Ratatui; [Cargo](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/Cargo.toml) ระบุ `MIT OR Apache-2.0`; อ่าน [MIT](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/LICENSE-MIT) และ [Apache](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/LICENSE-APACHE) แล้ว |
| OmnySSH | commit `06caf7e2391a9477c8fdfee3c61c5271b0c08e9c`; [v1.1.5](https://github.com/timhartmann7/omnyssh/releases/tag/v1.1.5) 9 ต.ค. 2026 | พบ Windows GUI setup `.exe` และ TUI MSVC `.zip`; Rust workspace, GUI/TUI; อ่าน [Apache-2.0](https://github.com/timhartmann7/omnyssh/blob/06caf7e2391a9477c8fdfee3c61c5271b0c08e9c/LICENSE) แล้ว; ยังไม่ยืนยัน frontend framework จาก package source |
| Reach | commit `31fd15e114fde6d9835e5c9a28173a50acba57f1`; [v0.8.8](https://github.com/alexandrosnt/Reach/releases/tag/v0.8.8) หน้า release แสดง 1 พ.ย. | [README](https://github.com/alexandrosnt/Reach/blob/31fd15e114fde6d9835e5c9a28173a50acba57f1/README.md) ระบุ Windows `.exe/.msi`, Tauri 2 + Svelte 5 + Rust/russh; อ่านตัวบท [MIT](https://github.com/alexandrosnt/Reach/blob/31fd15e114fde6d9835e5c9a28173a50acba57f1/LICENSE) แล้ว; ยังไม่ได้ตรวจรายการ assets ผ่าน API เพราะ rate limit |

Release/assets ของสามตัวแรกตรวจจาก GitHub API สาธารณะ ไม่ได้ใช้วันที่ crawl เป็นวันที่ release และไม่มีการใช้จำนวนดาวเป็นหลักฐานคุณภาพ

## Matrix ตามงานที่ Whichcraft ต้องทำ

| ความสามารถ | SSH-AT | ssh-manager-tui | OmnySSH | Reach | หลักฐาน |
|---|---|---|---|---|---|
| ทำงานกับ `~/.ssh/config` จริง | ✓ อ่าน/เขียน | ✓ อ่าน/เขียน | อ่านตอนเริ่ม; README ระบุไม่เขียนไฟล์นี้ | README ระบุรองรับ config; การเขียนกลับ ? | [A1], [M1], [O1], [R1] |
| แก้ Host แบบฟอร์ม | ✓ | ✓ พร้อม extra options | จัดการ hosts ของแอป; ไม่ใช่ editor ไฟล์เดิม | จัดการ sessions; editor ไฟล์เดิม ? | [A1], [A3], [M1], [O1], [R1] |
| Raw text editor | Monaco แต่เนื้อหาผ่าน model/serializer | ? ไม่ใช่เป้าหมายหลัก | ? | ? | [A4], [M1], [O1], [R1] |
| Comments/ช่องว่าง/keyword case/order | **ไม่รักษา** parser ตัด comments/blank; writer จัดใหม่ | รักษาโครงบรรทัดส่วนที่ไม่แก้; มีข้อยกเว้นด้านล่าง | ไม่เขียนไฟล์เดิม | ? | [A1], [A2], [M2], [M3] |
| CRLF / BOM | writer ออก LF; BOM ? | รักษา CRLF แบบเดียวทั้งไฟล์; BOM ถูกตัด, mixed endings ถูก normalize | ไม่เขียนไฟล์เดิม | ? | [A1], [M2], [M3] |
| Unknown/repeated directives | extras เป็น HashMap: ชื่อซ้ำทับกัน, ลำดับไม่คงเดิม | เก็บบรรทัดและ extras แบบ ordered list | ? ด้าน interpretation | README อ้าง 104 keywords; ยังไม่ audit parser | [A2], [M4], [R1] |
| หลาย `IdentityFile` | scalar จึงเหลือตัวหลัง | ✓ vector + set_multi | ? | ? | [A2], [M3], [M4] |
| Include | อ่านไฟล์ที่ exists แล้ว flatten ภายหลัง ไม่ตรง insertion semantics | เก็บ directive แต่ไม่ enumerate hosts จากไฟล์ลูกใน config model | README ระบุใช้ config/ProxyJump; Include ? | รองรับ config ตาม README; Include fidelity ? | [A2], [M4], [O1], [R1] |
| Match / Match exec | ไม่แยกเป็น block; กลายเป็น option ของ scope เดิม | เก็บ block แบบ opaque; ไม่ประเมินใน static editor; มี pre-scan ก่อน `ssh -G` บาง flow | ? | ? ไม่ถือว่าคำว่า all config พิสูจน์เรื่องนี้ | [A2], [M2], [M5] |
| Preview ก่อนเขียน | Save ตรง ไม่พบ diff ใน flow ที่ตรวจ | ✓ form add/edit มี diff; shortcut บางทาง save ตรง | ไม่แก้ไฟล์เดิม | ? | [A4], [M6] |
| Backup/restore | ✓ timestamped whole-file backup/restore | one-time `config.bak` ต่อ session | server backup ใน flow ติดตั้ง key; ไม่ใช่ config Undo | sessions/settings backup ตาม README | [A5], [M3], [O1], [R1] |
| Granular Undo / ตรวจ external edit | ไม่พบใน writer ที่ตรวจ | ไม่พบ granular Undo; reread disk ตอน preview แต่ commit ไม่ตรวจซ้ำ | ไม่แก้ไฟล์เดิม; session Undo ? | ? | [A1], [M3], [M6] |
| Key generation/fingerprint/copy | ✓ RSA/Ed25519/ECDSA และอื่น ๆ ตาม enum; `.ssh-at/creds` | ✓ key manager; generate ผ่าน ssh-keygen | ✓ one-click key setup รวมแก้ remote authorized_keys/sshd config | vault/keys/FIDO2 ตาม README; key-generation flow ? | [A6], [M7], [O1], [R1] |
| Agent/known_hosts/test | agent UI/known_hosts/test ? | known_hosts viewer/remove; TCP reachability; agent load/unload ? | agent ตาม README เฉพาะ macOS/Linux; key setup ทดสอบ connection | README ระบุ host-key trust UI และ pure-Rust SSH; Windows agent integration ? | [M8], [M1], [O1], [R1] |

Matrix สองคอลัมน์แรกมีการอ่าน implementation ส่วน OmnySSH/Reach ยังเป็นระดับเอกสารและ metadata เว้นแต่ระบุเป็นอย่างอื่น จึงไม่ใช้เป็นข้อสรุปว่ารองรับ semantics ของ OpenSSH ครบ

## ผล audit ที่เปลี่ยนคำแนะนำ

### SSH-AT: stack ตรง แต่ writer ยังไม่เหมาะกับ config ซับซ้อน

- `simple_parser` คือเส้นทางที่ Tauri เรียกจริง ไม่ใช่แค่ parser ทางเลือกใน repo: ตัด full-line comments/blank, แยกด้วย whitespace, เก็บ options แบบ scalar/HashMap [A2], [A3]
- Include ถูกอ่านแยกและนำ host/global options มารวมท้าย model ส่วน Include directive ไม่ถูกเก็บไว้ใน model เพื่อ serialize ดังนั้นบันทึกกลับอาจย้ายค่าจากไฟล์ลูกลงไฟล์หลักและทำโครงสร้าง include หาย นี่เป็นข้อสรุปจากโค้ด ไม่ใช่ผลทดลอง [A1], [A2]
- `Match` ไม่ใช่ structural branch ของ parser; การเขียนกลับอาจจัดลำดับ options รอบ Match เปลี่ยนความหมาย ส่วน `IdentityFile` และ forward ที่เกิดซ้ำก็เหลือตัวหลัง [A1], [A2]
- Monaco ไม่ใช่ทางหลบปัญหา: ตอนเปิดใช้ serialize(model) และตอน Save ใช้ parse(text) → save(model) → serialize อีกครั้ง; editor ตั้ง language เป็น `plaintext` แม้ README จะใช้คำว่า syntax highlighting [A4]
- Form validation บังคับ HostName, User และไฟล์ IdentityFile ที่มีอยู่ จึงเข้มกว่ารูปแบบ OpenSSH ที่ถูกต้องหลายกรณี เช่น alias ที่รับค่า User/identity จาก block อื่น หรือใช้ agent เพียงอย่างเดียว [A3]
- `save_config` backup แล้วใช้ไฟล์ชื่อคงที่ `.tmp` + rename; ไม่พบ compare-with-original/lock ในเส้นทางที่อ่าน และ restore คืนทั้งไฟล์ การมี hash ใน backup metadata ไม่ใช่การตรวจ conflict [A1], [A5]

**ข้อเสนอ:** ใช้ดูหน้าจอและการแยก crate/Tauri commands ได้ แต่ไม่ดึง writer นี้มาจัดการ config ของผู้ใช้โดยตรง

### ssh-manager-tui: ตัวอย่าง editor/backend ที่น่าสนใจกว่า แต่ยังมีช่องว่าง

- Model เก็บ raw line parts และ source line; มี setter แยก single/multi option จึงรักษา comment, case และบรรทัดที่ไม่แก้ได้มากกว่า SSH-AT [M3], [M4]
- คำว่า lossless มีขอบเขต: parser ตัด BOM โดยเจตนา; ถ้าพบ CRLF อย่างน้อยหนึ่งแห่ง writer ใช้ CRLF ทั้งไฟล์ การแก้ single option จะลบ duplicates หลังตัวแรกด้วย จึงไม่ใช่การรักษาทุก byte ในทุก input [M2], [M3]
- Include ถูกเก็บไว้แต่ยังไม่อ่านไฟล์ลูก; Match เก็บ opaque เพื่อไม่ทำ semantics หาย แต่ไม่ใช่ effective-config inspector [M2], [M4]
- Windows save ใช้ temp ชื่อสุ่ม/create-new, fsync และ `ReplaceFileW`; backup แบบ `config.bak` หนึ่งครั้งต่อ session แยกจาก granular Undo [M3]
- Add/edit form มี preview จากไฟล์ปัจจุบันบน disk เทียบกับ clone ของ model ที่โหลดไว้ แต่ commit ไม่เทียบ disk อีกครั้ง การแก้จากแอปอื่นก่อน preview อาจถูกแสดงเป็น diff ที่จะเขียนทับ และการแก้หลัง preview ยังไม่มี guard นี้ ขณะ set-key shortcut/delete มีเส้นทาง save ตรง [M6]
- มี `has_match_exec` ก่อน resolve บาง flow แต่ input คือ `app.config.render()` ซึ่งไม่รวมไฟล์ Include จึงไม่ควรอ้างว่าป้องกันการประเมิน exec ในไฟล์ลูกได้ครบ [M5], [M6]
- known_hosts removal ใช้เนื้อหาบรรทัดตรวจว่ารายการยังตรงอยู่ ช่วยป้องกันลบผิดแถว แต่ไม่ใช่ atomic compare-and-swap ทั้งไฟล์ [M8]

**ข้อเสนอ:** เป็นแหล่งศึกษาหลักสำหรับ Rust document model และ Windows writer โดยต้องเพิ่ม include provenance, effective resolution, baseline conflict check และ Undo ตามรายการของ Whichcraft

### OmnySSH / Reach: ใช้ศึกษา SSH client มากกว่า config editor

- OmnySSH ระบุชัดว่าอ่าน config เดิมแล้วไม่เขียนกลับ จึงมีประโยชน์กับ host/session management แต่ไม่ได้แก้โจทย์เปลี่ยน config ให้ Git/terminal ตัวอื่นใช้ร่วมกัน [O1]
- One-click key setup ของ OmnySSH มีขอบเขตกว้างถึง remote authorized_keys และปิด password login หลังทดสอบ key สำเร็จ; เป็น flow คนละระดับกับ local key inventory ที่เราเสนอ [O1]
- Reach ใช้ russh ไม่พึ่ง OpenSSH executable จึงควรแยกการรองรับ keywords ของ client ออกจากผลที่ Git ซึ่งเรียก Windows/Git OpenSSH จะได้จริง ยังไม่ยืนยัน lossless writer, include provenance หรือ granular Undo จาก source ของ Reach ในรอบนี้ [R1]

## จุดอ้างอิง source

- [A1: SSH-AT CRUD/serializer](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/config/crud.rs)
- [A2: SSH-AT active parser](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/config/simple_parser.rs), [model](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/config/mod.rs)
- [A3: Tauri config commands / validation](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src-tauri/src/commands/config.rs)
- [A4: Monaco load/save flow](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src/pages/ConfigEditorPage.tsx)
- [A5: backup/restore](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-storage/src/backup.rs)
- [A6: key generator](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/keys/generator.rs), [key commands](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src-tauri/src/commands/keys.rs)
- [M1: sshm README](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/README.md)
- [M2: parser](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/parser.rs)
- [M3: writer](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/writer.rs)
- [M4: model](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/model.rs), [config operations](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/mod.rs)
- [M5: effective resolution / Match exec scan](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/os/resolve.rs)
- [M6: application save/preview/connect flow](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/update.rs#L1288)
- [M7: keys](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/os/keys.rs)
- [M8: known_hosts](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/os/known_hosts.rs)
- [O1: OmnySSH README at reviewed release](https://github.com/timhartmann7/omnyssh/blob/06caf7e2391a9477c8fdfee3c61c5271b0c08e9c/README.md)
- [R1: Reach README at reviewed commit](https://github.com/alexandrosnt/Reach/blob/31fd15e114fde6d9835e5c9a28173a50acba57f1/README.md)

[A1]: https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/config/crud.rs
[A2]: https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/config/simple_parser.rs
[A3]: https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src-tauri/src/commands/config.rs
[A4]: https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src/pages/ConfigEditorPage.tsx
[A5]: https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-storage/src/backup.rs
[A6]: https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src-tauri/src/commands/keys.rs
[M1]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/README.md
[M2]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/parser.rs
[M3]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/writer.rs
[M4]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/model.rs
[M5]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/os/resolve.rs
[M6]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/update.rs
[M7]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/os/keys.rs
[M8]: https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/os/known_hosts.rs
[O1]: https://github.com/timhartmann7/omnyssh/blob/06caf7e2391a9477c8fdfee3c61c5271b0c08e9c/README.md
[R1]: https://github.com/alexandrosnt/Reach/blob/31fd15e114fde6d9835e5c9a28173a50acba57f1/README.md
