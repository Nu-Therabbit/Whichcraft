# เพิ่มเติม: SSH Config Manager เป็นตัวเทียบด้านการแก้ config

ตรวจวันที่ 3 พฤศจิกายน 2026 (Asia/Bangkok) จากโค้ดสาธารณะ ไม่ได้ build/test โปรแกรม และไม่ได้ใช้ config ของผู้ใช้เป็น input

โครงการ: [CodeLieutenant/sshconfigmanager](https://github.com/CodeLieutenant/sshconfigmanager)

Revision ที่ตรวจ: [`26e9b586cd5813b024226873142e541c2195b209`](https://github.com/CodeLieutenant/sshconfigmanager/tree/26e9b586cd5813b024226873142e541c2195b209), commit date 14 กันยายน 2026 ตาม GitHub API

## ฟีเจอร์กับหลักฐาน

| ประเด็น | สิ่งที่ตรวจพบ | ระดับหลักฐาน |
| --- | --- | --- |
| Platform/stack | macOS SwiftUI และ Linux GTK4/libadwaita ใช้ Swift core ร่วมกัน; เอกสารไม่ได้ระบุ Windows | [เว็บไซต์/README](https://www.sshmanager.app/) |
| License | Apache-2.0 อ่านตัวบทแล้ว | [LICENSE.md](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/LICENSE.md) |
| Structured + raw editor | Host blocks/directives, keyword catalog, autocomplete, raw editing ราย block | เว็บไซต์/README |
| รักษารูปแบบ | model เก็บบรรทัดและการจบไฟล์; บรรทัดที่เพิ่มปรับตาม CRLF เดิม | [SSHConfigDocument.swift](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/Packages/SSHConfigKit/Sources/SSHConfigCore/Model/SSHConfigDocument.swift) |
| Regression cases | มี tests สำหรับ CRLF, repeated IdentityFile, BOM และ round-trip แบบ byte-exact เมื่อไม่แก้ไฟล์ | [ParserCRLFAndBOMTests.swift](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/Packages/SSHConfigMacUI/Tests/SSHConfigMacUITests/ParserCRLFAndBOMTests.swift) — อ่าน tests แต่ไม่ได้รัน |
| Effective config + source | มี resolved setting พร้อม keyword/value/source, first-value semantics และ accumulation ของ repeatable keywords | [EffectiveConfigResolver.swift](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/Packages/SSHConfigKit/Sources/SSHConfigCore/Logic/EffectiveConfigResolver.swift) |
| Include | graph overload แทรก include ที่ตำแหน่ง directive; overload แบบ flat append ทั้งไฟล์ภายหลังมีข้อจำกัดที่ source comment เตือนไว้ | resolver เดียวกัน บรรทัด 47–58, 80–112 |
| Match | static resolver รองรับ `all`/`host` บางส่วน; ข้าม `user`/`exec`/`localuser`; `canonical`/`final` ไม่จำลอง pass ของ OpenSSH เต็มรูปแบบ | resolver บรรทัด 204–225 — จึงไม่เรียกผลว่าเทียบเท่า OpenSSH ทุกกรณี |
| Undo/Redo | ใช้ editor snapshots และ NSUndoManager; คืนเอกสาร/groups/tags แล้ว autosave | [ConfigStore+EditPipeline.swift](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/Packages/SSHConfigMacUI/Sources/SSHConfigMacUI/State/ConfigStore/ConfigStore+EditPipeline.swift) |
| External edits | มี file watchers และเทียบ modification date ก่อน reload/notify; หาก dirty จะจัดการตาม autosave setting | [ConfigStore+FileWatching.swift](https://github.com/CodeLieutenant/sshconfigmanager/blob/26e9b586cd5813b024226873142e541c2195b209/Packages/SSHConfigMacUI/Sources/SSHConfigMacUI/State/ConfigStore/ConfigStore+FileWatching.swift) |
| Granular Undo ที่เก็บ external edits | ยังไม่ยืนยัน; code ที่อ่านเป็น snapshot restore ไม่ใช่หลักฐานว่ามี three-way revert ของแต่ละรายการ | แยกคำถามนี้จากการมี Undo ใน editor และ file watcher |
| Keys / known_hosts / agent / tunnels | มี UI และ core services รวม key inventory/generation, known-host management, agent และ tunnels | เว็บไซต์/README กับ source tree ที่อ่านผ่าน GitHub API; ยังไม่ตรวจทุก implementation |

## นำมาใช้กับ Whichcraft อย่างไร

โครงการนี้น่าศึกษา UX ของ effective configuration พร้อมที่มา, shadowed-directive linting และการรักษาไฟล์มากกว่าการใช้เป็น dependency โดยตรง เพราะไม่มี Windows frontend ที่โครงการระบุและ core เป็น Swift

ผลการอ่านแสดงว่า “มี resolver”, “มี Undo” และ “รักษาไฟล์” เป็นคุณสมบัติที่ต้องแยกประเมิน: resolver ยังมีขอบเขต Match, Undo เป็น editor snapshots และ file watching ไม่ได้พิสูจน์ว่ากัน race ได้ทุกจุด

การตรวจต่อถูกจำกัดด้วย GitHub unauthenticated API rate limit จึงไม่ได้สรุปสิ่งที่ยังไม่ได้อ่าน เช่น commit-time concurrency guard หรือความพร้อมใช้จริงของทุกฟีเจอร์
