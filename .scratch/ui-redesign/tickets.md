# Whichcraft desktop UI — implementation tickets

Status: published
Approved: 2026-10-24

The user approved the original 02–20 breakdown. Review corrections split the removal portion of 18 into 21 so Windows verification gates legacy removal. Tickets 02–21 are separate local issues with status ready-for-agent; blocking edges still determine which work can start. Prototype 01 remains unchanged. The spec and architecture now include those review corrections.

Source: [implementation spec](spec.md) and [architecture review](architecture.md).
Parity baseline: [legacy UI action inventory](ui-action-inventory.md). Review disposition: [checked findings](review-resolution.md).
Completed design source: [01 — tool-first prototype](issues/01-tools-home-prototype.md).

## Tickets

| Ticket | Blocked by | Work |
| --- | --- | --- |
| 02 | None | [ขยาย feature contracts และจุดประกอบ API แบบรักษาความเข้ากันได้](issues/02-expand-feature-contracts.md) |
| 03 | 02 | [ย้าย Environment workflows เข้า feature controller บนหน้าจอเดิม](issues/03-encapsulate-environment.md) |
| 04 | 03 | [ประสานการเขียนและรีเฟรช Tools กับ Environment](issues/04-coordinate-writes-and-refresh.md) |
| 05 | None | [ควบคุมเวลาและ Operation IDs ผ่าน application capability](issues/05-inject-time-and-operation-ids.md) |
| 06 | None | [ให้สถานะและการเตรียม mise ผ่าน application](issues/06-installer-lifecycle-through-application.md) |
| 07 | 02 | [เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A](issues/07-desktop-shell-and-inventory.md) |
| 08 | 04, 05, 07 | [สลับการติดตั้งผ่านแผนจริงและ Undo](issues/08-switch-apply-and-undo.md) |
| 09 | 04, 07 | [แก้ Environment variables ผ่าน workspace ใหม่](issues/09-environment-variables-workspace.md) |
| 10 | 09 | [ใช้ Snapshots จริงจาก Environment](issues/10-environment-snapshots.md) |
| 11 | 09 | [นำเข้าและส่งออก Environment ผ่านไฟล์จริง](issues/11-environment-import-export.md) |
| 12 | 08, 09 | [ตรวจคำสั่ง ผลใน shell และเปิด Terminal จริง](issues/12-command-shell-and-terminal.md) |
| 13 | 04, 06, 07 | [ตั้งค่าที่เก็บและติดตั้งเครื่องมือจาก desktop UI](issues/13-settings-and-install.md) |
| 14 | 08 | [ถอนการติดตั้งพร้อมเลือกตัวแทนและตรวจการใช้งาน](issues/14-uninstall-with-replacement.md) |
| 15 | 13, 14 | [อัปเดตในสายเดิม สลับ และเสนอถอนตัวเก่า](issues/15-update-and-retire-old-installation.md) |
| 16 | 08, 13 | [จัดการและ Apply Tool profiles จาก workspace ใหม่](issues/16-tool-profiles-workspace.md) |
| 17 | 08, 09 | [ดูแล PATH, external changes และกู้คืนงานที่ค้าง](issues/17-diagnostics-cleanup-and-recovery.md) |
| 18 | 10, 11, 12, 15, 16, 17 | [เปิด UI ใหม่เป็นค่าเริ่มต้นใน candidate build พร้อม legacy fallback](issues/18-production-cutover-and-contract.md) |
| 19 | 18 | [ตรวจ Windows จริง: Environment, permissions, shell และ recovery](issues/19-windows-environment-acceptance.md) |
| 20 | 18 | [ตรวจ Windows จริง: inventory และวงจรการติดตั้งเครื่องมือ](issues/20-windows-tool-lifecycle-acceptance.md) |
| 21 | 19, 20 | [ลบ legacy presentation หลังผ่าน Windows acceptance](issues/21-remove-legacy-after-acceptance.md) |

## Initial frontier

- [02 — feature contracts and injection](issues/02-expand-feature-contracts.md)
- [05 — Time and Operation IDs](issues/05-inject-time-and-operation-ids.md)
- [06 — installer lifecycle through application](issues/06-installer-lifecycle-through-application.md)

Start an issue only when all its blockers are resolved. After 02, both Environment migration 03 and read-only overview 07 can proceed; new write journeys still require coordinator 04. Installation 13 also requires 04 for app-lifetime progress and coordinated inventory refresh. Expand–migrate–contract work keeps compatibility while callers move. Ticket 18 supplies a candidate default with fallback selected at startup: close the existing instance and relaunch with the documented flag, mounting only one presentation on the shared migrated composition/controllers/coordinator. Suites 19 and 20 accept the new UI, with fallback smoke checked separately; only then can 21 remove obsolete presentation.

Implementation begins from main with documentation transferred separately. The prototype branch is a design reference, not the implementation base. Ticket 02 owns validating the action inventory; 18 and 21 check that maintained inventory rather than starting it late.

Publishing tickets does not start or complete their implementation. Record pass/fail/blocked Windows outcomes honestly; a fixture UI does not constitute production acceptance.
