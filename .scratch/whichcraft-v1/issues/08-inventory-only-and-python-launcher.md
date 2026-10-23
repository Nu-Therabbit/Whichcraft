# 08: แสดงข้อมูลอย่างเดียว — Android SDK/NDK, MSVC และ Python launcher

**What to build:** ผู้ใช้เห็นรายการ Android SDK platforms, build tools, NDK, platform tools, emulator, CMake และ MSVC/Windows SDK แบบดูอย่างเดียว ในหน้า Python เห็นแยกว่า `py` launcher และ Microsoft Store stub จะเรียก Python ตัวไหน

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] รายการ Android และ MSVC ตรงกับผลสำรวจเครื่องใน requirements และไม่มีปุ่มเลือกหรือติดตั้ง (D-7)
- [ ] หน้า Python แสดงผล `py -0p` และ Store stub แยกจาก `python` ใน PATH และระบุว่า `py` มองไม่เห็น Python ที่แอปติดตั้ง (E-5)
- [ ] มี test ที่ core ด้วยของปลอม
