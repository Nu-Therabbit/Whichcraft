# soulteary/ssh-config v3 — ทดลอง API และ CLI บน Windows

ตรวจและทดลอง: 3 พฤศจิกายน 2026 (Asia/Bangkok)

**สถานะ:** มีหลักฐานจากการ build และรัน fixture แล้ว ยังไม่ใช่การเลือก fork หรือเพิ่ม dependency ใน Whichcraft ไม่มีการแตะ Git/SSH config จริงและไม่รัน SSH/network integration tests

## ผลที่เปลี่ยนความเข้าใจจากรอบก่อน

1. **JSON conversion ใช้เป็น editor transport ได้จริง**: export → แก้ semantic view ของหนึ่ง node → import เขียนไฟล์ใหม่ได้ โดยส่วนที่ไม่แก้ยังเหมือนต้นฉบับทุก byte ใน fixture ที่ทดสอบ
2. **CLI ยังไม่ใช่ config-management service**: มี conversion flags แต่ไม่มี patch/inspect/validate/resolve-includes commands; export ไฟล์ที่มี Include ได้เพียง document เดียวและไม่ส่ง source path ออกมา ต้องมี wrapper หากต้องการ graph, diagnostics และการเลือกไฟล์ต้นทางใน UI
3. **NodeID ไม่ใช่ persistent identifier**: คงเดิมระหว่างแก้ใน Document เดียว แต่เปลี่ยนเมื่อ insert แล้ว serialize/reparse; JSON schema ไม่มี node ID จึงต้องผูกคำขอแก้กับ snapshot/hash ของไฟล์
4. **Save ไม่มี external-edit conflict detection**: ทดลองให้โปรแกรมอื่นเพิ่มบรรทัดหลัง Parse แล้ว `Document.Save` ทับการเปลี่ยนภายนอกโดยคืน nil; atomic replacement ไม่ได้ให้ Undo หรือ optimistic concurrency
5. **Windows มีข้อจำกัดที่ต้องถือแยกจาก parser**: fixture editing ผ่าน แต่ upstream test เรื่อง POSIX mode fail บน Windows; permission validation และ directory sync มี Windows/non-Unix implementations ที่คืน nil

## Revision และสภาพแวดล้อม

