# Git config และตัวตน Git — เปรียบเทียบ community เพิ่มเติม

ตรวจ 3 พฤศจิกายน 2026 (Asia/Bangkok) จาก primary repository, README, workflow และ source ที่ pin ด้วย commit ด้านล่าง ไม่ติดตั้งโปรแกรม ไม่รันโค้ดจากโครงการเหล่านี้ ไม่แก้ config จริงของผู้ใช้

สัญลักษณ์: **มี** = พบหลักฐานเฉพาะฟีเจอร์จากเอกสารหรือ source; **บางส่วน** = ทำได้เฉพาะบริบทที่อธิบาย; **?** = ยังไม่พบหลักฐานพอ ไม่เท่ากับไม่มี; **ไม่มีใน path ที่ตรวจ** = implementation ที่ระบุไม่ทำสิ่งนั้น การมี workflow ไม่ได้พิสูจน์ว่า workflow ล่าสุดผ่านหรือครอบคลุมทุกฟีเจอร์

## เปรียบเทียบความสามารถ

| โครงการ | รูปแบบ / แพลตฟอร์ม | แก้ Git config อิสระ | Scope ที่พบ | การสลับอัตโนมัติ | แสดงค่าที่มีผลจริงและที่มา |
| --- | --- | --- | --- | --- | --- |
| [DevSwitch][D] | Electron/React GUI + Node CLI; Windows build workflow | เน้นชื่อ/อีเมล, SSH และ repo remote; ไม่ใช่ arbitrary-key editor ที่ยืนยันแล้ว | global ตอน switch; repo-local ใน clone/update project; worktree ? | native `includeIf` ไม่พบใน switch path; เน้นกด switch/host aliases | อ่านชื่อ/อีเมลจริงต่อ project ได้; ไม่พบ origin/scope chain ใน path ที่ตรวจ |
| [git-ego][E] | Go CLI; Windows/macOS/Linux CI matrix | profile ของ identity/SSH/signing/HTTPS; arbitrary key ? | global/default และ `use --local`; worktree ? | **native `includeIf gitdir:`**; generated include graph | **บางส่วน: effective profile, origin, expectation, consistency**; ไม่ใช่ inspector ทุก key |
| [gitch][G] | Go CLI/TUI + VS Code; Windows binary target, CI tests เน้น Linux/macOS | identity/SSH/GPG fields; arbitrary key ? | effective read, global/local write ตาม Scope enum; ไม่มี worktree scope ใน adapter นี้ | **กฎ directory/remote ของตัวเอง** ผ่าน shell/editor/hooks; import native gitdir includes ได้ | effective identity และ rule detail; origin chain ทุก key ? |
| [gitswitch][S] | Go CLI/TUI; Windows/macOS/Linux test CI | identity + key + HTTPS username hint; arbitrary key ? | global/local; ไม่มี worktree scope ใน gitx adapter | **native `includeIf gitdir/i:`**, ไม่ต้องรอ shell hook | `status` อ่านค่าที่ Git resolve; origin chain ? |
| [Git Profile Manager (GPM)][P] | .NET CLI; repo มี Windows distribution instructions | **มี: profile เป็นชุด key/value อิสระ** | repo-local/default และ global | auto rules ?; ใช้ activate/deactivate เป็นหลัก | effective inspector/origin ? |
| [gh-account-switcher][H] | Go CLI; README และ GoReleaser ระบุ Windows | identity/GPG/SSH profiles; arbitrary key ? | switch global; config ต่อ folder ผ่าน include | **native `includeIf gitdir:`** | **ระวัง: `GetCurrentConfig` อ่าน `--global` เท่านั้น** จึงไม่ยืนยัน local override |

แต่ละ row อ้างอิง README + implementation ที่เจาะลึกในส่วนหลักฐานด้านล่าง `remote rule` ของ gitch เป็นตัว matcher ของแอป จึงห้ามนับว่าเป็น native `includeIf hasconfig:remote.*.url` แบบที่เครื่องผู้ใช้ใช้อยู่

