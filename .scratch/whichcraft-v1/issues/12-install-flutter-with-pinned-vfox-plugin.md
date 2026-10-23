# 12: ติดตั้ง Flutter ด้วยปลั๊กอิน vfox ที่ pin ไว้

**What to build:** ผู้ใช้ติดตั้ง Flutter จากในแอปได้สำเร็จ แม้ zip ของ Flutter จะมีไฟล์ read-only ใน `.git` ทุกครั้งที่ติดตั้ง ปลั๊กอินที่ใช้จะอยู่ที่ commit ที่ทดสอบไว้ ไม่ขยับตาม upstream

**Blocked by:** 10

**Status:** resolved

- [x] ใช้ backend `vfox:jdx/vfox-flutter` ไม่ใช้ `http:flutter` (I-2) — mise_tool ใช้ `vfox:jdx/vfox-flutter`
- [x] ก่อนติดตั้ง Flutter ครั้งแรก แอปติดตั้งปลั๊กอินเองด้วย SHA เต็มที่ฝังไว้คู่กับเวอร์ชันของ mise (SHA แบบย่อใช้ไม่ได้) — ensure_flutter_plugin ก่อน install และ ls-remote
- [x] ปลั๊กอินอยู่ที่ SHA ที่ pin ไว้ แม้ upstream จะมี commit ใหม่ (I-16) — test ที่ core ด้วย runner ปลอม; ยังไม่ได้ทดสอบกับ upstream จริง
- [x] ปิดการอัปเดตปลั๊กอินอัตโนมัติ และการติดตั้งครั้งถัดไปหลังผ่านระยะที่ mise จะอัปเดตเอง ยังได้ SHA เดิม (I-17) — ไม่มีอะไรให้ปิด: mise v2026.10.17 แจ้งเองว่า plugin_autoupdate_last_check_duration ไม่เคยทำงาน และ contract_flutter_plugin_stays_on_the_pin_over_time ยืนยันว่าแม้ upstream นำหน้าและไฟล์เก่า 30 วัน mise ก็ไม่ขยับปลั๊กอิน; ก่อนติดตั้ง Flutter ทุกครั้ง ensure_flutter_plugin ดึงกลับมาที่ SHA ที่ pin ไว้ (2026-10-23)
- [x] แสดงขนาดดาวน์โหลดราว 1.9 GB และพื้นที่ที่จะใช้ราว 3.3 GB ก่อนติดตั้ง (I-9) — แสดงขนาดดาวน์โหลดจาก HEAD และพื้นที่ที่จะใช้โดยประมาณ (×1.8 จากที่วัดจริง: 1.75 GB → 3.18 GB สำหรับ 3.32.8)
- [x] มี adapter contract test กับ mise จริงที่ติดตั้ง Flutter และตรวจ SHA ของปลั๊กอิน — contract_flutter_installs_through_the_pinned_plugin_and_uninstalls: ปลั๊กอินอยู่ที่ 835840d2... ตรงกับ pin, ติดตั้ง Flutter 3.32.8 ใน 123 วินาที, dart และ flutter --version รันได้, inventory เห็นชุดเดียว, ถอนแล้วเหลือแค่ *.msgpack.z (2026-10-23)
