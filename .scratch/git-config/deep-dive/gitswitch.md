# gitswitch — source และ isolated Windows probe

ตรวจ 3 พฤศจิกายน 2026 (Asia/Bangkok) เป็นข้อมูลเชิงลึกก่อนการตัดสินใจใด ๆ ยังไม่มีข้อสรุปว่าจะ fork หรือพัฒนาเอง

## Revision และวิธีตรวจ

- Repository: [uzairrehman4/gitswitch](https://github.com/uzairrehman4/gitswitch)
- Commit ที่ดาวน์โหลดและ build: [`794ea87f44affff11905f2a338eaf7a745164516`](https://github.com/uzairrehman4/gitswitch/tree/794ea87f44affff11905f2a338eaf7a745164516)
- Archive SHA256: `0D42C1A1ADD3A9131B12A12A3778AAE70DA5189020A71CB13FF61571B94C89A3`
- Source/binary อยู่ใต้ unique temp directory `C:\Users\Nuniozzz\AppData\Local\Temp\whichcraft-git-deep-e42081da58e54bd5a02c71f5ea7373a3\` ไม่เพิ่ม upstream source ลง repo
- เครื่องทดสอบ: Windows amd64, Go `1.27.0`, Git for Windows `2.56.0.windows.3`; source ต้องการ Go 1.24
- Root license [MIT](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/LICENSE) อ่านตัวบทแล้ว; ยังไม่ audit dependency licenses ทั้งต้นไม้

อ่าน tests ก่อนเลือกคำสั่ง ใช้ process environment แยก HOME/USERPROFILE/XDG/APPDATA/GITSWITCH_HOME และ Git global/system configs; `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_COUNT=0` ไม่มีการใช้ config จริง ไม่รัน keygen, SSH, agent, login, clipboard-copy action หรือ network auth มีเฉพาะ Go module downloads ระหว่าง build

## ผลใหม่จาก fake-home probe

Fixture: global personal identity ตามด้วย alias/comment, credential helpers สองตัว และ native `includeIf hasconfig:remote.*.url` ของ Bitbucket ไปไฟล์ work name/email; repo มี remote Bitbucket จำลองและไม่เชื่อมต่อ สร้างไฟล์ key placeholder ที่ไม่มีเนื้อหากุญแจจริง

| ขั้นตอน | ผลที่ตรวจด้วย Git พร้อม origin |
| --- | --- |
| ก่อนใช้ tool | Work name/email จาก remote-based include |
| `add ... --no-key` | สร้าง profile/store/generated include โดยยังไม่สร้างกุญแจ |
| `edit personal --key <fixture-path>` | **ตั้ง global `core.sshCommand` ทันที** เพราะ global name/email เดิมตรงกับ profile; ไม่ต้องกด `use` ก่อน |
| `use personal` | Work name/email จาก include เดิมยังชนะ แต่ SSH command เป็น personal key ที่ global |
| `status` | แสดง work name/email, `(not a gitswitch profile)` และ personal SSH command; ไม่ปิดบังค่าที่ resolve จริง แต่ไม่ได้ระบุ origin/scope แต่ละค่า |
| เพิ่ม local email + local SSH command | local override ชนะ และ `status` แสดงค่าจริงทั้งคู่; exit 0 แม้ไม่ใช่ profile ที่ tool รู้จัก |

การที่ identity งานยังอยู่ไม่ได้หมายความว่า authentication key ยังคงเดิม: native include ของ fixture แก้เฉพาะ name/email ส่วน global `core.sshCommand` ที่ tool ตั้งมีผลกับ repo นั้นจนกว่าจะมี scope สูงกว่าทับ นี่เป็น compatibility case ที่ใกล้ setup งาน/ส่วนตัวของผู้ใช้ โดยยังไม่ได้เชื่อมต่อพิสูจน์ว่า server ยอมรับ key ใด [edit auto-apply](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/ops/ops.go#L67), [Apply](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/gitx/gitx.go#L79)

### การรักษา config และ custom target

- Native remote include, header/tail comments, alias และ helper values `manager`/`cache` ยังอยู่ใน fixture นี้
- Initial CRLF 12 จุด หลังแก้เหลือ CRLF 10 จุดและ bare LF 6 จุด จึงไม่ใช่ byte-lossless writer แม้ใช้ Git แก้ไฟล์
- ตั้ง `GIT_CONFIG_GLOBAL` ไป custom file แล้วสั่ง `use personal`: custom file เปลี่ยน ส่วน fake `~/.gitconfig` ไม่เปลี่ยน **honor env path ได้ใน probe นี้** เพราะ write delegate ไป Git
- Existing local `core.sshCommand` ไม่ถูก global use ทับ; effective read ของ tool เห็น local value ตาม Git

## Tests ที่รันจริง

| คำสั่ง | ผล |
| --- | --- |
| `go test -count=1 -v ./internal/profile ./internal/gitx` | **10 top-level tests ผ่าน, 1 skip** |
| `go test -count=1 -v -run '^(TestAddUseListRemove\|TestUseRepoOnly\|TestLinkAppliesFolderIdentity\|TestEditReappliesActiveProfile\|TestImportGlobalIdentity)$' .` | **5 tests ผ่าน** |
| `go build -o <temp>/gitswitch.exe .` | ผ่าน |
| Fake-home scenario ตามตาราง | add/edit/use/config/status สำเร็จทั้งหมด; ไม่มี authentication action |

Skip คือ `TestLinkDirStoresRealPath`: เครื่องทดสอบไม่มีสิทธิ์สร้าง Windows symlink จึง **ยังไม่ยืนยัน symlink/alias realpath behavior** Tests ที่ผ่านครอบคลุม per-repo apply ไม่แก้ global, folder link/unlink, editing active profile, config ที่ key path มีช่องว่าง, credential host key และ rule specificity [gitx tests](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/gitx/gitx_test.go), [CLI tests](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/main_test.go)

ไม่ได้รัน TUI full-flow/keygen tests, actual SSH `test`, global guard install/commit-hook execution, clipboard action หรือ full `./...` จึงไม่มีผลยืนยัน interaction กับ terminal/agent/บัญชีจริง

## Module boundary และ dependency

| ส่วน | บทบาท / ข้อจำกัดในการเป็น component |
| --- | --- |
| `internal/profile` | JSON model/store/validation; path override `GITSWITCH_HOME`; ส่วนนี้ไม่มี TUI import แต่เป็น Go `internal` package จึง import จาก module ภายนอกตรง ๆ ไม่ได้ |
| `internal/gitx` | process adapter ของ Git/SSH รวม effective read, profile apply, folder include, key generation, connection test, clipboard; เรียก executable จาก PATH/current cwd โดยตรง ไม่มี port injection |
| `internal/ops` | Add/Edit/Remove/Import orchestration ร่วม CLI/TUI; รวม storage, generated files และ global config side effects; `Edit` อาจ apply ทันทีตาม match global identity |
| `internal/tui` | Bubble Tea/Lip Gloss; เป็น UX แยกจาก `ops` แต่ frontend นี้ไม่ใช่ React component |
| root `main.go` | CLI flags/parser/human-readable output; ไม่มี machine-readable JSON protocol หรือ dry-run/review plan ที่ยืนยันใน command paths นี้ |

`go.mod` มี Bubble Tea/Bubbles/Lip Gloss/termenv และ transitive terminal/clipboard packages; profile/gitx พึ่ง standard library เป็นหลัก แต่ executable root build ดึง TUI ด้วย ไม่ใช่ Rust library ที่ Tauri เรียกใน-process ได้ [go.mod](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/go.mod), [main.go](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/main.go), [ops](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/ops/ops.go)

## Writer, ownership และ failures ที่เห็นจาก source

- `Apply` เรียก Git ตั้ง name → email → SSH → HTTPS username ทีละคำสั่ง; ไม่มี rollback ของคำสั่งก่อนหน้าใน function นี้ หากคำสั่งหลังล้มเหลว การ apply อาจค้างบางส่วน **ยังไม่ได้ fault-injection ทดสอบ**
- Clear global SSH/helper hint ตรวจว่าตรงค่าของ profile ที่รู้จักก่อน เป็น ownership check ที่มีประโยชน์ แต่ไม่ใช่ประวัติ external edits; name/email ยังคงเขียนตามคำสั่งผู้ใช้
- `Store.Save` เขียน fixed `profiles.json.tmp` แล้ว rename; ไม่มี lock ใน path นี้ การเขียนพร้อมกันยังไม่ทดสอบ
- `WriteConfigFile` เขียน generated profile config ตรง; เป็นคนละ behavior กับ store atomic save ไม่มี multi-file journal/Undo ใน path ที่ตรวจ
- `LinkDir` ใช้ native `includeIf gitdir/i:` และ resolve directory path; การนำไปแทน remote-based rules เปลี่ยนเงื่อนไข ไม่ใช่ equivalent import
- `SSHCommand` ใส่ `IdentitiesOnly=yes` จริง; connection test ใช้ `StrictHostKeyChecking=accept-new` และ timeout 20 วินาที จึงอาจแก้ known_hosts เมื่อเรียก แต่ **ไม่ได้รัน connection test ในงานนี้**
- Keygen default ใช้ ED25519 แบบไม่มี passphrase ตาม source/README; **ไม่ได้รัน keygen**

หลักฐาน: [store](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/profile/profile.go#L78), [Git/key/connection adapter](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/gitx/gitx.go), [hooks](https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/gitx/hooks.go)

## สิ่งที่ควรศึกษาและคำถามที่ยังเปิด

- `gitx.Apply`/ownership helper เป็นตัวอย่างการแก้ key เฉพาะรายการผ่าน Git และรักษา key ที่ tool ไม่ได้เป็นเจ้าของ
- `LinkDir`, `ExpectedFor`, `SamePath` และ tests เป็นตัวอย่าง Windows directory-rule behavior; symlink case ยังไม่มีผลจริงในเครื่องนี้
- `ops` เป็น boundary ที่แยก CLI/TUI ได้แล้ว แต่ต้องแยก prepare/review/apply และ inject repository/executable/environment หากจะให้ UI จัดการได้ละเอียด
- ต้องทดสอบ key-scoped compatibility กับ remote-based includes เดิม ไม่ใช้เพียง name/email match เป็นตัวตัดสิน profile ทั้งหมด
- ยังไม่ยืนยัน worktree scope, system config edit, arbitrary key editor, multi-valued key edits, all-origin chain, external write race, partial failure recovery และ granular Undo
- ยังไม่ได้ทดสอบหลาย client/agent, signing, HTTPS credential login หรือ Windows PATH ที่ต่างจาก shell ปัจจุบัน

Raw logs/fixture output ใน temp research root: `switch-package-tests.log`, `switch-cli-tests.log`, `switch-build.log`, `gitswitch-probe.json` ผลนี้จำกัดที่ pinned build และ fixture ที่อธิบาย ไม่รับรอง binary release อื่น