| โครงการ | SSH keys / agent | Signing / HTTPS | ป้องกันผิดตัวตน / Diagnostics | Preview, backup และ Undo | การใช้กับ Whichcraft |
| --- | --- | --- | --- | --- | --- |
| DevSwitch | generate/import/copy public key, SSH aliases และ add-to-agent | signing ?; มี GitHub OAuth ใน README | connection test และ CLI doctor; ไม่เท่ากับ config lint | มี backup ของ data store; SSH writer ที่อ่านเขียนตรงและ normalize whitespace; granular config Undo/conflict check ? | ดู UX React และ profile↔key; shared core ใช้ Node ไม่ใช่ Rust adapter พร้อมใช้ |
| git-ego | ผูก existing SSH path ผ่าน `core.sshCommand`; generation/agent management ? | signing keys; **HTTPS credential helper + OS keychain PAT** | optional commit check, consistency checks, doctor/repair | generated files ใช้ atomic publish/reconciliation; app lock ใน persistence; ไม่พบหลักฐาน granular user Undo หรือ external-file compare-and-swap | ดู model/provenance และ generated include ownership; เพิ่ม credential backend เป็นขอบเขตใหญ่กว่า config editor |
| gitch | generate/link keys, agent add; สร้าง managed aliases ได้ | GPG generate/link; HTTPS auth manager ? | directory/remote rules, pre-commit guard, audit | SSH writer มี `.gitch.backup` และ temp→rename; ไม่มีประวัติ Undo ใน writer ที่อ่าน | ดู matching/guard; กฎของมันมี runtime integration เพิ่มจาก Git config |
| gitswitch | generate ED25519 หรือใช้ existing key; copy/test key; agent manager ? | signing ?; HTTPS **username hint** โดยอาศัย credential helper เดิม | commit guard, doctor, `status`; ไม่ rewrite remotes | profile store atomic; Git set/unset ผ่าน Git; granular Undo/diff preview ? | ตัวเล็กและ Windows CI ชัด; เหมาะศึกษาการจัด scope/ownership |
| GPM | ไม่มี key lifecycle ที่ยืนยัน; ตั้ง SSH config key เป็นข้อความใน profile ได้ | ใส่ signing/helper key ได้ แต่ไม่เท่ากับจัดการกุญแจ/บัญชี | diagnostics เฉพาะ config apply ที่อ่าน; identity guard ? | **deactivate = unset profile key/value ไม่ใช่คืนค่าเก่าที่ถูกทับ** | อ้างอิงแนวคิด arbitrary config bundle; โครงการเก่าตั้งแต่ 2020 |
| gh-account-switcher | alias, per-profile path, README ระบุ platform keychain | GPG; PAT/HTTPS helper ? | current status เน้น global; remote-aware effective check ? | append/create profile files; backup/Undo/race detection ? | ใช้เป็นตัวเทียบแนวคิด; ต้องตรวจ Windows paths และ existing config เพิ่ม |

ข้อควรแยกในการเทียบ: username hint ไม่ใช่ credential store, SSH alias ไม่ใช่การเลือกบัญชี commit, database backup ไม่ใช่ Undo Git/SSH config, atomic rename ไม่ใช่การป้องกันโปรแกรมอื่นแก้ไฟล์แทรก และการมีคำสั่ง deactivate ไม่ได้พิสูจน์ว่าคืนค่าก่อน Apply ได้

## ข้อค้นพบจาก implementation

### DevSwitch

`switchProfile` ตั้ง global name/email เป็นค่าเริ่มต้น ขณะ `gitService` ตั้ง repo-local ตอน clone/update project ได้ `sshConfigService` เปลี่ยนเฉพาะ block ที่มี marker ของตัวเอง แต่ใช้ direct `fs.writeFileSync`, `trim()` และยุบ blank lines; ตัวอ่าน host/key เป็น regex จึงยังไม่ใช่หลักฐานว่าประเมิน Include, Match หรือหลาย IdentityFile ครบ ไม่มี preview/race check ใน write path นี้ [switchProfile][D-profile], [SSH writer/parser][D-ssh], [repo config][D-git]

### git-ego

มี origin จริงสำหรับ status ของ identity/profile (`--show-origin`) และมี generated managed graph จึงใกล้แนวคิดอธิบาย effective config กว่าโปรเจกต์ที่อ่าน global อย่างเดียว แต่ข้อมูลที่ยืนยันยังเป็น profile/identity ไม่ใช่ทุก key ทุก scope `Reconcile` ประกอบ includes ของตนและเขียนกลับ global อย่าง atomic; ต้องทดสอบการคง comment/CRLF และ external editor ร่วมก่อนใช้เป็น editor ของไฟล์ผู้ใช้ [status][E-status], [Git helper][E-git], [reconcile][E-reconcile]

### gitch

Scope enum คือ effective/global/local; apply เขียน author แล้ว signing แล้ว SSH เป็นหลายคำสั่งตามลำดับ และ best-effort add key เข้า agent จึงไม่ใช่ transaction หลายไฟล์ที่ย้อนทั้งชุดได้ `UpdateSSHConfig` มี backup และ atomic rename แต่ยังไม่ใช่ granular Undo `rule from-gitconfig` import เฉพาะ gitdir includes ส่วน remote matching เป็นกฎของ gitch [scope][G-git], [apply][G-apply], [SSH backup][G-ssh], [include importer][G-import]

### gitswitch

