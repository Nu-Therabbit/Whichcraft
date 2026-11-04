# ลงรายละเอียดห้าตัว: โมดูลและผลทดลอง Windows

วันที่ตรวจ: **3 พฤศจิกายน 2026 (Asia/Bangkok)**

ตามคำขอของผู้ใช้ ศึกษา `ssh-manager-tui`, `SSH-AT`, `git-ego`, `gitswitch` และ `soulteary/ssh-config` ให้ลึกกว่าตาราง README ก่อน **ยังไม่ตัดสินว่าจะ fork, ใช้เป็น dependency/sidecar, ย้ายบางโมดูล หรือเขียนเอง**

## งานที่ทำเพิ่มจากรอบก่อน

- ดาวน์โหลด source ของทั้งห้าที่ pin commit แล้วลง temp แยก เก็บ SHA256 ในรายงานรายตัว
- อ่าน module boundaries, API, manifests, dependencies, production code และ tests ก่อนเลือกคำสั่งที่รัน
- Build/test เฉพาะส่วนที่มีประโยชน์ต่อ config และทดลองด้วย fake home/config/repository บน Windows ไม่มีการเปิด GUI หรือทดสอบ authentication
- แยก upstream tests ออกจาก characterization probes ของเรา และแยก source ที่อ่านจากพฤติกรรมที่ได้รันจริง
- ไม่แตะ Git/SSH config, private keys, credential store หรือ agent ของผู้ใช้ ไม่มี production implementation ของ Whichcraft เปลี่ยน

## ภาพรวมผลใหม่

| ตัวเลือก | สิ่งที่พิสูจน์ได้เพิ่ม | สิ่งที่พบซึ่งต้องคิดต่อ |
| --- | --- | --- |
| [ssh-manager-tui](ssh-manager-tui.md) | config subsystem แยกจาก TUI มาคอมไพล์ได้; **49 upstream config tests + 13 probes ผ่าน** บน Windows รวม ReplaceFileW content lifecycle | เก็บ inline comment ของ field ที่แก้ไม่ครบ; อาจลบ scalar duplicate ที่ไม่ได้ตั้งใจแก้; stale save ทับ external edits; Include ไม่ได้โหลดเป็น host graph |
| [SSH-AT](ssh-at.md) | **8 parser/serializer probes + 1 backup probe ผ่าน** เพื่อยืนยันพฤติกรรมที่พบ โดยใช้ implementation จริงใน harness | comments/CRLF/Include/repeated keys หายตามที่สงสัย; backup ภายในวินาทีเดียวกันทับกัน; active GUI scanner ไม่ส่ง fingerprint และไม่ได้ตาม config references |
| [git-ego](git-ego.md) | build และ **25 config/utils tests ผ่าน**; CLI ใช้กับ fake remote include/local overrides ได้ | managed include ท้ายไฟล์ทำให้ personal profile ทับ work identity ที่ remote include เดิมตั้งไว้; เขียน home .gitconfig แม้ตั้ง GIT_CONFIG_GLOBAL ไปไฟล์อื่น |
| [gitswitch](gitswitch.md) | build และ **15 selected tests ผ่าน / 1 symlink skip**; local override และ custom global path ทำงานใน fixture | edit profile ที่ตรงกับ global อาจ apply ทันที; work identity จากเดิมอาจใช้ร่วมกับ personal SSH command ที่ตั้ง global |
| [soulteary/ssh-config](soulteary-ssh-config.md) | build; pure upstream **73 ผ่าน / 1 fail / 3 skip**; probes **5 ชุด + 6 corpus cases ผ่าน**; CLI JSON roundtrip และแก้รายบรรทัดได้จริง | fail เป็น POSIX-mode assertion บน Windows; CLI ไม่ส่ง Include graph/path/diagnostics; IDs ไม่ persistent; Save ไม่ตรวจ external edits |

**ตัวเลขห้ามใช้จัดอันดับคุณภาพ:** tests แต่ละชุดมีขอบเขตต่างกัน และ probes หลายข้อ assert ว่าพฤติกรรมที่เราไม่ต้องการเกิดขึ้นจริง คำว่า probe ผ่านไม่ได้หมายถึงผ่านเกณฑ์ฟีเจอร์ Whichcraft อีกทั้ง harness ของ Rust สองตัวไม่ได้ใช้ lock/dependencies ทั้ง app แบบเดิมทุกตัว

## เคสที่ตรงกับเครื่องผู้ใช้

### 1. Remote include เดิมอยู่ครบ แต่ผลเปลี่ยนได้

Fixture ของ Git ทั้งสองตั้ง personal identity ไว้ก่อน remote-based Bitbucket include ที่ให้ work identity หลังใช้ git-ego แบบ global managed include ที่อยู่ท้ายไฟล์ทำให้ identity กลายเป็น personal แม้ข้อความกฎเดิมยังอยู่ ส่วน status ยอมรับ profile นั้นว่า consistent จนกว่าจะเพิ่ม local override ที่ต่างออกไป

gitswitch ใน sequence ที่ตรวจคง work name/email ตาม remote include แต่ตั้ง global core.sshCommand ของ personal key ได้ทั้งตอน edit และ use สถานะจึงอาจเป็น work identity + personal key พร้อมกัน ไม่ได้เชื่อมต่อ server จึงไม่อ้างว่า authentication สำเร็จด้วย key ใด

สิ่งที่ต้องกำหนดในการออกแบบคือ profile ownership, scope และผลกระทบต่อกฎเดิม ไม่ใช่เพียงมีปุ่มสลับ profile

### 2. การรักษา source ต้องทดสอบที่เส้นทางจริง

