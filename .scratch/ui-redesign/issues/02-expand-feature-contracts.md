# 02: ขยาย feature contracts และจุดประกอบ API แบบรักษาความเข้ากันได้

**What to build:** แอปเดิมยังทำงานเหมือนเดิม แต่ประกอบด้วย API จริงหรือของจำลองได้จากจุดเดียว และแต่ละ feature ใช้ contract กับ types ของตนเองได้โดยไม่ต้องรู้จัก Tauri หรือ demo runtime.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Kind:** Prefactor / expand

- [ ] เริ่ม implementation branch จาก `main` ณ เวลาลงมือ และนำเฉพาะเอกสาร spec/architecture/tickets เข้าสาขานั้น; ใช้ prototype commit `6bc41ad` เป็น design reference โดยไม่ merge branch ต้นแบบหรือคัดลอก fixture components/app gate เข้าฝั่ง production.
- [ ] เก็บและตรวจ action/parity inventory ของ UI เดิมก่อน refactor โดยใช้ baseline ที่ตรวจจาก source เป็นจุดเริ่ม ให้แต่ละ action มี entry เดิม, ตำแหน่งใหม่, ticket owner และช่องบันทึกหลักฐาน; อย่ารอเริ่ม audit ใน 18.
- [ ] แยก Environment, Tools และ platform contracts ออกจาก Tauri transport และ launch/demo composition; feature contract เป็น type-only และไม่อาศัยการสร้าง production singleton.
- [ ] ย้ายแหล่งประกาศ types ไปยังเจ้าของจริงหรือ shared transport ที่ใช้ร่วมกัน พร้อม compatibility exports ให้ callers เดิมยัง build และทำงานได้; ไม่เปลี่ยน serialized shapes, Environment value kinds หรือข้อมูลที่บันทึกอยู่.
- [ ] มีจุด inject services ระดับแอปเพียงจุดเดียว โดย Tools controller และ feature consumers รับ capability ที่แคบตามหน้าที่ ไม่ใช่หลาย wrapper ที่ยังเปิด API ทั้งก้อน.
- [ ] คง compatibility facade สำหรับ callers ที่ยังไม่ได้ย้าย; ยังไม่ลบของเก่าในขั้น expand และยังไม่เปลี่ยนหน้าจอ.
- [ ] ทดสอบผ่าน production composition ว่า fake API คุม Tools และการเริ่มแอปได้จริง โดยไม่แตะ Tauri/Windows; build และ regression checks ที่ได้รับผลกระทบผ่าน.