`gitx` แยก global/local และอ่าน effective ผ่าน Git; `LinkDir` สร้าง native case-insensitive directory include และใช้ path ที่ resolve แล้ว การ clear SSH/credential global ตรวจว่าเป็นค่าที่ tool รู้จักก่อน ถือเป็น ownership check ที่มีประโยชน์ แต่ไม่ใช่ external-edit history ส่วน key generation ที่ README ระบุใช้ **ไม่มี passphrase** โดย default; ใช้ existing protected key ได้ ไม่ควรนำ default นี้มาใช้ใน Whichcraft โดยไม่ได้เลือก UX ให้ชัด [Git implementation][S-git], [README][S]

### GPM และ gh-account-switcher

GPM ใช้ profile ของ arbitrary key/value แล้วเรียก Git ทีละ key; deactivate เรียก `git config --unset <key> <profile-value>` จึงไม่ได้เก็บ/คืน previous value [profile model][P-profiles], [set/unset][P-git], [deactivate][P-deactivate]

gh-account-switcher สร้าง profile file และ include ผ่าน Git แต่ `GetCurrentConfig` อ่าน global name/email/signing เท่านั้น; source สร้าง SSH command ที่มี `-F /dev/null` จึงต้องตรวจความหมายกับ Windows client และความตั้งใจที่จะข้าม user SSH config ก่อนนำรูปแบบนี้มาใช้ [Git config code][H-git], [SSH aliases][H-ssh]

## Windows, license และเวลาของหลักฐาน

อ่านตัวบท LICENSE ของทั้งหก repo ณ pinned revision แล้ว: **MIT ทั้งหมด** ไม่ได้ประเมิน dependency licenses ทั้งต้นไม้ และยังไม่มีการคัดลอกโค้ด

| โครงการ / revision ที่อ่าน | หลักฐาน Windows | Last push ที่ GitHub API รายงาน (UTC) |
| --- | --- | --- |
| [DevSwitch `b099120`][D-license] | [Windows build job][D-ci]; README เตือนว่า agent อาจต้องตั้งค่าเพิ่ม | 2026-07-12 |
| [git-ego `0852c22`][E-license] | [CI matrix มี windows-latest][E-ci] | 2026-07-25 |
| [gitch `374f7fa`][G-license] | [Windows GoReleaser target][G-release]; [CI][G-ci] ไม่ได้มี Windows ใน test matrix ที่อ่าน | 2026-03-19 |
| [gitswitch `794ea87`][S-license] | [CI ทดสอบ windows-latest และ build windows/amd64][S-ci] | 2026-10-07 |
| [GPM `3aa366a`][P-license] | repo/docs มี Windows packages; ไม่ได้ยืนยัน runtime รุ่นปัจจุบัน | 2020-08-21 |
| [gh-account-switcher `305434b`][H-license] | [GoReleaser][H-release] มี Windows; ไม่ได้ยืนยัน native agent integration | 2025-11-14 |

Last push เป็น metadata ของ repo ไม่ใช่วัน release และไม่ใช่การรับรองคุณภาพ วันที่นี้ได้จาก GitHub API ระหว่างการตรวจ; ควรตรวจซ้ำก่อนเลือก dependency ส่วน README/source บน main อาจใหม่กว่า binary ล่าสุดที่แจก

## ข้อเสนอสำหรับเคสในเครื่องผู้ใช้

1. **จัด native includes และ ownership:** เริ่มศึกษาจาก gitswitch และ git-ego โดยเก็บ Bitbucket remote-based include เดิมไว้ การย้ายเป็น directory rules เป็นการเปลี่ยนพฤติกรรม ไม่ใช่ import ที่เทียบเท่า
2. **GUI ของ keys/profiles:** ใช้ DevSwitch เป็นตัวเทียบ UX แต่ทำ Git/OpenSSH adapter ตาม architecture Whichcraft ไม่ย้าย Node service ไป Rust แบบคัดลอกตรรกะทั้งก้อน
3. **ตรวจตัวตนผิด:** ใช้ status/provenance ของ git-ego และ rule matching/guard ของ gitch เป็นตัวอย่าง โดยแสดง local override ใน repo ของผู้ใช้ก่อนเสนอการแก้
4. **Generic config editor:** GPM แสดงว่ารูปแบบ config bundle ทำได้ แต่ไม่เหมาะเป็นฐานใหม่โดยไม่ประเมิน runtime/maintenance อีกครั้ง ให้เทียบ generic GUI อย่าง Git Extensions แยกจาก identity managers ชุดนี้
5. **สิ่งที่ยังไม่มีหลักฐานครบในหกตัวนี้:** arbitrary-key inspector ทุก system/global/local/worktree scope, UI จัดการ native remote-based includeIf เดิม, review diff ก่อน Apply พร้อม granular Undo ที่รักษา external edits และบอก Git/SSH executable/agent ที่มีผลจริงต่อ repo ครบในที่เดียว

## แหล่งข้อมูลที่ pin

