# Git config และ SSH — เปรียบเทียบ open source เพื่อเลือกแนวทาง Whichcraft

ตรวจวันที่ **3 พฤศจิกายน 2026 (Asia/Bangkok)**

**ผลตรวจต่อรอบใหม่:** มี [รายงาน deep dive ห้าตัว](deep-dive/README.md) ที่แยกโมดูลและรัน tests/fixtures บน Windows แล้ว พบรายละเอียดเพิ่มเรื่อง remote include compatibility, stale writes, backup collisions และ CLI/API boundaries ใช้รายงานใหม่ประกอบก่อนตัดสิน fork หรือเขียนเอง โดยตารางด้านล่างยังเป็นภาพรวมจากรอบคัดกรอง

## ผลที่ควรใช้ตัดสินใจ

เมื่ออ่าน implementation เพิ่ม คำแนะนำละเอียดกว่าการเลือกจากฟีเจอร์ใน README:

- **Git identity/rules:** ศึกษา `gitswitch` สำหรับ native directory includes และ scope; `git-ego` สำหรับ effective profile, origin และ credentials; `gitch` สำหรับ rules/guard; `DevSwitch` สำหรับ UX รวม Git กับ keys
- **SSH editor ใน Rust:** ศึกษา document model/Windows writer ของ `ssh-manager-tui` โดยต้องเสริม include handling, conflict check และ Undo
- **SSH GUI ใน stack เดียวกัน:** `SSH-AT` มี Tauri/React/Rust แต่ parser/writer ที่ตรวจทำข้อมูลเดิมหายได้ จึงเหมาะศึกษา UI มากกว่านำ backend มาใช้กับ config เครื่องนี้ทันที
- **SSH editor ที่รักษา source:** `soulteary/ssh-config v3` มีหลักฐาน implementation ที่น่าสนใจที่สุดในชุด library/CLI ที่ตรวจ แต่เป็น Go และไม่ได้ resolve Host/Match ให้
- **การอธิบาย config:** `SSH Config Manager` เป็นตัวอย่าง UX ของ resolved value/source และ linting ที่ดี แม้เอกสารระบุแพลตฟอร์ม macOS/Linux
- **การอ่าน Git config จริง:** ใช้ Git executable ที่กำลังตรวจเป็นตัว resolve ก่อน เพราะ remote-based `includeIf` ของเครื่องนี้เป็นจุดที่ library บางตัวมีช่องว่าง

ทั้งหมดข้างบนเป็นข้อเสนอจากการอ่านหลักฐาน ยังไม่ได้เลือก dependency, fork หรือเพิ่มโค้ดแอป

## วิธีอ่านผล

เปรียบเทียบ 17 แอป/เครื่องมือ และ 6 library/CLI building blocks โดยแบ่งตามงาน ไม่จัดอันดับจากจำนวนดาว

**มี** = พบหลักฐานจาก docs หรือ source ตามที่อ้าง; **จำกัด** = มีแต่มีขอบเขต; **?** = ยังยืนยันไม่ได้ ไม่ได้แปลว่าไม่มี; **ไม่ทำใน path ที่ตรวจ** = source ของเส้นทางนั้นไม่ทำ ไม่มีการติดตั้ง/build/run แอปเหล่านี้ และไม่ได้ทดลองเขียน config ส่วนตัว

สองแอป SSH, หกเครื่องมือ Git และส่วนประกอบสำคัญมีการอ่าน implementation; ตัวอื่นบางรายการตรวจเอกสารเท่านั้น Source บน branch อาจใหม่กว่า binary ที่ release แล้ว ตารางไม่ได้รับรองว่ารุ่นแจกจ่ายทำได้ตรงกันทุกข้อ

## 1. Git: ความสามารถที่ผู้ใช้ได้

ชื่อในตารางลิงก์ไป primary repo; source ที่ pin, LICENSE และ workflow แยกรายละเอียดใน [Git implementation report](comparison-apps.md)

