# Git config / SSH — เปรียบเทียบส่วนประกอบที่นำมาใช้ได้

ตรวจ 3 พฤศจิกายน 2026 (Asia/Bangkok) จากเอกสารและ source ของเจ้าของโครงการ ไม่ติดตั้ง library และไม่รัน config ของผู้ใช้ เครื่องหมาย **?** หมายถึงยังไม่ยืนยัน ไม่ใช่ไม่มีความสามารถ

## ข้อสรุปสำหรับ Whichcraft

ข้อเสนอจากหลักฐานด้านล่าง: ใช้ **Git executable ที่กำลังตรวจเป็นผู้ resolve Git config** โดยเฉพาะกฎ `hasconfig:remote.*.url` ที่ผู้ใช้มีอยู่ แล้วประเมิน **gix-config สำหรับแก้ไฟล์จริงแบบเจาะจง**; ฝั่ง SSH ให้ประเมิน **soulteary/ssh-config v3** หรือแนวทาง CST ของมันสำหรับ editor ส่วนตัวเลือก Rust แบบ typed parser ไม่ควรใช้ serialize ทับไฟล์ผู้ใช้โดยยังไม่พิสูจน์การรักษารูปแบบ

## ตารางความสามารถ

| ส่วนประกอบ | API / license | อ่านและ resolve | การเขียนและรักษารูปแบบ | Include / Match และ key หลายค่า | ที่เหมาะนำมาใช้ / สิ่งที่ยังขาด |
| --- | --- | --- | --- | --- | --- |
| [gix-config](https://docs.rs/gix-config/latest/gix_config/) 0.62.2 | Rust; MIT/Apache-2.0 ตาม crate metadata | Git config หลาย source; metadata มี path/source/include depth; มี conditional include | `write_to` ระบุ **mostly lossless**; มีแก้ค่าเดี่ยว/หลายค่าและ detect newline | รองรับ `includeIf` รวม remote `hasconfig` แต่เอกสารระบุความต่างจาก Git บางกรณี | ใกล้ Rust backend ที่สุดสำหรับ physical-file editor; ไม่ควรยืนยันว่า resolver เท่ากับ Git ทุกกรณี |
| [git2-rs](https://docs.rs/git2/latest/git2/struct.Config.html) 0.21.0 / libgit2 | Rust bindings + C; crate MIT/Apache-2.0; license ของ libgit2 ต้องตรวจแยก | อ่าน default/global/local/level, multivar; Rust entry มี level/include depth | มี set/remove/multivar/snapshot; ยังไม่ยืนยัน byte-preserving round trip | libgit2 source ที่ตรวจมี handler gitdir/gitdir-i/onbranch; **ไม่พบ remote hasconfig handler** | ไม่ใช่ตัวเลือกหลักเพื่อ resolve setup Bitbucket นี้; Rust entry ยังไม่ expose origin_path เหมือน C API |
| [soulteary/ssh-config](https://github.com/soulteary/ssh-config) v3 | Go library + CLI JSON/YAML; **Apache-2.0 อ่าน LICENSE แล้ว**; build กำหนด Windows | CST ตาม physical line; มี diagnostics/source spans และ Include graph; **ไม่ evaluate Host/Match** | คัดลอก source bytes ของ node ที่ไม่เปลี่ยน; แก้หนึ่ง directive กระทบหนึ่งบรรทัด; atomic writer | เก็บ repeated/unknown directives และ Match เป็น syntax; graph ตาม Include แยกจากการ resolve host; parser ไม่รัน Match exec | เหมาะ editor/transport หรือ sidecar; ต้องเพิ่ม UI, semantic explanation, conflict check และ Undo |
| [cyjake/ssh-config](https://github.com/cyjake/ssh-config) (npm `ssh-config`, เดิม dotnil) | TypeScript/Node; **MIT อ่าน LICENSE แล้ว** | parse/stringify/find/compute; รองรับ Host และ Match | README ระบุรักษา whitespace/comments; source เก็บโครงบรรทัด; CRLF guarantee ยังไม่ยืนยัน | compute สะสม IdentityFile/forwardings; **รัน Match exec โดยปริยาย** ปิดได้ด้วย `matchExec:false`; การ follow Include ยังไม่ยืนยัน | ใกล้ภาษา frontend แต่ source import node:child_process/os จึงต้องประเมิน runtime/port สำหรับ Tauri WebView |
| [veeso/ssh2-config](https://github.com/veeso/ssh2-config) 0.9.0 | Rust typed parser/query/serializer; **MIT อ่าน LICENSE แล้ว** | query host, Include และ options ที่รู้จัก;มี default-file API บน Windows ตาม changelog | มี serializer; ไม่พบหลักฐานรักษา comments/spacing/CRLF ครบ | README ยังระบุ **Match และ tokens เป็น missing features**; Include scope มี regression fixes; typed options ไม่เท่ากับ source document | เหมาะอ่าน subset เพื่อ connection feature; ยังไม่เหมาะเป็น full fidelity editor หรือ authoritative resolver |
| [kevinburke/ssh_config](https://github.com/kevinburke/ssh_config) | Go API; อ่าน [LICENSE](https://github.com/kevinburke/ssh_config/blob/master/LICENSE) แล้ว มี MIT-style permission และ notices อื่นในไฟล์ | Host lookup, Include nodes, defaults และ `GetAll` สำหรับ IdentityFile | ตั้งใจรักษา comments และแก้ nodes ก่อน stringify | README ระบุ **ไม่รองรับ Match** | แหล่งศึกษา AST/editing ที่ใช้มานาน; ไม่ใช่ Rust dependency และไม่ครอบคลุม config ทุกกรณี |

แหล่งข้อมูลตาราง: [gix File API](https://docs.rs/gix-config/latest/gix_config/struct.File.html), [gix Metadata](https://docs.rs/gix-config/latest/gix_config/file/struct.Metadata.html), [git2 ConfigEntry](https://docs.rs/git2/latest/git2/struct.ConfigEntry.html), README/source ของแต่ละโครงการตามลิงก์ในแถว ทั้งหมดเป็น library/CLI ไม่ใช่ GUI ที่ใช้แทน Whichcraft ได้ทันที และยังไม่มีผลทดสอบ binary บน Windows ของเราจากงานนี้

## ประเด็นที่ตรวจถึง implementation

### 1. gix-config ช่วยเรื่อง source และการแก้ แต่มี semantic deviation

เอกสาร `resolve_includes` ระบุว่าใส่เนื้อหาที่ include หลัง section แทนหลัง directive และไม่ปฏิเสธ remote URL ในไฟล์ที่ถูก include ผ่าน `hasconfig` เหมือน Git จึงยังต้องมี fixture เทียบกับ Git จริงก่อนนำผลมาอธิบายว่า effective เหมือนกันทุกกรณี การ serialize ควรใช้ byte API ไม่ใช่ `to_string()` เพราะเอกสารเตือนเรื่อง losslessness [File::resolve_includes / write_to](https://docs.rs/gix-config/latest/gix_config/struct.File.html#method.resolve_includes)

Metadata ของแต่ละ section เก็บ path, source และระดับ include ซึ่งตรงกับ inspector ที่ต้องบอกแหล่งที่มา อย่างไรก็ตามไม่ควรเขียน merged config ที่ขยาย includes กลับเป็นไฟล์เดียว ให้เปิด physical file แบบไม่ expand เพื่อแก้เป้าหมาย [Metadata](https://docs.rs/gix-config/latest/gix_config/file/struct.Metadata.html), [gix FileTransaction](https://docs.rs/gix/latest/gix/config/struct.FileTransaction.html)

### 2. libgit2 มีช่องว่างตรงกับ config เครื่องนี้

อ่าน [libgit2 config_file.c บน main](https://github.com/libgit2/libgit2/blob/main/src/libgit2/config_file.c#L726) โดยตรง: ตาราง conditional handlers มี `gitdir:`, `gitdir/i:` และ `onbranch:` เท่านั้นใน source ที่ได้ จึงไม่ควรถือว่า remote `hasconfig` ใช้ได้จากคำว่า “supports includes” ส่วน [Rust binding](https://github.com/rust-lang/git2-rs/blob/master/src/config.rs#L581) มี entry level/include_depth แต่ไม่พบ method origin_path; [C API](https://libgit2.org/docs/reference/main/config/git_config_entry.html) มี origin_path อยู่แล้ว นี่เป็นข้อจำกัด binding ที่ต้องประเมินเพิ่ม ไม่ใช่ข้อจำกัดของ C struct

Source สองลิงก์นี้ตรวจจาก branch ณ วันที่ข้างต้น ไม่ได้ pin commit เพราะ GitHub API ถูก rate limit ระหว่างงาน ไม่ถือว่าผล main เท่ากับ libgit2 version ที่ dependency lock ของ Whichcraft จะเลือก

### 3. soulteary v3 มีส่วน editor ที่เป็นรูปธรรมที่สุดในชุดนี้

อ่าน source ที่ pin **`71a19e21ec248d4622260db70bcd138355c0b4e6`**:

- [writer.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/writer.go): `MarshalPreserve` copy source spans ของ node ที่ไม่เปลี่ยน; `SaveAtomic` ใช้ temp ใน directory เดียว, sync, rename, เก็บ mode เมื่อสั่ง และปฏิเสธ symlink destination แต่ **ไม่เห็นการเทียบ content กับต้นฉบับก่อนทับ** ใน writer นี้ จึงยังต้องทำ external-edit conflict detection และ granular Undo ในแอป
- [edit.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/edit.go): replace/remove/insert เป็น node ID; เก็บ indentation/comment/line ending ของ directive เดิม ไม่ลบ repeated keys ตัวอื่น และ reject newline/NUL injection ใน input
- [include.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/include.go): เก็บ physical documents, edges และ traversal order; จำกัดขนาด/จำนวน/ความลึกได้ ไม่มี host-context evaluator ใน traversal นี้ จึงเป็น graph ของไฟล์อ้างอิง ไม่ใช่คำตอบว่า include ใด active สำหรับ host
- [schema v3](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/docs/lossless-schema-v3.md): raw bytes อยู่ใน Base64 เพื่อขนผ่าน JSON/YAML; บรรทัดที่แก้อาจ normalize spacing ภายในบรรทัดแต่ไม่ reformat บรรทัดอื่น Parser ไม่ evaluate Host/Match/exec

ตรวจ [LICENSE](https://github.com/soulteary/ssh-config/blob/main/LICENSE) ว่า Apache-2.0 และ [.goreleaser.yaml](https://github.com/soulteary/ssh-config/blob/main/.goreleaser.yaml) มี Windows target แล้ว ยังไม่ได้ทดสอบว่า atomic replacement/permissions ให้ผลตามที่ต้องการบน NTFS ทุกกรณี

### 4. TypeScript ssh-config ใช้ง่าย แต่ default compute มีผลข้างเคียง

อ่าน [src/ssh-config.ts](https://github.com/cyjake/ssh-config/blob/master/src/ssh-config.ts) โดยตรง: import `spawnSync`, options default คือ `matchExec !== false`; case exec เรียก matcher เฉพาะเมื่อเปิด option และ repeatable directives รวม IdentityFile/LocalForward/RemoteForward ตรงกับ [README Match Exec](https://github.com/cyjake/ssh-config#match-exec) จึงต้องแยก parse/edit ออกจาก compute และปิด exec สำหรับ inventory การปิด exec ทำให้ผลบาง Match “ยังประเมินไม่ได้” ไม่ควรบอกว่าเป็น effective SSH configuration ครบถ้วน

## วิธีเลือกโดยผูกกับเคสเครื่องนี้

| เคส | วิธีที่ควรพิสูจน์ | ตัวเลือกที่เริ่มประเมิน |
| --- | --- | --- |
| Bitbucket remote โหลดอีเมลงานผ่าน `hasconfig` | เทียบค่าพร้อม origin กับ Git ตัวที่ใช้อยู่ ทั้ง SSH/HTTPS remotes | Git CLI เป็น oracle; gix candidate; ไม่เริ่มด้วย libgit2 resolver |
| เปลี่ยน Git email เพียงหนึ่งค่าโดยเก็บ include/comment | เปิดเฉพาะไฟล์ต้นทาง แก้หนึ่ง occurrence แล้วตรวจ bytes ของส่วนอื่น | gix-config physical-file API |
| เปลี่ยน IdentityFile ของ Bitbucket โดยเก็บ CRLF และ comment | fixture ที่มี duplicate IdentityFile, unknown options, Include และ Match | soulteary v3 CST; Rust lossless editor จากแอปอีกชุดอาจนำแนวทางมาใช้ได้ |
| แสดง “key นี้ถูกอ้างโดย host ไหน” | static references ก่อน; แยก unresolved Match/Include จาก known mapping | soulteary graph + Whichcraft model ไม่ต้องเชื่อมต่อ server |
| บอกว่า Git จะใช้ SSH ตัวไหนจริง | ตรวจ Git config + process environment + executable resolution แล้วระบุขอบเขต context | Git/OpenSSH process adapters ของ Whichcraft; parser เพียงอย่างเดียวตอบไม่ครบ |

งานนี้ยังไม่เสนอให้เพิ่ม dependency ทันที สิ่งที่ต้องทดลองต่อคือ fixture parity, Windows file replacement/ACLs, symlink handling, error recovery และความต่างระหว่าง branch source กับ binary release ที่เลือกใช้
