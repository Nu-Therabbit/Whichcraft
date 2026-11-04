# SSH-AT — ลงรายละเอียดโมดูลและรัน behavior probes

ตรวจ 3 พฤศจิกายน 2026 (Asia/Bangkok) ตามคำขอให้ศึกษาห้าตัวก่อนตัดสิน fork หรือเขียนเอง รายงานนี้ไม่ตัดสินแนวทางนั้น

## Revision และขอบเขต

- [baerwang/ssh-at](https://github.com/baerwang/ssh-at/tree/4daae39288bb90d2b53f75257580a385e12f6709), pin `4daae39288bb90d2b53f75257580a385e12f6709` / v0.1.1
- ดาวน์โหลด source ZIP จาก codeload ไป temp แยก ไม่ checkout/fork เข้า Whichcraft; archive SHA256 `DAF519FA4A1C827F184E660990CC71AFE14202C0F52D7540A69814B60B831854`
- อ่าน Apache-2.0 license ที่ revision นี้แล้ว; ยังไม่ audit dependency licenses ทั้งต้นไม้
- ไม่ launch GUI, scan key directory, สร้างกุญแจ, แตะ agent, ทดสอบ SSH connection หรือใช้ config ส่วนตัว
- รันเฉพาะ harness ของ parser/serializer/backup กับข้อความตัวอย่างและ TempDir; ไม่มี production code ของ Whichcraft เปลี่ยน

## โครงสร้างที่พบจริง

| ส่วน | ขอบเขตและ dependency | ผลต่อการศึกษาต่อ |
| --- | --- | --- |
| `src/pages`, `components`, `api/tauri.ts` | React19/MUI/React Query, Tauri invoke; mutable page state และ query invalidation | UX Hosts/Keys/Backups แยกหน้าชัด แต่ไม่ใช่ React MVI ของ Whichcraft ที่นำมาเสียบตรง ๆ |
| `src-tauri/src/commands/config.rs` | ตรวจ form, หา home path, สร้าง custom thread stack, เรียก parser/core โดยตรง | มี application logic ใน commands; ต้องแยก validation/application/process/filesystem boundary หากจะนำแนวทางมาใช้ |
| `ssh-at-core::config` | public model/parser/CRUD; CRUD ใช้ home path, FS, thread/runtime และ backup storage | เป็น lib crate จริง แต่ core ไม่ใช่ domain ล้วนหรือ I/O port; path override หลายตัวอยู่ใต้ cfg(test) เท่านั้น |
| `simple_parser.rs` | active parser; รับ text แต่สามารถอ่าน Include จาก filesystem และหา home ผ่าน dirs | ไม่ใช่ pure text parser และไม่มี Include loader ที่ inject ได้ |
| `parser.rs` | Pest parser ทางเลือก มี upstream parser tests | Tauri/core CRUD ที่ตรวจใช้ simple_parser จึงห้ามถือว่าชุด parser tests ครอบคลุมเส้นทางจริงโดยอัตโนมัติ |
| `ssh-at-core::keys` | scanner, type helper, ssh-keygen process | ต้องแยก public-key inventory กับ private-key inspection และ inject executable/process ถ้าจะศึกษาเพื่อใช้กับเรา |
| `ssh-at-storage::backup` | filesystem backups/settings ผ่าน home; chrono/sha2/Tokio | backup ไม่ใช่ journal/Undo; manifest ยังมี SQLx/SQLite แม้ implementation backup ที่อ่านใช้ไฟล์ |

Primary sources: [workspace/Cargo](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/Cargo.toml), [core manifest](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/Cargo.toml), [storage manifest](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-storage/Cargo.toml), [frontend API](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src/api/tauri.ts), [config command](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src-tauri/src/commands/config.rs)

## สิ่งที่รันจริง

### A. Upstream crate test attempt

ลอง `cargo test --locked --offline -p ssh-at-core --lib config::crud::tests::test_serialize -- --test-threads=1` จาก source ที่ pin แล้ว โดย target อยู่ใน temp

**ไม่ได้รัน tests:** dependency resolution หยุดเพราะไม่มี `pest` ใน local cache จึงไม่สรุปว่า upstream tests ผ่าน/ไม่ผ่าน และไม่ได้ build ทั้ง Tauri หรือดาวน์โหลด dependency ทั้ง workspace เพื่อทำให้ผ่าน

ก่อนเลือกคำสั่งได้อ่าน tests แล้ว: บาง tests ใช้ HOME/global load และ key modules มี ssh-keygen calls จึงไม่รันทั้ง suite แบบเหมารวม Integration test file ที่ revision นี้เป็น placeholder มี [test workflow แยก](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/.github/workflows/test.yml) ที่กำหนด Ubuntu/macOS/Windows และ `cargo test --workspace --locked` แต่ไม่ได้ตรวจว่า run ล่าสุดผ่านหรือไม่ ส่วน release workflow เป็น build/publish

### B. Controlled parser/serializer harness

สร้าง Cargo project ใหม่ใน temp มีเพียง model, **simple_parser ที่คัดลอก byte-identical** และ serializer function ที่ดึงมาทั้ง body จาก crud โดยไม่แก้ implementation:

- ตัด module declarations/re-export ของ Pest/CRUD ออกจาก model เพื่อไม่ดึง filesystem CRUD, Tauri และ storage ทั้ง crate
- serializer ถูกวางใน module wrapper ที่ import types/anyhow; ไม่มีการเปลี่ยน body
- ใช้ cached serde/serde_json/anyhow/dirs/tempfile รัน offline บน Windows
- SHA256 ของ simple_parser ทั้งต้นทางและสำเนาตรงกัน: `10A3F3C2E75DE07819398F1365EC2DFB73DB7665FDBE6246576C429BB2690B07`
- คำสั่ง: `cargo test --offline --manifest-path <temp>/harness/Cargo.toml --test behavior -- --test-threads=1`
- ผล: **8 passed / 0 failed**; เป็น characterization assertions เพื่อยืนยันพฤติกรรมที่พบ ไม่ใช่การรับรองฟีเจอร์หรือผล upstream suite

| Probe | ผลที่ยืนยันจากการรัน |
| --- | --- |
| Plain Host/User/HostName | model values ผ่าน round trip |
| No-op ของ text ที่มี comment/blank/tab/CRLF | output ไม่เท่า input; header comment และ CR หาย |
| IdentityFile สองบรรทัด | เหลือตัวหลังใน model/output |
| User ซ้ำใน Host เดียว | parser เก็บตัวหลัง |
| `User=alice` | ถูกข้าม เพราะ parser แยกด้วย whitespace แล้วต้องมี value token |
| `Match user nobody` ตามหลัง Host | User ใน Match body ไปทับ User ของ Host เดิม; Match ถูกเก็บเป็น extra option |
| Include ไฟล์ลูกใน TempDir | parent hosts มาก่อน child hosts; serialize ไม่มี Include directive และใส่ child content ลง output |
| Unknown directive ชื่อซ้ำ | HashMap เหลือหนึ่งรายการและเป็นค่าหลัง |

เก็บ probe ที่เราเขียนไว้ใน [ssh-at-behavior.rs](probes/ssh-at-behavior.rs) ไม่มี implementation upstream ถูกเพิ่มใน repo

### C. Controlled backup collision probe

นำ production portion ของ backup.rs มาไว้ใน temp harness โดยตัด upstream test module ออก แล้วเพิ่ม test ที่เรียก `create_backup_with_limit_impl` ด้วย `Some(temp.path())` เท่านั้น ไม่เรียก restore/delete/global home

- ใช้ Tokio 1.52.3 / tokio-macros2.7.1 จาก cache (อยู่ในช่วง dependency ของ upstream) ร่วมกับ chrono/sha2; ไม่ได้รัน upstream workspace
- คำสั่ง: `cargo test --offline --manifest-path <temp>/harness/Cargo.toml --lib backup_audit::audit_tests::same_second_backups_replace_the_previous_backup -- --test-threads=1`
- ผล: **1 passed / 0 failed**; test ยืนยันว่า backup สองเนื้อหาที่สร้างในวินาทีเดียวกันใช้ filename เดียวกัน จึงเหลือเพียงเนื้อหาครั้งหลังใน backup directory
- ฟังก์ชันใช้ timestamp ความละเอียดวินาทีทั้ง filename และ ID; นี่เป็นข้อจำกัดที่ทำซ้ำได้ของ backup history ไม่ใช่การทดสอบ Undo ของแอป
- ช่วงเตรียม harness เคยชน permission ตอน Cargo พยายาม unpack macro version ใหม่; เลือก version ที่มีใน cache แล้วรันสำเร็จโดยไม่ดาวน์โหลด dependency เพิ่ม

เก็บ test ที่เพิ่มไว้ใน [ssh-at-backup-probe.rs](probes/ssh-at-backup-probe.rs) และ source อ้างอิง [backup.rs](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-storage/src/backup.rs)

## ข้อค้นพบเพิ่มจาก source ที่ยังไม่ได้รัน

### เส้นทาง key inventory ที่ GUI เรียกไม่เท่ากับ async API

`scan_ssh_keys` command เรียก `scan_keys_sync` ซึ่งข้ามการตาม IdentityFile ใน config และอ่านไฟล์ non-.pub ใต้ default directories เพื่อดู private-key header เส้นทาง sync ตั้ง fingerprint เป็น None ส่วนหน้าจอ Keys แสดง fingerprint เฉพาะเมื่อมีค่าและไม่เรียก fingerprint API แยกใน code ที่อ่าน จึงไม่ควรนับ advertised fingerprint/config-reference scanning ว่าใช้งานครบจาก active GUI path นี้

`detect_key_type` ถือว่า OpenSSH private-key header ทุกอันเป็น Ed25519 และ encrypted detection เช็ก string ENCRYPTED ไม่ได้ decode OpenSSH cipher metadata งานนี้ไม่ได้เปิด private key หรือรัน scanner เพื่อพิสูจน์กับ key จริง

Sources: [key command](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src-tauri/src/commands/keys.rs), [scanner](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/keys/scanner.rs), [KeysPage](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src/pages/KeysPage.tsx)

### Form validation และ I/O policy

- Form บังคับ HostName/User/IdentityFile ที่มีอยู่ จึงไม่ครอบคลุม alias ที่รับค่าจาก wildcard/include หรือ agent-only configuration
- Key generator เรียก ssh-keygen จาก PATH และส่ง passphrase ผ่าน args; Unix มี chmod แต่ Windows ACL policy ต้องประเมินแยก ไม่ได้รัน key generation
- Key delete command รับ path แล้วลบไฟล์นั้นกับ `.pub` โดยตรงหลังเช็ก file exists; source ที่อ่านไม่มี path ownership allowlist สำหรับ key lifecycle นี้ หากศึกษาต่อควรแยก policy นี้จาก user-picked external key inventory
- Global config CRUD ใช้ `.tmp` ชื่อคงที่ แล้ว rename โดยไม่มี compare baseline; backup restore เขียนทั้งไฟล์

Sources: [validation/commands](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src-tauri/src/commands/config.rs), [generator](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/keys/generator.rs), [CRUD](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/config/crud.rs)

## สิ่งที่น่าศึกษาต่อและต้นทุนที่เห็นแล้ว

| ส่วน | สิ่งที่ได้ | สิ่งที่ยังต้องจัดการก่อนใช้กับ Whichcraft |
| --- | --- | --- |
| Screen/IPC flow | Hosts/Keys/Backups แยกชัด และ data contract อ่านง่าย | แปลงจาก MUI/React Query/page-local state ให้เข้า UI และ MVI ที่ repo ใช้อยู่ |
| Public lib crate layout | เห็นจุดแบ่ง core/storage/commands ชัดกว่าการอยู่ไฟล์เดียว | core ยังทำ I/O เองและ hardcode home; storage dependency ดึงกว้างกว่าที่ต้องใช้ |
| Config model | ใช้ทำ host list ง่าย | scalar/HashMap ไม่เพียงพอเป็น lossless document หรือ provenance model |
| Backup UX | มี browser/restore history | collision ที่พิสูจน์แล้ว, baseline conflict, granular revert และ recovery ยังไม่ได้ให้ตาม contract Whichcraft |
| Key forms | เห็น flow generation/copy/delete | scanner active path, public-only inventory, executable resolution, ACL, action ownership และ process error handling |

ความเข้ากันของ Tauri/React/Rust ช่วยเรื่องภาษาและแนวทาง IPC แต่ยังไม่ตอบต้นทุนการเปลี่ยน document model, I/O boundaries, UI state และ persistence จากหลักฐานนี้เพียงอย่างเดียว จึงยังไม่สรุปว่าจะ fork หรือเขียนเอง

## ขอบเขตที่ยังไม่ยืนยัน

ไม่ได้ build/run full app, UI tests, release installer, real key handling, Windows ACL/key overwrite, concurrent save ระดับ process หรือ crash recovery การที่ probes ผ่านหมายถึงทำซ้ำพฤติกรรมทั้งด้านที่ใช้ได้และช่องว่างได้ ไม่ใช่การตรวจรับความพร้อม production

Temp harness ในรอบนี้: `C:\Users\Nuniozzz\AppData\Local\Temp\whichcraft-ssh-at-audit-4582dd068ed64a16867eaaa2b33a70bf\harness` เป็น artifact ชั่วคราว ไม่ใช่ production dependency