| Feature | [DevSwitch](https://github.com/umesh-saini/DevSwitch) | [git-ego](https://github.com/bgreenwell/git-ego) | [gitch](https://github.com/orzazade/gitch) | [gitswitch](https://github.com/uzairrehman4/gitswitch) |
| --- | --- | --- | --- | --- |
| Interface | Desktop GUI + CLI | CLI | CLI/TUI + VS Code | CLI/TUI |
| Stack / license | Electron + React/TS; MIT | Go; MIT | Go; MIT | Go; MIT |
| Windows evidence | build workflow; agent อาจต้องตั้งเพิ่ม | Windows test CI | Windows binary target; test CI ที่อ่านเน้น Linux/macOS | Windows test CI + binary build |
| ชื่อ/อีเมลหลายชุด | มี | มี | มี | มี |
| Scope ที่เขียน | global switch; local สำหรับ project flow | global/default + local | global + local | global + local |
| Worktree config editor | ? | ? | ไม่มี scope นี้ใน adapter ที่อ่าน | ไม่มี scope นี้ใน adapter ที่อ่าน |
| สลับตามโฟลเดอร์ด้วย native Git includeIf | ไม่พบใน switch path | มี gitdir includes | มี own rules; import gitdir includes ได้ | มี gitdir/i includes |
| สลับตาม remote | host aliases/เลือก profile | native remote include management ? | มี own directory/remote matcher ผ่าน integration | native remote include management ? |
| จัดการ native remote hasconfig เดิมแบบเครื่องนี้ | ? | ? | own rule ไม่ใช่ native hasconfig | ? |
| แสดงค่าที่มีผลจริง + ที่มา | project identity บางส่วน; origin chain ? | มี effective profile/origin/consistency | identity + rule details; origin chain ? | status อ่าน effective values; origin chain ? |
| Arbitrary config key editor | ยังไม่ยืนยัน | ยังไม่ยืนยัน | ยังไม่ยืนยัน | ยังไม่ยืนยัน |
| Existing SSH key | มี | มี path/key binding | มี | มี |
| สร้าง keys / agent management | มี generate/import/agent | lifecycle ? | มี generate/agent | มี generate; agent manager ? |
| Signing | ? | signing settings | GPG lifecycle/settings | ? |
| HTTPS credentials | GitHub OAuth ตาม docs | credential helper + OS keychain PAT | ? | username hint โดยใช้ helper เดิม |
| ป้องกัน commit ผิดตัวตน | diagnostics/test | optional check + consistency | guard/rules/audit | guard/doctor |
| Preview diff ก่อน Apply ทุก write | ? | ? | ? | ? |
| Granular Undo รักษา external edits | ยังไม่ยืนยัน | ยังไม่ยืนยัน | ยังไม่ยืนยัน | ยังไม่ยืนยัน |

อ่าน LICENSE ของทั้งสี่ที่ revision ในรายงานย่อยแล้วว่า MIT; ไม่ใช่การประเมิน license ของ dependencies ทั้งชุด

**ความต่างที่กระทบ setup นี้:** native directory includes ทำงานจาก Git เองต่างจากแอปที่ต้องรัน matcher ผ่าน shell/editor/hook และทั้งสองอย่างยังไม่เท่ากับการจัดการ `hasconfig:remote.*.url` ที่คุณตั้งตาม Bitbucket ไว้ การ import ต้องรักษากฎเดิม ไม่ย้ายเป็น directory rules โดยเรียกว่าเทียบเท่า

### ตัวเทียบ Git เพิ่มเติม

| โครงการ | สิ่งที่เพิ่มจากสี่ตัวหลัก | ข้อจำกัด / เหมาะใช้ศึกษา |
| --- | --- | --- |
| [GPM](https://github.com/agc93/git-profile-manager) — .NET CLI, MIT | profiles เป็นชุด key/value อิสระ ตั้งค่า Git พื้นฐานหรือ advanced ได้เป็น bundle | metadata last push 2020; deactivate ใช้ unset ตาม profile ไม่ได้เก็บค่าก่อนหน้า จึงไม่ใช่ Undo แบบที่ Whichcraft ต้องการ |
| [gh-account-switcher](https://github.com/calghar/gh-account-switcher) — Go, MIT | profiles, SSH/GPG, directory include rules | status source ที่อ่านใช้ global เท่านั้น; อาจไม่สะท้อน local override; SSH command มี `-F /dev/null` ที่ต้องประเมิน Windows เพิ่ม |
| [Git Extensions](https://github.com/gitextensions/gitextensions) — Windows GUI, GPLv3 | GUI แก้ค่าที่ใช้บ่อยของ Git ทั้ง global/local, editor/diff/merge/line endings; เลือก Git executable ได้ | เป็น Git client เต็มตัว; ไม่ได้ยืนยัน arbitrary-key provenance inspector, native remote-rule editor หรือ config Undo ครบจาก docs |

GPM/gh-account-switcher อ้างอิง source ในรายงานย่อย; Git Extensions อ้างอิง [Settings documentation](https://git-extensions-documentation.readthedocs.io/en/main/settings.html#config) และ [LICENSE](https://github.com/gitextensions/gitextensions/blob/master/LICENSE.md) อ่านเอกสาร/ตัวบทแล้วแต่ยังไม่ได้ audit writer

## 2. SSH: เปรียบเทียบ editor ที่ทำงานกับ config เดิม

| Feature | [SSH-AT](https://github.com/baerwang/ssh-at) | [ssh-manager-tui](https://github.com/nakaba-lab/ssh-manager-tui) | [sshush](https://github.com/s-johri/sshush) | [SSH Config Manager](https://github.com/CodeLieutenant/sshconfigmanager) |
| --- | --- | --- | --- | --- |
| UI / stack | GUI, Tauri2 + React + Rust | TUI, Rust/Ratatui | TUI, Go | SwiftUI/macOS + GTK/Linux, Swift core |
| License | Apache-2.0 | MIT OR Apache-2.0 | ระบุ MIT; รอบแรกยังอ่านตัวบทไม่ได้ | Apache-2.0 |
| Windows | พบ MSI/EXE + workflow | พบ MSVC ZIP | ยังไม่ยืนยัน native release/agent | เอกสารระบุ macOS/Linux |
| แก้ไฟล์ ~/.ssh/config จริง | มี | มี | มี | มี |
| Form editor | มี | มี | มี | มี |
| Raw editor | Monaco แต่ผ่าน model ก่อน/หลัง save | ? | editor หลักเป็นโครงสร้าง | raw ราย block |
| Comments/order/unknown options | parser/writer ที่อ่านตัด/จัดใหม่ | เก็บบรรทัดเดิมส่วนใหญ่ | docs ระบุรักษา; formatting อาจเปลี่ยน | มี line-preserving model/tests |
| CRLF/BOM | writer ใช้ LF; BOM ? | CRLF ได้; ตัด BOM; normalize mixed endings | docs เตือน first save อาจ normalize | มี tests สำหรับ CRLF/BOM/byte round trip |
| IdentityFile หลายรายการ | scalar; ตัวหลังทับ | มี multi-value model | ยังไม่ได้ audit รายละเอียด | มี repeated-key model/tests |
| Include | flatten ท้าย model; semantics/ไฟล์อ้างอิงอาจหายเมื่อ save | เก็บ directive แต่ไม่ enumerate hosts จากไฟล์ลูก | docs ระบุตาม Include | graph + inline expansion; flat overload มีข้อจำกัด |
| Match | ไม่แยก structural block | เก็บ opaque; ไม่ resolve ทั้งหมด | อ่านอย่างเดียว | static resolve เฉพาะบาง criteria |
| Effective values + ที่มา | ยังไม่ยืนยัน | บาง flow เรียก ssh -G; include guard ยังไม่ครบ | ยังไม่ยืนยันครบ | มี value/source; Match ยังจำกัด |
| Preview diff | ไม่พบใน flow ที่อ่าน | form มี; shortcuts บางทาง save ตรง | ? | มี editor undo/history; universal pre-Apply diff ? |
| Backup/restore | timestamped ทั้งไฟล์ | config.bak หนึ่งครั้ง/session | backup ก่อนเขียน | history/snapshots ตาม docs |
| Undo | restore ทั้งไฟล์; granular ? | ยังไม่พบ granular Undo | ยังไม่ยืนยัน | editor snapshot Undo/Redo; ไม่ใช่หลักฐาน three-way Undo |
| External edit conflict | ไม่พบ baseline guard ใน writer | reread ตอน preview แต่ commit ไม่ตรวจซ้ำ | ? | file watching/modification date; commit-time compare guard ? |
| Keys | generate/fingerprint/copy | generate/fingerprint/copy/set IdentityFile | keys/agent/host mapping | keys/agent UI |
| Known hosts | ? | viewer/remove | ? | management/history |

รายละเอียด source สองคอลัมน์แรกและรุ่นที่ตรวจอยู่ใน [SSH implementation report](../ssh/comparison-apps.md); sshush อ้างอิง [README](https://github.com/s-johri/sshush#features) ระดับเอกสาร; SSH Config Manager มี [รายงาน source/tests แยก](../ssh/comparison-reference-app.md)

### จุดที่ต้องแก้ความเข้าใจจากการดู README อย่างเดียว

1. **SSH-AT ใช้ stack เดียวกับเรา แต่ไม่ได้รักษาไฟล์เดิมครบ:** parser ที่ถูกเรียกจริงตัด comment/blank, extras เป็น HashMap, IdentityFile เป็น scalar และ serialize ใหม่ แม้ Monaco ก็โหลด/บันทึกผ่าน model เส้นทางเดียวกัน [active parser](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/crates/ssh-at-core/src/config/simple_parser.rs), [editor](https://github.com/baerwang/ssh-at/blob/4daae39288bb90d2b53f75257580a385e12f6709/src/pages/ConfigEditorPage.tsx)
2. **ssh-manager-tui เป็นแหล่งศึกษา Rust writer ที่ดีกว่า แต่คำว่า lossless มีขอบเขต:** BOM/mixed-newline เปลี่ยนได้ และ Include ยังไม่ถูกอ่านเป็น graph จึงยังไม่ใช่ inspector ครบ semantics [parser](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/parser.rs), [writer](https://github.com/nakaba-lab/ssh-manager-tui/blob/ae755cf551b9811e7d4791b5910792b1a986c4ab/src/config/writer.rs)
3. **SSH Config Manager มี Undo/Redo และ resolver จริง:** source มี snapshot edit pipeline กับ resolved source แต่ Match บางเงื่อนไขถูกข้าม จึงยังไม่เท่ากับ OpenSSH ทุกกรณี [resolver](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/Packages/SSHConfigKit/Sources/SSHConfigCore/Logic/EffectiveConfigResolver.swift), [Undo](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/Packages/SSHConfigMacUI/Sources/SSHConfigMacUI/State/ConfigStore/ConfigStore+EditPipeline.swift)

## 3. SSH clients และ key manager เพิ่มเติม

กลุ่มนี้มีประโยชน์ถ้าจะเชื่อมต่อ server/terminal แต่ต้องแยกจาก editor ที่ตั้งค่าให้ Git และ terminal อื่นใช้ร่วมกัน

| โครงการ | Platform/stack/license ที่ตรวจ | จุดเด่น | ความสัมพันธ์กับโจทย์ Whichcraft |
| --- | --- | --- | --- |
| [OpenSSH-GUI](https://github.com/frequency403/OpenSSH-GUI) | Windows/macOS/Linux; Avalonia/.NET; MIT | keys/fingerprints/passphrase/formats/known_hosts/authorized_keys | README ระบุ **config editing ยังเป็น placeholder**; ดู key UI ได้ |
| [sshs](https://github.com/quantumsheep/sshs) | Windows releases; Rust TUI; MIT | ค้นหา host ใน config แล้ว launch SSH | ดู host browser; ไม่พบหลักฐาน full config/key lifecycle editor |
| [SSH Pilot](https://github.com/mfat/sshpilot) | README ระบุ Windows installer; Python/GTK; GPLv3 | terminal/SFTP/key transfer/known_hosts | GUI client เต็มตัว; preservation/Undo ของ config ยังไม่ได้ audit |
| [OmnySSH](https://github.com/timhartmann7/omnyssh) | Windows GUI/TUI assets; Rust; Apache-2.0 | dashboard/terminal/SFTP/forwarding/one-click remote key setup | README ระบุอ่าน config เดิมแต่ **ไม่เขียนกลับ**; key setup มีผลที่ remote server |
| [Reach](https://github.com/alexandrosnt/Reach) | README ระบุ Windows EXE/MSI; Tauri2/Svelte/Rust/russh; MIT | terminal/SFTP/tunnels/vault/remote management | ใช้ SSH engine ของตัวเอง; ยังไม่ยืนยัน writer semantics หรือผลตรงกับ OpenSSH ที่ Git เรียก |
| [Tabby](https://github.com/Eugeny/tabby) | Windows/macOS/Linux; Electron/TypeScript; MIT | terminal/SSH sessions/jump hosts/forwarding; Windows OpenSSH และ Pageant integration | มี OpenSSH profile importer; ยังไม่ได้ยืนยัน lossless write-back editor จาก source ที่อ่าน |

สี่ตัวแรกอ้างอิง [community notes](../ssh/community.md) และ [implementation report](../ssh/comparison-apps.md); Tabby อ้างอิง [README](https://github.com/Eugeny/tabby), [SSH importer](https://github.com/Eugeny/tabby/blob/master/tabby-electron/src/sshImporters.ts), [MIT LICENSE](https://github.com/Eugeny/tabby/blob/master/LICENSE) โค้ด importer เป็น branch ที่ไม่ได้ pin และยังไม่ได้ audit ทุกเส้นทาง

## 4. ส่วนประกอบที่อาจใช้แทนการเขียนทุกอย่างเอง

| Component | เหมาะทำอะไร | ช่องว่างที่สำคัญ |
| --- | --- | --- |
| [gix-config](https://docs.rs/gix-config/latest/gix_config/) — Rust, MIT/Apache-2.0 metadata | Git file model/provenance/mostly-lossless edits | เอกสารระบุ include semantics ต่างจาก Git บางกรณี; ต้องพิสูจน์กับ Git จริง |
| [git2/libgit2](https://docs.rs/git2/latest/git2/struct.Config.html) — Rust/C | ใช้ Git APIs/config ระดับทั่วไป | source ที่ตรวจไม่พบ handler ของ remote hasconfig แบบเครื่องนี้; อย่าใช้เป็น resolver แทน Git โดยสมมติว่าเทียบเท่า |
| [soulteary/ssh-config v3](https://github.com/soulteary/ssh-config) — Go CLI/library, Apache-2.0 | source-preserving CST, edit ราย node, Include graph, JSON/YAML transport | ไม่ evaluate Host/Match; atomic save ยังต้องมี external-edit guard/Undo จากแอป; ไม่ใช่ Rust crate |
| [cyjake/ssh-config](https://github.com/cyjake/ssh-config) — TypeScript/Node, MIT | parse/edit/compute; รักษา whitespace/comments | compute เปิด Match exec โดย default; มี Node APIs; CRLF guarantee ยังไม่ยืนยัน |
| [ssh2-config](https://github.com/veeso/ssh2-config) — Rust, MIT | typed parse/query/serialize subset | docs ยังระบุ Match/tokens ขาด; source-preserving editor ยังไม่ยืนยัน |
| [kevinburke/ssh_config](https://github.com/kevinburke/ssh_config) — Go | comment-preserving AST/lookup/Include | ไม่รองรับ Match ตาม README; ไม่ใช่ Rust dependency |

รายละเอียดเวอร์ชัน, license, source ของ writer, semantic caveats และความหมายของ unknown อยู่ใน [Library comparison](comparison-libraries.md) ไม่ควรตีความการมี serializer ว่าปลอดภัยสำหรับเขียนทับ merged effective config

## 5. เทียบกับเคสในเครื่องนี้

| เคสที่ต้องทำได้ | ตัวอย่าง community ที่น่าเริ่ม | สิ่งที่ Whichcraft ยังต้องเพิ่ม/พิสูจน์ |
| --- | --- | --- |
| Bitbucket remote โหลดอีเมลงาน แล้ว repo-local อาจทับ | git-ego มี profile provenance; gitswitch มี native include ownership | preserve/อธิบาย remote hasconfig เดิม; local/worktree/command context; ไม่ย้ายกฎไป directory โดยพลการ |
| Whichcraft ใช้ noreply email + core.sshCommand ของตัวเอง | DevSwitch/gitswitch/gitch มี identity↔key flow | แสดง commit identity แยกจาก authentication และ Git/SSH executable ที่ตรวจ |
| เปลี่ยน IdentityFile โดยคง comment/CRLF/Include | ssh-manager Rust model; soulteary CST; SSH Config Manager tests | fixture parity, BOM/mixed-newline policy, repeated keys, Match/Include provenance และ file ACL behavior บน Windows |
| โปรแกรมอื่นแก้ config หลัง preview | บางตัวมี atomic write, backup หรือ watcher | baseline compare ก่อน commit, conflict UI, recovery หลายไฟล์ และ Undo เฉพาะสิ่งที่แอปเปลี่ยน |
| Windows OpenSSH กับ Git-bundled SSH อยู่พร้อมกัน | client/agent UI จากหลายโครงการ | ระบุ executable/environment ของ context จริง; ไม่เหมารวม agent และ config ทุก process |

## 6. ข้อเสนอในการเลือกใช้

**ใช้ทันทีเป็นแอปแยก:** เลือกตามงาน — GUI identities/keys ดู DevSwitch; native Git directory rules ดู gitswitch/git-ego; SSH config TUI ดู ssh-manager/sshush; server terminal ดู Tabby/SSH Pilot/OmnySSH/Reach การเลือกใช้งานจริงยังต้องลองใน sandbox ของ config สำเนา เพราะงานนี้เป็นเอกสารและ source audit

**นำมาเป็นฐานของ Whichcraft:** เริ่มด้วย adapter ที่ใช้ Git ตัวจริง resolve + physical-file editor ที่รักษาโครงไฟล์; ศึกษา Rust model ของ ssh-manager หรือ CST ของ soulteary ส่วน UI ใช้ DevSwitch/SSH-AT/SSH Config Manager เป็นตัวเทียบ โดยรักษา architecture Rust ports/application และ React MVI ของ repo

**ส่วนที่เป็นคุณค่าของ Whichcraft:** อธิบายค่าที่มีผลจริงต่อ repo พร้อมแหล่งที่มาและ executable, เชื่อม Git identity กับ SSH references, รักษา config ที่ผู้ใช้มีอยู่ และ review/Apply/Undo ที่รองรับ external edits ทั้งชุดนี้ยังไม่พบหลักฐานครบในเครื่องมือเดียวที่ตรวจ

หากจะพิสูจน์ต่อ ควรทำ fixture เล็ก ๆ จากรูปแบบของเครื่องนี้โดยใช้ค่าตัวอย่าง: remote includes สี่แบบ, local noreply override, SSH Include/Match/repeated IdentityFile, CRLF/BOM, unknown directives และ external edit ระหว่าง preview/save ยังไม่ต้องแตะ config จริงหรือเพิ่ม full SSH terminal เข้าแอป

## รายงานหลักฐาน

- [Git tools: matrices + pinned source/LICENSE/Windows CI](comparison-apps.md)
- [SSH apps: parser/writer/backup/preview/Windows releases](../ssh/comparison-apps.md)
- [SSH Config Manager: resolver/Undo/CRLF tests](../ssh/comparison-reference-app.md)
- [Libraries: source-preserving edits และ semantic gaps](comparison-libraries.md)

รายงานนี้เพิ่มรายละเอียดและแก้จุดที่ยังไม่ยืนยันจาก community notes รอบแรก โดยคงไฟล์เก่าไว้เป็นบันทึกการสำรวจ ไม่ได้อ้างว่าแอปที่มี backup/atomic write จะให้ granular Undo หรือ external-edit protection โดยอัตโนมัติ
