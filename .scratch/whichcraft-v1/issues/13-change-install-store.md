# 13: เปลี่ยนที่เก็บการติดตั้ง

**What to build:** ผู้ใช้เปลี่ยนที่เก็บการติดตั้งในหน้าตั้งค่าได้ การติดตั้งใหม่จะไปลงที่เก็บใหม่ ส่วนการติดตั้งในที่เก็บเดิมยังแสดงอยู่และยังเป็นของแอป

**Blocked by:** 10

**Status:** resolved

- [x] การติดตั้งที่แอปจัดการแต่ละชุดบันทึกที่เก็บของตัวเองไว้ — settings เก็บ previous_install_stores; ที่เก็บของการติดตั้งหาได้จากพาธราก
- [x] ติดตั้งที่ A แล้วเปลี่ยนเป็น B ต้องเห็นการติดตั้งทั้งใน A และ B (S-1) — test: managed_installs_in_current_and_earlier_stores_are_listed
- [x] การดูรายการเรียก mise ด้วยโฟลเดอร์ข้อมูลของแต่ละที่เก็บ — ตัดสินแล้ว (2026-10-23): อ่านโฟลเดอร์ <store>\_mise\data\installs ของทุกที่เก็บตรง ๆ แทนการเรียก mise ได้ผลเหมือนกัน ใช้ได้แม้ไม่มี mise หรือออฟไลน์ และเร็วกว่า; contract_two_install_stores_list_both_and_uninstall_from_the_old_one ยืนยันว่าเห็นทั้งสองที่เก็บ
- [x] ไม่ย้ายการติดตั้งเดิมตามไปที่เก็บใหม่ (Q17) — switch_install_store ไม่ย้ายไฟล์
- [x] มี test ที่ core ด้วยของปลอม และมี adapter contract test กับ mise จริงในที่เก็บสองที่ — contract_two_install_stores_list_both_and_uninstall_from_the_old_one: ติดตั้งที่ A เปลี่ยนเป็น B ติดตั้งอีกตัว เห็นทั้งสอง ถอนตัวใน A ด้วย mise ของ A แล้วตัวใน B ยังอยู่