- Repository: [soulteary/ssh-config](https://github.com/soulteary/ssh-config)
- Source: [`71a19e21ec248d4622260db70bcd138355c0b4e6`](https://github.com/soulteary/ssh-config/tree/71a19e21ec248d4622260db70bcd138355c0b4e6)
- Source ZIP SHA256: `6810E02969B18C1CE74C8882554B40DD84A9FACB3C1826A378B81A489D12064C`
- Temp root: `C:\Users\Nuniozzz\AppData\Local\Temp\whichcraft-ssh-config-ea9116a794ab4d389cceafaffcfebb25`
- Source folder ใต้ temp: `ssh-config-71a19e21ec248d4622260db70bcd138355c0b4e6`
- เครื่องมี Go `1.27.0 windows/amd64`; [go.mod ของ revision นี้](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/go.mod) ต้องการ **Go 1.27.3** ข้อกำหนดนี้ใหม่กว่าตัวเลข 1.27.2+ ใน README ที่อ่านรอบก่อน
- เตรียม Go 1.27.3 และ modules ใน `go-mod-cache`, `go-build-cache`, `go-path` ใต้ temp เท่านั้น ไม่เปลี่ยน Go installation หรือ user environment แบบถาวร
- หลังเตรียม dependencies แล้ว การทดสอบ/build ใช้ `GOENV=off`, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off` กับ `go.exe` ใน toolchain temp โดยตรง; process ที่รันทดสอบ/CLI ใช้ HOME/USERPROFILE/TEMP/TMP ของ fixture

การเรียก wrapper `go` พร้อม `GOTOOLCHAIN=go1.27.3` และ `GOSUMDB=off` ไม่ผ่าน เพราะ Go ต้องตรวจ checksum ของ toolchain จึงเปลี่ยนไปเรียก binary ที่เตรียมและตรวจแล้วใน temp โดยตรง ไม่ได้ลดข้อกำหนด version ใน source

## สิ่งที่อ่านก่อนรัน

อ่าน exported API, parser/document/schema/edit/writer/include/validation, test functions ใน `pkg/sshconfig`, CLI argv/main/lossless converter และ CI workflows ก่อนเลือก test pattern

- [openssh_integration_test.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/openssh_integration_test.go) เรียก `ssh -G`; **ไม่ได้รัน TestOpenSSH*** ในงานนี้
- [writer_test.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/writer_test.go) ใช้ temp files และ failure injection; ไม่มีการอ้าง private key
- [include_test.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/include_test.go) ทดสอบ glob/order/expansion/cycles/depth/resource limits บน fixtures
- [extended-tests.yml](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/.github/workflows/extended-tests.yml) มี scheduled/manual Windows+macOS `go test ./...` และ Linux fuzz jobs แต่การมี workflow ไม่ได้ยืนยันว่า revision นี้ผ่าน Windows CI แล้ว

## ผลการรัน upstream pure tests

คำสั่งหลัก (เรียกผ่าน child process ที่ตั้ง environment แยกไว้):

```text
<temp-toolchain>/bin/go.exe test ./pkg/sshconfig \
  -run '^Test(Parse|Nodes|Malformed|Document|Marshal|Replace|Remove|Edit|Save|Quote|Append|Schema|Validate|Unknown|Lookup|Resolve|Expand|Read|Migrate)' \
  -count=1 -json -coverprofile=<temp>/upstream-pure.coverage.out
```

| ผล | จำนวน / หลักฐาน |
| --- | --- |
| Top-level tests ผ่าน | 73 |
| Top-level tests ไม่ผ่าน | 1: `TestSaveAtomic` |
| Skip บน Windows/environment นี้ | 3: `TestResolveIncludesPermissionCheck`, `TestResolveIncludesSkipsUnreadableGlobMatches`, `TestSaveAtomicRejectsSymlink` |
| Coverage เฉพาะ package จากชุดที่เลือก | 90.6% of statements |
| Exit code | 1 — จึงไม่รายงานว่าชุด upstream ผ่านทั้งหมด |

ข้อความ fail จริง:

```text
writer_test.go:179: saved mode = 666, want 640
```

การเขียนและอ่านเนื้อหาใน test นี้สำเร็จก่อนมาติด assertion POSIX permission bits; จึงเป็นหลักฐานปัญหาความเข้ากันได้ของ test/permission model บน Windows ไม่ใช่หลักฐานว่า parser หรือ atomic replacement เขียนเนื้อหาผิด

รันครั้งแรกใน sandbox พบ rename/coverage-file permission errors เพิ่ม จึงรันซ้ำใน temp เดิมด้วย execution ที่ไม่ติดข้อจำกัด sandbox โดยยัง offline และใช้ fake HOME เพื่อแยกสาเหตุ ผลด้านบนคือรอบหลัง; `TestSaveAtomicReportsDirectorySyncFailure` ผ่านในรอบหลัง ไม่ถือ error จาก sandbox เป็น product bug

หลักฐาน raw: [upstream-pure-tests-unrestricted.jsonl](C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-ssh-config-ea9116a794ab4d389cceafaffcfebb25/upstream-pure-tests-unrestricted.jsonl), [coverage](C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-ssh-config-ea9116a794ab4d389cceafaffcfebb25/upstream-pure.coverage.out)

## Focused probes ที่เพิ่มเฉพาะใน temp

ไฟล์ probe เป็นของการทดลองนี้ ไม่ใช่การแก้ upstream หรือ production code: [whichcraft_probe_test.go](C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-ssh-config-ea9116a794ab4d389cceafaffcfebb25/ssh-config-71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/whichcraft_probe_test.go)

```text
<temp-toolchain>/bin/go.exe test ./pkg/sshconfig -run '^TestWhichcraft' -count=1 -json
```

**ผ่าน 5 top-level probes พร้อม 6 corpus subcases, exit 0**:

| Probe | วิธีตรวจ | ผลที่เห็นจริง |
| --- | --- | --- |
| Byte corpus | Parse → MarshalPreserve และ Parse → schema JSON → decode → Document → MarshalPreserve | byte-identical ทั้ง CRLF, mixed CRLF/LF/CR, BOM, non-UTF8, unknown/repeated IdentityFile และ Match exec |
| แก้ directive เดียว | เปลี่ยน User โดยคง comment, tabs, CRLF, unknown option, IdentityFile สองบรรทัดและ final line ไม่มี newline | เปลี่ยนเฉพาะบรรทัดที่ตั้งใจ; syntax ของค่าใหม่ถูก quote |
| Include + Match exec | root Include child อยู่ใต้ Match exec ของ fixture; edit/save เฉพาะ child | root ไม่เปลี่ยน, child เปลี่ยนตรง User, ไม่มี marker file ที่คำสั่ง exec จะสร้าง |
| NodeID lifecycle | insert directive หน้า User แล้ว reparse | User ID จาก 1 → 2 หลัง reparse; ใน Document ก่อน reparse ID ยังเป็น 1; schema ไม่มี ID |
| External edit | Parse แล้วให้ external writer เพิ่ม comment จากนั้น Save snapshot ที่แก้ User | Save คืน nil, User ใหม่ถูกเขียน และ comment ภายนอกหาย แสดงว่าไม่มี conflict detection |

**ขอบเขตความหมาย:** byte-preserving BOM ไม่ได้ยืนยันว่า OpenSSH จะยอมรับ BOM เป็น valid config หรือว่า library recognize `Host` ที่มี BOM prefix เป็น keyword ที่ถูกต้อง; การรักษา bytes กับการ resolve semantics เป็นคนละผลทดสอบ

Include graph อ่าน child ใต้ Match โดยไม่ประเมินเงื่อนไข จึงเหมาะแสดง source relationships แต่ห้ามเรียก child นั้นว่า active/effective สำหรับ host จาก graph เพียงอย่างเดียว

หลักฐาน raw: [controlled-probes.log](C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-ssh-config-ea9116a794ab4d389cceafaffcfebb25/controlled-probes.log)

## ทดลอง CLI จริง

Build แบบ offline สำเร็จ:

```text
<temp-toolchain>/bin/go.exe build -mod=readonly -o <temp>/ssh-config.exe .
ssh-config.exe -to-json -src <fixture>/config -dest <fixture>/schema.json
ssh-config.exe -to-ssh -src <fixture>/schema.json -dest <fixture>/roundtrip.conf
# แก้ documents[0].nodes[...].directive.arguments ใน JSON ของ fixture
ssh-config.exe -to-ssh -src <fixture>/edited.json -dest <fixture>/edited.conf
```

ผล: export/import/edit ทั้งสามคำสั่ง exit 0; no-op file เหมือนต้นฉบับทุก byte และ JSON edit เปลี่ยนเฉพาะ User line เช่นกัน Binary ที่ build แบบปกติไม่ strip มีขนาด **5,934,080 bytes** นี่เป็นขนาดตัวทดลอง ไม่ใช่คำรับรอง release size

ข้อค้นพบจาก CLI ที่ลอง:

- config มี `Include work.conf` และ child มีอยู่จริง แต่ JSON export มี **1 document** เท่านั้น ไม่ resolve includes โดยอัตโนมัติ
- export document **ไม่มี path field** เพราะ [ProcessLossless](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/internal/parser/lossless.go) เรียก `ToSchema("")` แม้มี `-src`
- JSON มี `schemaVersion:3`, `documents[].nodes[]`, rawBase64 และ directive view แต่ไม่มี node IDs หรือ positioned diagnostics
- [CLI flags](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/cmd/argv.go) มี to-yaml/to-json/to-ssh/src/dest/document-path/legacy/help/version; ไม่มีคำสั่ง patch node, validate, inspect graph หรือ journal
- `-document-path` เลือก physical document ใน envelope ที่เตรียมมาแล้ว ไม่ได้หมายถึงค้น Include หรือเขียนหลายไฟล์แบบ transaction

หลักฐาน: [cli-probe-results.json](C:/Users/Nuniozzz/AppData/Local/Temp/whichcraft-ssh-config-ea9116a794ab4d389cceafaffcfebb25/cli-probe-results.json)

## API seam และ transport ที่มีจริง

Public import path: `github.com/soulteary/ssh-config/v3/pkg/sshconfig`

| งาน | Exported API | ขอบเขตที่ต้องจำ |
| --- | --- | --- |
| Parse จำกัด input | `ParseReader(reader, ParseOptions{MaxBytes: ...})` | ไม่ evaluate config |
| แสดง syntax/source | `Nodes`, `Raw`, `Diagnostics`, `Newline` | source offsets มาจาก original snapshot; inserted nodes ไม่มี original offsets แบบเดียวกัน |
| แก้แบบเจาะจง | `ReplaceDirective`, `RemoveNode`, `InsertDirectiveAfter`, `AppendDirective` | NodeID ใช้ได้ใน Document เดียว ไม่ stable ข้าม reparse |
| Validate | `Validate(ValidateOptions{UnknownDirective: ...})` | ตรวจ syntax/keyword compatibility ไม่เท่ากับ evaluator ของ SSH version ในเครื่อง |
| Include ownership | `ResolveIncludes(...ResolveOptions...)` | graph แยก physical files/edges; มี limits แต่ไม่มี host-condition evaluation |
| JSON transport | `ToSchema(path)`, `MarshalSchemaJSON`, `UnmarshalSchemaJSON`, `Schema.Document(path)` | เก็บ rawBase64 ทุก physical line; แก้ directive view แล้ว render เฉพาะ line นั้น |
| Preview bytes | `MarshalPreserve` | ไม่แตะดิสก์ เหมาะคืน bytes ให้ Rust จัด diff |
| Save | `Save` / `SaveAtomic` | atomic replacement เฉพาะไฟล์ ไม่ตรวจ snapshot hash/Undo/multi-file transaction |

Source: [document.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/document.go), [schema.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/schema.go), [edit.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/edit.go), [include.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/include.go), [writer.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/writer.go)

### ตัวอย่าง boundary หากทดลองใช้ต่อ (ข้อเสนอ ไม่ใช่ implementation)

```text
inspect {path, maxBytes, allowedIncludeRoots}
  -> {snapshotHash, physicalDocuments, syntaxNodes, issues, includeEdges}

preview {snapshotHash, path, nodeIndex, expectedRawHash, replacement}
  -> {beforeHash, proposedBytesBase64, issues}

Rust adapter ตรวจไฟล์ยังตรง beforeHash แล้วเป็นผู้จัด journal/apply/undo
```

thin Go wrapper สามารถเรียก public library แทน fork CLI ทั้งตัว และ expose diagnostics/graph ที่ CLI เดิมไม่ส่งมาได้ หรือ Rust adapter อาจใช้ CLI conversion กับ schema แล้วดูแล path/hash เอง อย่างหลังยังต้องทำ graph/validator อีกทาง เพราะ conversion envelope ไม่ครอบคลุม API ทั้งหมด

หากเปลี่ยน schema nodes โดย index ต้องยืนยัน snapshot hash ก่อนทุกครั้ง ไม่ใช้ index/NodeID เป็น identity ยาวข้าม refresh นอกจากนี้ schema เป็น strict envelope: การเติมฟิลด์ application-specific ลงใน schema ตรง ๆ อาจถูก reject ควรห่อด้วย protocol envelope ของเราอีกชั้น

## Dependency, runtime และภาระการแยกส่วน

- Core `pkg/sshconfig` มี 16 production Go files และ 2,207 lines ตาม `Get-Content | Measure-Object -Line` ใน revision นี้; tests ของ package มี 10 ไฟล์ก่อนเพิ่ม probe ไม่ต้องย้าย Electron/GUI หรือ database มาด้วย
- ตัว library ใช้ stdlib และ YAML v3; CLI/legacy code ยังมี YAML v2 ด้วยตาม go.mod การใช้เฉพาะ public packageยังทำงานผ่าน Go module path `/v3` ไม่ใช่ Rust crate
- source ใช้ `encoding/json/v2` และ module minimum Go 1.27.3 จึงไม่ควรแก้เลข go.mod ลงแล้วถือว่าเข้ากันได้ ต้องทดสอบ language/library dependencies หากจะ backport
- การ build exe สำเร็จและรัน CLI จริงแล้ว ทำให้ Go toolchain เป็น build dependency ของ sidecar ไม่ใช่สิ่งที่ผู้ใช้จำเป็นต้องติดตั้งเพื่อรัน exe ที่จัดส่ง อย่างไรก็ดีต้องเพิ่ม packaging/update/hash/IPC contract หากเลือกเส้นทาง sidecar
- [LICENSE](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/LICENSE) เป็น Apache-2.0; รอบนี้ไม่ได้ทำการรวมโค้ดหรือประเมินการแจกจ่าย dependency notices ของแพ็กเกจปลายทาง
- Windows [include_owner_other.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/include_owner_other.go) ไม่ตรวจ uid/mode/ACL; [syncdir_windows.go](https://github.com/soulteary/ssh-config/blob/71a19e21ec248d4622260db70bcd138355c0b4e6/pkg/sshconfig/syncdir_windows.go) ไม่ sync directory แม้ temp file sync แล้ว จึงไม่ควรตีความว่า “preserve permissions/atomic” รับรอง NTFS ACL และ crash durability ครบ

## คำถามที่ยังต้องพิสูจน์ก่อนตัดสินใจ

- ต้องการใช้ Go sidecar หรือให้ runtime ทั้งหมดอยู่ใน Rust; ค่า packaging/IPC เพิ่มคุ้มกับการยืม CST/editor เท่าใด
- การ resolve SSH Host/Match/command-line precedence จะใช้ใคร เพราะ library นี้ตั้งใจเป็น syntax model และไม่ทำส่วนนี้
- ใน Whichcraft จะเปิด Include นอก allowed roots อย่างไร และจะกัน graph scan ที่กว้างเกินไปอย่างไร ขีดจำกัด resource มีให้แต่ policy ต้องเป็นของแอป
- File replace บน Windows ต้องรักษา owner/DACL/attributes/symlinks และ handle file-in-use ด้วยเงื่อนไขใด ต้องมี fixtures เพิ่มก่อนใช้กับ user config
- Snapshot concurrency, journal, rollback และ Undo หลัง external edits ต้องออกแบบเพิ่ม เป็นคนละส่วนกับ lossless writer ที่ผ่านการทดลองแล้ว
- ต้องตรวจ binary tag/release และ workflow execution ของ revision ที่จะเลือกจริง งานนี้ทดสอบ pinned source ไม่ได้ยืนยัน release asset ว่ามาจาก revision เดียวกัน

**ผลประเมิน ณ ตอนนี้:** มี editing/transport core ที่พิสูจน์การใช้จริงกับ fixture ได้ เหมาะเป็นหนึ่งในส่วนประกอบที่จะทดลองต่อ แต่ยังไม่แทน feature ทั้งชุดของ Whichcraft และยังไม่ตัดสินเส้นทาง fork/ใช้ library/เขียนเอง
