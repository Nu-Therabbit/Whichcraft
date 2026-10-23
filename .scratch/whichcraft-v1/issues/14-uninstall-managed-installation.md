# 14: ถอนการติดตั้งที่แอปจัดการ

**What to build:** ผู้ใช้ถอนการติดตั้งที่แอปจัดการได้ในคลิกเดียว ถ้าเป็นตัวที่ใช้อยู่ แอปให้เลือกตัวแทนแล้วสลับให้ก่อน ถ้ามีโปรแกรมใช้การติดตั้งนั้นอยู่ (java, Gradle daemon หรือ Terminal ที่ cd ค้างอยู่) แอปแสดงรายชื่อและไม่ให้ถอน ใบนี้สร้าง UsageProbe และขั้นตอนเลือกตัวแทน ซึ่งใบที่ 15 ใช้ต่อ

**Blocked by:** 03, 10

**Status:** ready-for-agent

- [ ] ถอนผ่าน mise ด้วยที่เก็บของการติดตั้งนั้น แล้วโฟลเดอร์ cache และ junction หายครบ (R-1) รวมถึงการติดตั้งในที่เก็บเก่า (S-2) — services/uninstall.rs ใช้ mise ของที่เก็บที่ถือการติดตั้งนั้น รวมที่เก็บเก่า (test managed_installs_are_removed_with_mise_in_their_own_store) แต่ยังไม่ได้ถอนผ่าน mise จริงเพื่อตรวจ cache และ junction
- [x] ถ้าเป็นการเลือกหรือการติดตั้งที่มีผลจริง ต้องเลือกตัวแทนก่อน แล้ว Apply การสลับก่อนจึงถอน (R-12) — UI ให้เลือกตัวแทน แล้ว Apply การสลับ (ผ่าน UAC ถ้าต้องใช้) ก่อนถอน (test the_selected_jdk_is_switched_away_before_it_is_removed)
- [x] UsageProbe ตรวจด้วย Restart Manager กับไฟล์หลัก ร่วมกับดูพาธของ exe และลองเปลี่ยนชื่อโฟลเดอร์ไปและกลับ — WinUsageProbe: Restart Manager กับ exe/dll ทั้งโฟลเดอร์ (ลึก 5 ชั้น) และ rename ไปกลับเฉพาะโฟลเดอร์ที่ผู้ใช้เขียนได้ (ไม่อยู่ใต้ Program Files)
- [x] ถ้ามี java หรือ Gradle daemon ใช้อยู่ แสดงชื่อโปรแกรม แนะนำ `gradlew --stop` และไม่ kill เอง (R-10) — แสดงชื่อโปรแกรมกับ PID และแนะนำ gradlew --stop ไม่ kill เอง
- [x] ถ้ามี Terminal ที่ cd ค้างอยู่ แจ้งว่ามีโปรแกรมเปิดโฟลเดอร์อยู่และไม่ให้ถอน (R-11) — folder_locked จาก rename ที่ล้มเหลว ปุ่มถอนถูกปิด และตรวจซ้ำก่อนถอนจริง
- [ ] ขั้นตอนถอนบันทึกลง Journal — การสลับก่อนถอนลง Journal ตามปกติ แต่ตัวการถอนเองยังไม่ลง Journal
- [x] มี test ที่ core ด้วยของปลอม (รวมการ rename ที่ถูกล็อก) และมี adapter contract test ของ UsageProbe บน Windows จริงตามแบบงานพิสูจน์ข้อ 7 — test ที่ core ใช้ FakeUsageProbe และ FakeUninstaller; adapter test บน Windows จริงใช้โฟลเดอร์ชั่วคราว (โปรแกรมที่รันอยู่ และ cwd ค้างในโฟลเดอร์)
