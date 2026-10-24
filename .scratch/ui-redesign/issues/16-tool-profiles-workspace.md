# 16: จัดการและ Apply Tool profiles จาก workspace ใหม่

**What to build:** สร้าง/ลบโปรไฟล์ เลือกเฉพาะเครื่องมือที่ต้องการ ดูว่าตรงกับการติดตั้งที่มีผลจริงหรือไม่ และติดตั้งตัวที่ขาดก่อน Apply ได้.

**Blocked by:** 08: สลับการติดตั้งผ่านแผนจริงและ Undo; 13: ตั้งค่าที่เก็บและติดตั้งเครื่องมือจาก desktop UI.

**Status:** in-review

**Kind:** Vertical slice / profile journey

- [x] ใช้ saved profiles จริงและ vendor/full-version pins ตาม domain; ไม่มี active-profile mode หรือการใช้ Snapshot แทน Tool Profile.
- [x] create/delete/review/apply กระทบเฉพาะ tools ที่รวมในโปรไฟล์ และสถานะ match ถูกรีเฟรชหลัง external/environment changes.
- [x] กรณี unavailable/missing pins ไม่ Apply ครึ่งชุด; install-missing/store confirmation/download information ใช้ workflow จริงและไม่เสนอสิ่งที่ติดตั้งผ่านแอปไม่ได้.
- [x] รู้จัก affected profile/repoint outcomes จาก update/uninstall โดยไม่ทำ duplicate write; conflicting Environment staging ใช้ coordinator เดิม.
- [ ] ทดสอบ app/API partial profile, duplicate-installation pin, unavailable/missing และ profile refresh พร้อมลอง partial-profile/install-missing ที่ควบคุมได้บน Windows.

## Comments

- **Shell:** Nav `Tool profiles` opens `ShellProfilesWorkspace` with production `ProfilesSection` wired to app-lifetime tools store (`loadProfiles`, create/delete/apply/check-missing/install-missing).
- **Refresh:** Profile match reload follows ticket 10 `tools-profiles` invalidation on environment/tool readback.
- **Tests:** `desktopShellProfiles.test.tsx` (partial apply via `planProfile`, refresh after invalidation, unavailable → install-missing gate).
- **Windows manual (partial profile / install-missing):** Not run in this agent environment. Leave checkbox open.

### Review round 1 (Grok on e078048)

- `ShellProfilePlanPanel` shows plan diff + Apply on the profiles page; `planProfile` dispatches `planBuilt` with `plan.tool` and `source: "profile"`.
- Single app-level recovery via `ShellAppRecoveryBanner` (removed duplicate inspector banner).
- Shell tests lock staged-env block, no `createSnapshot` on profile apply, unavailable pins idle, environment-only invalidation refresh, and full `applyToolPlan` on Apply plan.
