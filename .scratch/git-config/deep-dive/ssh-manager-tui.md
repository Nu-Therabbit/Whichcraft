# Deep dive: ssh-manager-tui — source isolation และ Windows probes

วันที่ตรวจ/รัน: 3 พฤศจิกายน 2026

**ผลหลัก:** แยก config subsystem มาคอมไพล์โดยไม่ดึง TUI, vault, SSH client หรือ agent ได้จริง และรัน **49 upstream config tests ผ่านบน Windows** รวม file lifecycle/ReplaceFileW อีก **13 characterization probes ผ่าน** โดยยืนยันทั้งความสามารถและข้อจำกัดที่รายงานไว้ด้านล่าง นี่ยังไม่ใช่ข้อสรุปว่าจะ fork หรือเขียนเอง

## Provenance และขอบเขต

- Upstream: [nakaba-lab/ssh-manager-tui](https://github.com/nakaba-lab/ssh-manager-tui) pin [`ae755cf551b9811e7d4791b5910792b1a986c4ab`](https://github.com/nakaba-lab/ssh-manager-tui/commit/ae755cf551b9811e7d4791b5910792b1a986c4ab) — source นี้ใหม่กว่า release v1.2.0
- ดาวน์โหลด [source archive ของ commit](https://codeload.github.com/nakaba-lab/ssh-manager-tui/zip/ae755cf551b9811e7d4791b5910792b1a986c4ab) ลง unique temp directory; SHA256 archive `84CC93CD44DCD325D591BF309AD7963DD427874E62D3DF305CE09F22920E3D5C`
- Temp root: `C:\Users\Nuniozzz\AppData\Local\Temp\whichcraft-sshm-2215951c22394521867fd2ee7c5a3ed3`
- Source snapshot และ harness อยู่ใน temp เท่านั้น ไม่ได้นำ upstream source เข้า Whichcraft และไม่ได้แก้ source ของ upstream
- ไม่เปิดแอป ไม่รัน SSH/ssh-keygen/ssh-add ไม่เปิด network connection ไป host และไม่อ่านหรือแก้ `~/.ssh/config`, keys หรือ agent ของผู้ใช้ การดาวน์โหลด source เป็น network เดียวของการทดลองนี้
- อ่าน [Cargo.toml](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/Cargo.toml), [CI workflow](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/.github/workflows/ci.yml) และ test bodies ก่อนรัน ไม่มี root build.rs; **ไม่ได้รัน full CI/full app suite** เพราะ workflow ระบุว่าบาง tests เรียก `ssh -G` และ `ssh-keygen` จริง

## ขอบเขตโมดูลและต้นทุนการแยก

Repo เป็น binary crate (`src/main.rs`) ไม่ได้ส่ง config library API แยกออกมา แต่ `src/config/` มีหกไฟล์และไม่มี dependency ต่อ Ratatui [crate manifest](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/Cargo.toml), [entry point](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/main.rs)

| โมดูล/ไฟล์ | API/หน้าที่ที่น่าศึกษา | dependency/coupling ที่พบ |
|---|---|---|
| [model.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/model.rs) | SshConfig, ordered Item/BodyLine, OptionLine, HostView::from_block | std + tokens; raw line parts และ newline metadata อยู่ใน model; SshConfig พก path/dirty/bak_done ไปด้วย |
| [parser.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/parser.rs) | parse(PathBuf, &str) → SshConfig | std + model/tokens; infallible parser เน้นเก็บ syntax ไม่ใช่ validator; ไม่อ่าน Include |
| [tokens.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/tokens.rs) | tokenize_args, detok_value, quote_if_needed | std ล้วน; ไม่มี typed inline-comment node |
| [writer.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/writer.rs) | render, set_single, set_multi, set_extras, save | edit/render เป็น text operations; save รวม fs + ConfigError + secure_fs + Windows ReplaceFileW ในไฟล์เดียว |
| [diff.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/diff.rs) | diff, stats, tagged DiffLine | std ล้วน; normalize line endings ก่อน diff จึงไม่ใช่ byte diff |
| [config/mod.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/mod.rs) | load, host_views, apply_view, add_host, delete_host, default_config_path | CRUD projection ผสม file load/default path; dirs ใช้เฉพาะ convenience function หา home |
| [error.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/error.rs) | ConfigError: NoHome/Validation/DuplicateAlias/Io | thiserror; ไม่มี conflict variant |
| [secure_fs.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/secure_fs.rs) | random temp name, create_new_private, restrict_acl | getrandom; Windows เรียก System32 icacls; API คืนผล ACL แบบ best effort |
| [os/binaries.rs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/os/binaries.rs) | system_directory → GetSystemDirectoryW | secure_fs ใช้ helper นี้ จึงมี coupling ข้ามจาก writer ไป namespace SSH-tools แม้การ save ไม่จำเป็นต้องรู้จัก SSH |

Dependency ที่ harness ต้องใช้จริงมี `dirs`, `getrandom`, `thiserror`, `windows-sys`; ไม่ต้องมี Ratatui/clipboard/serde/vault crypto เพื่อคอมไพล์และทดสอบ config layer นี้

สำหรับ integration สิ่งที่ยังต้องออกแบบคือ type สำหรับ IPC (model เดิมไม่ได้ derive Serialize), การแยก pure edit/render ออกจาก file adapter, stable identity ของรายการแทน item index, conflict baseline, provenance ต่อ included file และ validation/Undo ที่อยู่เหนือ document model เรื่องเหล่านี้เป็นต้นทุนการเชื่อมต่อ ไม่ใช่เหตุผลตัดสิน fork/own ในตอนนี้

## Harness และคำสั่งที่รันจริง

สร้าง Cargo library wrapper ใหม่ใน temp โดยใช้ `#[path = ...]` include **ไฟล์ upstream เดิมโดยตรง**:

```text
config/mod.rs → config/* ทั้งหกไฟล์
error.rs
secure_fs.rs
os/binaries.rs → เฉพาะ module นี้ ไม่มี os/mod.rs
```

Wrapper เปลี่ยนเฉพาะขอบเขต crate สำหรับทดลอง ไม่แก้ parser/model/writer โค้ดของแอปไม่ได้ถูกรัน Tests ใน binaries/secure_fs ถูก compile แต่ไม่ได้เลือกมารัน

- Toolchain: `rustc 1.98.1`, `cargo 1.98.1`, native Windows/MSVC
- Harness dependency resolution แบบ offline: dirs 6.0.0, getrandom 0.2.17, thiserror 2.0.21, windows-sys 0.60.2
- นี่ไม่ใช่ dependency lock เดิมทั้งแอป: upstream lock ใช้ thiserror 2.0.18; harness ใช้ cached 2.0.21 ตาม compatible requirement ไม่มีการดาวน์โหลด dependencies
- คำสั่งจริงใช้ manifest path เต็มของ temp harness:

```powershell
cargo test --offline --manifest-path C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-sshm-2215951c22394521867fd2ee7c5a3ed3/config-harness/Cargo.toml config:: -- --test-threads=1
cargo test --offline --manifest-path C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-sshm-2215951c22394521867fd2ee7c5a3ed3/config-harness/Cargo.toml probes:: -- --test-threads=1 --nocapture
```

| ชุด | ผลจริง | ความหมาย/ขอบเขต |
|---|---|---|
| Upstream config tests ใน sandbox | 46 ผ่าน / 3 file-save tests ไม่ผ่าน Access denied | owner-only ACL ทำให้ restricted token เข้า temp file หลัง tighten ไม่ได้ เป็นข้อจำกัดของ test environment นี้ |
| คำสั่งเดิม นอก sandbox หลัง review | **49 ผ่าน / 0 ล้มเหลว / 4 filtered out** | pure parser/model/tokens/diff และ Windows create/overwrite lifecycle ผ่าน; ไม่ใช่ full upstream suite |
| Controlled probes ใน temp นอก sandbox | **13 ผ่าน / 0 ล้มเหลว / 53 filtered out** | characterization ยืนยันพฤติกรรมที่คาดจากโค้ด รวมพฤติกรรมที่เรายังไม่ต้องการใน Whichcraft |

Fixtures ใช้ explicit path ใต้ temp harness หรือ unique `std::env::temp_dir()` ของ upstream tests ไม่มีการเปลี่ยน HOME หรือใช้ default_config_path Tests save เรียก icacls เฉพาะ temp fixture เพื่อทำงานแบบ Windows จริง

## ผลทดลองใหม่ — เกินกว่าการอ่าน README/static code

| Probe | ผลที่วัดได้ | ผลต่อความเข้าใจ |
|---|---|---|
| Uniform CRLF + tabs/equals + เปลี่ยน Port | รักษาบรรทัดอื่นครบ | surgical edit ทำงานได้ในกรณีพื้นฐาน |
| BOM โดยยังไม่แก้ข้อมูล | BOM หายหลัง parse/render | คำว่า lossless มีข้อยกเว้นโดยเจตนา |
| Mixed LF/CRLF | render ใช้ CRLF ทุกบรรทัด และ diff stats เป็น **0 เพิ่ม/0 ลบ** | preview แบบ content diff ไม่แสดง newline normalization |
| IdentityFile สองรายการ | เก็บทั้งสองตามลำดับ; เปลี่ยนตัวที่สองโดยรักษา spacing/case ตัวแรก | multi-value model ใช้งานจริง |
| Full-line comments + unknown repeated options | รักษาครบเมื่อแก้ User | ordered document model มีประโยชน์ต่อไฟล์ที่ผู้ใช้ดูแลเอง |
| Inline comment ของ field ที่แก้ | User projection รวม `# explanatory note` เป็นส่วนของค่า; ตั้ง User ใหม่แล้ว comment หาย | เก็บ physical line ได้ แต่ยังไม่ได้แยก comment ออกจาก editable value |
| User ซ้ำสองบรรทัด แล้วเปลี่ยนเฉพาะ Port | User บรรทัดที่สองถูกลบ | “เปลี่ยนเฉพาะ field ที่เลือก” ไม่เป็นจริงสำหรับ duplicate scalar ใน block เดียวกัน |
| Include ชี้ไฟล์ fixture ที่มี host จริง | เก็บ directive แต่ host ในไฟล์ลูกไม่ปรากฏใน host_views และไฟล์ลูกไม่เปลี่ยน | include preservation ผ่าน แต่ include inventory ยังไม่มี |
| Match exec พร้อม marker path | block รักษาเดิม, ไม่มี marker เกิดขึ้น | static parser ไม่เรียก exec; **ไม่ได้**ทดสอบ ssh -G/connection flow |
| External edit หลัง load ก่อน save ครั้งแรก | save สำเร็จและเขียนทับ external edits; `.bak` เก็บ disk เวอร์ชัน external | ไม่มี stale-write conflict rejection แต่ backup ครั้งแรกช่วยเก็บเวอร์ชันก่อนเขียน |
| External edit หลัง save ครั้งแรก แล้ว save อีกครั้ง | external edits หายทั้งจาก config และ `.bak` ซึ่งยังเป็นต้นฉบับก่อน save แรก | one-time backup ไม่แทน granular Undo หรือ external-edit protection |
| Host * มี User และ Host demo ไม่มี User | projection ของ demo คืน User=None | host_views เป็น view ของ block ไม่ใช่ effective resolution/inheritance |
| เรียก apply_view ด้วย Port=999999 | ไม่คืน error และ render ค่าออกมา | domain edit API ไม่รับผิดชอบ SSH syntax validation; app form validation เป็นอีกชั้น |

คำว่า “13 ผ่าน” หมายถึง assert ตรงกับพฤติกรรมที่สังเกต ไม่ได้หมายความว่าทั้ง 13 ข้อนี้ผ่านเกณฑ์ผลิตภัณฑ์ของ Whichcraft

ไฟล์ [probes.rs ใน temp harness](/C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-sshm-2215951c22394521867fd2ee7c5a3ed3/config-harness/probes.rs) และ [lib.rs wrapper](/C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-sshm-2215951c22394521867fd2ee7c5a3ed3/config-harness/lib.rs) เก็บไว้เพื่อดูรายละเอียด แต่เป็น temporary artifacts ที่อาจถูกระบบล้างภายหลัง

## Windows writer: สิ่งที่รันกับสิ่งที่อ่านอย่างเดียว

**รันจริงบน Windows:** fresh-path save, add→save→reload→edit→save→delete lifecycle และ overwrite ที่ใช้ ReplaceFileW พร้อมตรวจว่า config และ `.bak` มีข้อความตามคาด รวม fixture stale-write สองกรณีด้านบน [upstream tests](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/mod.rs#L331)

**ยังเป็น source inspection:** ACL owner-only invariant, failure/crash durability, Windows concurrent writers และผลของ ACL tightening failure ไม่ได้ assert บน Windows ในชุดนี้ ชื่อ test `save_overwrite_creates_owner_only_bak_and_swaps` มี permission assertion อยู่ใต้ `#[cfg(unix)]` จึงไม่ควรสรุปจากชื่อ test ว่า Windows ACL ผ่านแล้ว `restrict_acl` คืน `()` และ ignore process result; `fsync_parent_dir` บน Windows เป็น no-op [writer](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/writer.rs#L57), [secure_fs](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/secure_fs.rs#L63)

## ขอบเขต validation และการประสานงานที่ยังต้องศึกษา

- `parse` ไม่ใช่ OpenSSH validator; API คืน SshConfig โดยตรง ไม่มี Result สำหรับ syntax error การตรวจ form อยู่ใน app/update แยกจาก config crate ซึ่ง harness นี้ไม่ได้ใช้ [parser](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/parser.rs#L20), [save_form](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/update.rs#L1288)
- `SshConfig::apply_view` รับ item index; source line เป็นตำแหน่งตอน parse ไม่ใช่ identity ที่อยู่รอดข้าม reload/insert/merge จึงต้องมีวิธีอ้างรายการสำหรับ pending plan/Undo ของ Whichcraft
- `bak_done` อยู่ใน model และ parser ตั้ง false ทุกครั้งที่ load ใหม่ จึงผูก backup lifetime กับ model instance ไม่ใช่ประวัติถาวรของ operations
- ฟังก์ชัน diff ไม่ได้ carry expected file version/hash ไปให้ writer และ ConfigError ไม่มี conflict variant การทดลองยืนยันผลของช่องว่างนี้แล้ว
- Include provenance/condition evaluation ยังไม่มีใน layer นี้ ส่วน Match exec gate ใน application ไม่ได้อยู่ใน pure parser และยังมีคำถามเรื่องไฟล์ลูก; ไม่ได้รัน flow นั้นในรอบนี้
- ต้องแยกคำถาม “รักษาไฟล์เดิมได้แค่ไหน” จาก “แสดงค่าที่ OpenSSH/Git ใช้จริงได้แค่ไหน” หลักฐานรอบนี้ตอบข้อแรกได้มากขึ้น แต่ไม่พิสูจน์ข้อหลัง

## คำถามเปิดก่อนตัดสินแนวทาง implementation

1. จะรักษา BOM/mixed newlines/inline comments รวมถึง duplicate scalar แบบ verbatim หรือจะยอม normalize พร้อม preview ระดับ bytes?
2. จะให้ edit unit เป็น physical directive ที่มี file identity/source span หรือ HostView ทั้ง block? ผลต่อ diff/Undo และ key ที่ซ้ำต่างกันมาก
3. จะออกแบบ baseline และ compare-before-write อย่างไรให้ครอบคลุมช่วง load→preview→apply และ multi-file Include โดยยังไม่ทับ external edits?
4. จะย้าย file save/backup/ACL เข้า Whichcraft adapter และใช้ journal/operation coordinator ของแอปอย่างไร?
5. จะเก็บ unknown/unsupported directives แล้วบอกระดับความมั่นใจในการ resolve อย่างไร โดยไม่ทำให้ static inspection เรียก Match exec?

ยังไม่สรุปว่าจะ fork, extract, port หรือเขียนเอง เอกสารนี้แยกหลักฐานเรื่องความสามารถ โครงสร้าง และพฤติกรรมที่ทดลองได้ไว้สำหรับการตัดสินขั้นถัดไป
