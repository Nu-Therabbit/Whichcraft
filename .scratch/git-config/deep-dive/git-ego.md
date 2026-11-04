# git-ego — source และ isolated Windows probe

ตรวจ 3 พฤศจิกายน 2026 (Asia/Bangkok) เป็นข้อมูลสำหรับประเมินต่อ ยังไม่มีข้อสรุปว่าจะ fork หรือพัฒนาเอง

## Revision และวิธีตรวจ

- Repository: [bgreenwell/git-ego](https://github.com/bgreenwell/git-ego)
- Commit ที่ดาวน์โหลดและ build: [`0852c227c7a36d02be3ac5bf0399c2fd07637251`](https://github.com/bgreenwell/git-ego/tree/0852c227c7a36d02be3ac5bf0399c2fd07637251)
- Archive SHA256: `39CD83B73CC04BBE571399047FB3001ED06601179D5A2CEF80B8860DF96A9A94`
- เก็บ source และ binary ใน unique temp directory `C:\Users\Nuniozzz\AppData\Local\Temp\whichcraft-git-deep-e42081da58e54bd5a02c71f5ea7373a3\` ไม่เพิ่ม upstream source ลง repo
- เครื่องทดสอบ: Windows amd64, Go `1.27.0`, Git for Windows `2.56.0.windows.3`; source ต้องการ Go 1.24
- License root: [MIT](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/LICENSE) อ่านตัวบทแล้ว ไม่ได้ audit licenses ของ dependencies ทั้งหมด

อ่าน tests และ smoke script ก่อนเลือกคำสั่ง รันเฉพาะ config/utils tests และ local config CLI ไม่มี login, keygen, agent, SSH connection หรือ credential-store operation ใช้ child-process environment แยก `HOME`, `USERPROFILE`, `APPDATA`, `XDG_CONFIG_HOME`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_COUNT=0`; Go cache/module cache อยู่ใต้ temp เดียวกัน การดาวน์โหลด modules เกิดระหว่าง build แต่ runtime probe ไม่ติดต่อ remote

## ผลใหม่ที่ทดสอบจริง

ตั้ง fake home ที่มี personal name/email, alias/comment, credential helper สองรายการ และ native `includeIf "hasconfig:remote.*.url:git@bitbucket.org:*/**"` ไปไฟล์ work identity สร้าง repo เปล่าและ remote URL จำลองของ Bitbucket โดยไม่เชื่อมต่อ ใช้ key path ของไฟล์ placeholder ไม่ใช่กุญแจจริง

| ขั้นตอน | ผลที่ตรวจด้วย Git พร้อม `--show-origin` |
| --- | --- |
| ก่อนใช้โปรแกรม | name/email งานจาก `work.gitconfig` ตาม remote include |
| `add personal --name ... --email ... --ssh-key <fixture>` | ยังเป็นตัวตนงาน; โปรแกรมเพิ่ม managed include แต่ default profile ยังว่าง |
| `use personal` | **กลายเป็น personal name/email** จาก `.gitego/profiles/personal.gitconfig` แม้ remote include เดิมยังตรง |
| `status` หลัง global use | exit 0 และ `Consistent: yes`; origin ของ **profile marker** เป็นไฟล์ personal ไม่ได้เตือนว่ากฎ Bitbucket เดิมถูกทับ |
| เพิ่ม local `user.email=local@example.test` และ `core.sshCommand` | local email/SSH command ชนะตาม Git; name ยังมาจาก managed personal |
| `status` หลัง local override | exit 1 และบอก effective name/email ไม่ตรง profile; **ตรวจ inconsistency นี้ได้จริง** |

สาเหตุจาก source: `reconcileGlobalGitconfig` บังคับ managed include ไว้ท้าย global และ `writeIncludes` โหลด default profile ก่อน rules ของมันเอง ดังนั้น default ใหม่ถูกอ่านหลัง remote-based include ของเดิม การเก็บข้อความ include เดิมไว้จึงไม่เท่ากับรักษาพฤติกรรมเดิม นี่เป็นผลของ sequence ที่ทดสอบ ไม่ใช่คำอ้างว่ากฎทุกแบบเสีย [reconcile.go](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/config/reconcile.go#L98)

### การคงไฟล์และ custom global path

- Native remote include, header/tail comments, alias และ helpers `manager`/`cache` ยังอยู่ใน fixture นี้
- ไฟล์เริ่มด้วย CRLF 12 จุด หลังเขียนยังมี CRLF 12 จุด แต่เพิ่ม bare LF 5 จุด จึง **ไม่ใช่การคง bytes/newlines เดิมทั้งหมด** ไม่ได้อ้างว่าทุก comment รูปแบบซับซ้อนผ่าน
- ทดสอบตั้ง `GIT_CONFIG_GLOBAL` ไป `custom-global.gitconfig` ใน fake home แล้วสั่ง `use personal`: **โปรแกรมแก้ fake `~/.gitconfig` แต่ไม่แก้ custom-global** เพราะ config path ถูกกำหนดจาก `os.UserHomeDir()` ตอน init ขณะที่คำสั่ง Git read ใช้ environment ตาม Git จึงเกิด write/read target ไม่ตรงกันได้ [path init](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/config/config.go#L86)
- `SSHCommand` สร้าง `ssh -i <quoted-path>` **ไม่มี `IdentitiesOnly=yes`** ใน revision นี้; ทดสอบแค่ค่าที่เขียน ไม่ได้ทดสอบว่า server เลือก key ใด [SSHCommand](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/config/config.go#L524)

## Tests ที่รันจริง

| คำสั่ง | ผล |
| --- | --- |
| `go test -count=1 -v ./config ./utils` | **25 top-level tests ผ่าน**, ไม่มี fail/skip; มี warning cleanup temp file ที่ยังถูกเปิดใน TestLoad_EmptyFile แต่ test ผ่าน |
| `go build -o <temp>/git-ego.exe .` | ผ่าน |
| Fake-home sequence: init/remote/add/use/status/local override/custom global | ทุก mutation ที่ตั้งใจให้สำเร็จ exit 0; status หลัง local override exit 1 ตามตาราง |

Tests ที่ผ่านครอบคลุม exact legacy include cleanup, idempotent reconcile, lock timeout, config escaping, adjacent include preservation, local Git lifecycle และ multi-value helper reads หลักฐานคือ [config tests](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/config/config_test.go), [safety tests](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/config/safety_test.go), [utils tests](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/utils/git_test.go)

ไม่ได้รัน full `./...`, cmd integration suite, GitHub smoke push script, `pat`, credential helper, `doctor --repair`, profile removal/import replacement หรือ connection test เพราะบาง path อ่าน/แก้ OS keychain หรือใช้บัญชี/network จริง [smoke script](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/scripts/gh-account-switch-smoke-test.sh)

## โครงสร้างและ integration boundary

| ส่วน | บทบาทและ coupling |
| --- | --- |
| `config.Profile`, `Config`, `AutoRule` | public Go model; YAML desired state มี profile marker และ internal credential ID; rules เป็น directory path ไม่ใช่ arbitrary native remote conditions |
| `config.Load/Save/Reconcile` | file I/O และ global path ผูกกับ package init; `Reconcile` สร้าง profiles/default/includes และแก้ global โดยตรง ไม่มี plan object |
| `config.WithLock` | serialize instance ของโปรแกรมที่ใช้ lock ของมัน; ไม่ใช่การล็อกที่ external Git/editor ต้องร่วมใช้ |
| `atomic.go`, `replace_windows.go` | temp file + fsync + Windows MoveFileEx replace/write-through; เป็น atomic ต่อไฟล์ ไม่ใช่ transaction ทุก artifact หรือ external-edit conflict detection |
| `utils/git.go` | เรียก executable `git` จาก PATH; อ่านค่าจริง/ต้นทางได้ แต่ยังไม่ได้ inject Git installation หรือ working directory ผ่าน port แบบ Whichcraft |
| `cmd/` | Cobra root และ flag globals; runners ที่ tests inject เป็น unexported และบางฟังก์ชันพิมพ์ stdout/stderr โดยตรง |
| `cmd/resolution.go` | อ่าน effective marker + name/email, expected directory rule หรือ `.gitego` assertion; origin เป็นของ marker ไม่ใช่ origin แยกทุก key |
| `config/keyring.go`, `cmd/credential.go` | OS keyring service `gitego` และ Git helper protocol; นี่เป็น subsystem credentials เพิ่มจาก config viewer |

Dependencies หลัก: Cobra/pflag, yaml.v3, shellescape, gofrs/flock, go-keyring, x/sys; Windows keyring ผ่าน wincred จาก module tree Tauri/Rust ไม่สามารถ import Go package ตรง ๆ ได้ รูปแบบ subprocess มีอยู่ แต่ CLI ที่ตรวจเป็น human-readable text ไม่มี JSON protocol/dry-run/Apply plan ที่ยืนยันใน flags ดังนั้นยังไม่มีสัญญา API สำหรับ UI พร้อมใช้ [go.mod](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/go.mod), [CLI root](https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/cmd/root.go)

## ส่วนที่ควรศึกษาและคำถามที่ยังเปิด

- ศึกษา `cmd/resolution.go` เรื่อง effective/expected/consistency และ marker provenance แต่แยกจาก arbitrary-key source chain
- ศึกษา generated-file ownership + reconciliation และ atomic Windows writer; ต้องกำหนดลำดับ native includes เดิมอย่างชัดเจนก่อนนำแนวคิดไปใช้
- Profile export ละ credential IDs/PATs เป็นตัวอย่างแยก portable data จาก secret state; ยังไม่ได้ทดสอบ export/import จริง
- ต้องพิสูจน์ native remote rules ทั้งสี่แบบที่พบในเครื่องผู้ใช้, local/worktree scope,หลาย remote, malformed includes, race กับ Git/editor, failure กลางหลายไฟล์ และ granular Undo
- ยังไม่ได้ทดสอบ generated signing config กับ Git จริงหรือการเลือก SSH client/agent; package tests ที่ผ่านไม่แทน end-to-end signing/authentication
- ยังต้องแยก path resolver และ process runner ให้รับ context ก่อนประเมินการใช้เป็น component ได้

Raw logs และ JSON ของ fixture อยู่ใน temp research root: `ego-package-tests.log`, `ego-build.log`, `git-ego-probe.json` ใช้ fictional identities `*@example.test` ทั้งหมด ผลข้างต้นจำกัดที่ pinned source build นี้ ไม่รับรองว่าตรงกับ binary release อื่น