[D]: https://github.com/umesh-saini/DevSwitch/tree/b09912060f9c338fef6ac236e9f1567a3b6113a8
[D-profile]: https://github.com/umesh-saini/DevSwitch/blob/b09912060f9c338fef6ac236e9f1567a3b6113a8/core/services/profileManager.ts#L244
[D-ssh]: https://github.com/umesh-saini/DevSwitch/blob/b09912060f9c338fef6ac236e9f1567a3b6113a8/core/services/sshConfigService.ts#L36
[D-git]: https://github.com/umesh-saini/DevSwitch/blob/b09912060f9c338fef6ac236e9f1567a3b6113a8/core/services/gitService.ts#L83
[D-license]: https://github.com/umesh-saini/DevSwitch/blob/b09912060f9c338fef6ac236e9f1567a3b6113a8/LICENSE
[D-ci]: https://github.com/umesh-saini/DevSwitch/blob/b09912060f9c338fef6ac236e9f1567a3b6113a8/.github/workflows/build-and-publish.yml
[E]: https://github.com/bgreenwell/git-ego/tree/0852c227c7a36d02be3ac5bf0399c2fd07637251
[E-status]: https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/cmd/status.go
[E-git]: https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/utils/git.go#L29
[E-reconcile]: https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/config/reconcile.go
[E-license]: https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/LICENSE
[E-ci]: https://github.com/bgreenwell/git-ego/blob/0852c227c7a36d02be3ac5bf0399c2fd07637251/.github/workflows/go-ci.yml#L46
[G]: https://github.com/orzazade/gitch/tree/374f7fac0a3785420a868519fee7edf861cd6c5e
[G-git]: https://github.com/orzazade/gitch/blob/374f7fac0a3785420a868519fee7edf861cd6c5e/internal/git/config.go#L14
[G-apply]: https://github.com/orzazade/gitch/blob/374f7fac0a3785420a868519fee7edf861cd6c5e/internal/profile/apply.go#L46
[G-ssh]: https://github.com/orzazade/gitch/blob/374f7fac0a3785420a868519fee7edf861cd6c5e/internal/ssh/config.go#L109
[G-import]: https://github.com/orzazade/gitch/blob/374f7fac0a3785420a868519fee7edf861cd6c5e/cmd/rule_from_gitconfig.go#L65
[G-license]: https://github.com/orzazade/gitch/blob/374f7fac0a3785420a868519fee7edf861cd6c5e/LICENSE
[G-release]: https://github.com/orzazade/gitch/blob/374f7fac0a3785420a868519fee7edf861cd6c5e/.goreleaser.yml
[G-ci]: https://github.com/orzazade/gitch/blob/374f7fac0a3785420a868519fee7edf861cd6c5e/.github/workflows/ci.yml
[S]: https://github.com/uzairrehman4/gitswitch/tree/794ea87f44affff11905f2a338eaf7a745164516
[S-git]: https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/internal/gitx/gitx.go
[S-license]: https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/LICENSE
[S-ci]: https://github.com/uzairrehman4/gitswitch/blob/794ea87f44affff11905f2a338eaf7a745164516/.github/workflows/ci.yml
[P]: https://github.com/agc93/git-profile-manager/tree/3aa366a80264b1d24685ff2b8a7607598345d7cb
[P-profiles]: https://github.com/agc93/git-profile-manager/blob/3aa366a80264b1d24685ff2b8a7607598345d7cb/docs/content/en/docs/getting-started/profiles.md
[P-git]: https://github.com/agc93/git-profile-manager/blob/3aa366a80264b1d24685ff2b8a7607598345d7cb/src/GitProfileManager/Services/GitCommandService.cs
[P-deactivate]: https://github.com/agc93/git-profile-manager/blob/3aa366a80264b1d24685ff2b8a7607598345d7cb/src/GitProfileManager/Commands/Deactivate/DeactivateCommand.cs
[P-license]: https://github.com/agc93/git-profile-manager/blob/3aa366a80264b1d24685ff2b8a7607598345d7cb/LICENSE
[H]: https://github.com/calghar/gh-account-switcher/tree/305434b95c89a8923b7ada6d16a7e75e9d0b335c
[H-git]: https://github.com/calghar/gh-account-switcher/blob/305434b95c89a8923b7ada6d16a7e75e9d0b335c/internal/git/config.go
[H-ssh]: https://github.com/calghar/gh-account-switcher/blob/305434b95c89a8923b7ada6d16a7e75e9d0b335c/internal/ssh/config.go
[H-license]: https://github.com/calghar/gh-account-switcher/blob/305434b95c89a8923b7ada6d16a7e75e9d0b335c/LICENSE
[H-release]: https://github.com/calghar/gh-account-switcher/blob/305434b95c89a8923b7ada6d16a7e75e9d0b335c/.goreleaser.yml