- SSH-AT มี typed lib และอีก Pest parser ที่มี tests แต่ active app path ใช้ simple_parser อีกตัว ผลทดลองของ active parser จึงมีค่ามากกว่านับจำนวน tests ทั้ง repo
- ssh-manager-tui มี ordered/raw model ที่แยกได้จริง แต่ form projection และ newline diff เพิ่มพฤติกรรมที่ raw model อย่างเดียวไม่บอก
- soulteary v3 รักษา source bytes และ unknown/repeated directives ใน fixture ได้ดี โดยไม่ evaluate Match exec แต่ยังต้องเพิ่ม path/snapshot identity และ graph API ที่ CLI ไม่ได้ expose

### 3. Atomic write/backup ยังไม่ให้ contract Undo ที่ต้องการ

ทดลอง ssh-manager-tui และ soulteary พบ silent stale-file overwrite; backup ของตัวแรกผูกกับ model instance และไม่ rotate ทุก save ส่วน SSH-AT backup ชื่อชนกันได้ภายในหนึ่งวินาที

ยังต้องกำหนด read snapshot → preview → compare current → apply → journal/recovery → selective Undo ของ Whichcraft แยกจาก editor/serializer ที่เลือกใช้ การตรวจครั้งนี้ยังไม่ได้พิสูจน์ crash recovery หรือ concurrency ทุก process

## โมดูลที่ควรมีข้อมูลไว้ใช้ตัดสินใจภายหลัง

| ตัวเลือก | ส่วนที่แยกศึกษาได้ | Coupling ที่มีหลักฐาน |
| --- | --- | --- |
| ssh-manager-tui | parser/model/tokens/diff และ writer Windows | binary-only crate; writer ต่อ secure_fs→os helper; model มี path/dirty/backup state และไม่มี IPC serialization |
| SSH-AT | UI/IPC และ public core/storage crate layout | core ทำ I/O และ home resolution โดยตรง; typed model ไม่เก็บ source; frontend ใช้ React Query/MUI ต่างจาก MVI ของ Whichcraft |
| git-ego | effective/expected identity resolution, generated include ownership, atomic publish | public Go packages มี init/global paths/state; cmd print human text; profile marker/OS keychain เป็นระบบของตนเอง |
| gitswitch | ops→gitx/profile แยกจาก CLI/TUI อยู่แล้ว, native directory rules | internal Go packages; ops อาจ mutate ระหว่าง edit; Git/PATH/cwd/environment และ ownership model ต้องแยกก่อน UI review/apply |
| soulteary | public Go library ที่มี parse/edit/graph/schema/bytes APIs | ต้อง Go1.27.3 สำหรับ revision นี้; conversion CLI ยังไม่ใช่ management protocol; sidecar/FFI/porting เป็นตัวเลือกที่ยังไม่ตัดสิน |

จุดเชื่อมกับโครง Whichcraft ปัจจุบันที่ตรวจคือ [ProcessRunner](../../../src-tauri/src/whichcraft/ports/process.rs), [Store](../../../src-tauri/src/whichcraft/ports/store.rs) และ [Journal](../../../src-tauri/src/whichcraft/domain/journal.rs) แต่ journal ปัจจุบันเป็น environment mutation model จึงไม่ถือว่าใช้แทน arbitrary Git/SSH file operations ได้ทันที ยังไม่ได้เสนอ ADR หรือแก้ domain types

## สิ่งที่ยังเปิดอยู่ก่อนตัดสินแนวทาง

- Feature scope ที่ต้องการจริง: read-only inspector, editor, key lifecycle, authentication หรือ full SSH client ต้องแยกให้ชัด
- รองรับ native remote includes ทั้งสี่แบบ, worktree config,หลาย remote และ origin ต่อ key ไม่ใช่แค่ profile marker
- Source model ต้องเก็บอะไรถึงถือว่าแก้เฉพาะจุด: comments, unknowns, duplicate keys, BOM, CRLF/mixed newline, invalid-but-preserved text
- Snapshot/operation identity และ concurrency contract สำหรับ preview/save/Undo รวมหลายไฟล์
- Windows ACL, symlink, crash/failure injection และ real Git/SSH executable contexts ยังไม่ได้ครอบคลุมครบ
- Cost ของ extraction, wrapper/sidecar packaging, dependency updates และการ maintain ความต่างจาก upstream ยังไม่ควรประเมินจากจำนวนบรรทัดอย่างเดียว

## หลักฐานที่เก็บไว้

- [ssh-manager-tui: modules, 49 tests, 13 probes](ssh-manager-tui.md)
- [SSH-AT: modules, active parser/backup probes](ssh-at.md)
- [git-ego: 25 tests และ remote/local/custom-global fixtures](git-ego.md)
- [gitswitch: 15 tests, symlink skip และ identity/key fixtures](gitswitch.md)
- [soulteary: upstream results, API/CLI roundtrip และ Windows limits](soulteary-ssh-config.md)
- [SSH-AT behavior probes ที่เขียนในงานนี้](probes/ssh-at-behavior.rs), [backup probe](probes/ssh-at-backup-probe.rs), [ssh-manager probes](probes/ssh-manager-tui-probes.rs) เป็น test fragments สำหรับ harness ตามรายงาน ไม่ใช่ production tests/dependencies ของ Whichcraft

Source snapshots, compiled binaries, dependency caches และ raw execution logs เก็บใน temp ตามพาธที่แต่ละรายงานระบุ ระบบอาจล้างได้ในภายหลัง ไม่มี installer หรือ environment variable แบบถาวรถูกเพิ่มจากการตรวจนี้
