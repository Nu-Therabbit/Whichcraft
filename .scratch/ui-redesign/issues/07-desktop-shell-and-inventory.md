# 07: เปิดภาพรวมเครื่องมือจริงใน desktop shell แบบ A

**What to build:** เปิดหน้า desktop A ที่ค้นหา/สแกนเครื่องมือจริงได้ เห็นการติดตั้งที่มีผลจริงและการเลือกที่ต่างกัน แล้วเปิดรายละเอียดด้านข้าง รวม Inventory Only ของ SDK.

**Blocked by:** 02: ขยาย feature contracts และจุดประกอบ API แบบรักษาความเข้ากันได้.

**Status:** ready-for-agent

**Kind:** Vertical slice / read journey

- [ ] สร้าง production desktop shell จากดีไซน์ A: navigation สี่ส่วน, compact command/status bars และ docked details; ไม่มี headline แบบ marketing หรือ fixture values.
- [ ] ใบนี้เป็น read-only journey: ทำ query/request/account isolation ที่จำเป็นได้โดยไม่ต้องรอ Environment refactor/coordinator ทั้งหมด; ไม่เพิ่ม write entry point ใหม่จาก shell ก่อน flow นั้นมี coordinator และยังใช้ legacy entry สำหรับ flow ที่ยังไม่ได้ย้าย โดยไม่เริ่ม bootstrap/subscriptions ซ้ำเพราะเปิด view ใหม่.
- [ ] โหลด per-tool inventory สำหรับ Java, Node.js, Python, Go, Flutter, Git ด้วย API เดิม; แยก overview state จาก selected-tool state และผูก late results กับ request/tool/account identity.
- [ ] แสดง Installation Root, full version/vendor, ownership, unavailable และจำนวนการติดตั้งจากข้อมูลจริง; แสดง Selection กับ Effective Installation แยกกัน ไม่ใช้เพียงการมี entry ใน PATH เป็นหลักฐาน.
- [ ] ค้นหาและ Rescan ได้ พร้อม loading/empty/error states รายเครื่องมือ; Android/MSVC เป็น Inventory Only และ Python launcher/Store stub แสดงข้อมูลแยกตาม contract เดิม.
- [ ] ธีม ภาษาที่รองรับ accessible names/focus และขนาดหน้าต่างเดิมใช้งานได้; legacy presentation ยังเข้าถึงได้ระหว่างย้าย และไม่เปลี่ยน default เป็นหน้าที่เหลือ placeholder จน cutover.
- [ ] ทดสอบ read journey ผ่าน UI/controller/API seam และลอง discovery/read-only บน Windows จริง พร้อมเก็บหลักฐานที่หน้าต่าง 1200×760 และ 900×600.
