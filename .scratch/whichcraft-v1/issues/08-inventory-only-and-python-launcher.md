# 08: แสดงข้อมูลอย่างเดียว — Android SDK/NDK, MSVC และ Python launcher

**What to build:** ผู้ใช้เห็นรายการ Android SDK platforms, build tools, NDK, platform tools, emulator, CMake และ MSVC/Windows SDK แบบดูอย่างเดียว ในหน้า Python เห็นแยกว่า `py` launcher และ Microsoft Store stub จะเรียก Python ตัวไหน

**Blocked by:** 06

**Status:** resolved

- [x] รายการ Android และ MSVC ตรงกับผลสำรวจเครื่องใน requirements และไม่มีปุ่มเลือกหรือติดตั้ง (D-7) — แท็บ Android & MSVC แบบอ่านอย่างเดียว ไม่มีปุ่ม; contract_reads_the_survey_machine_sdks ตรงกับผลสำรวจ (platforms 6, build-tools 3, NDK 2, platform-tools 37.0.1, emulator 37.2.12, MSVC 14.44.35207, SDK 10.0.26100.0)
- [x] หน้า Python แสดงผล `py -0p` และ Store stub แยกจาก `python` ใน PATH และระบุว่า `py` มองไม่เห็น Python ที่แอปติดตั้ง (E-5) — แยก `py -0p` (tag, path, default) และ Store alias จาก python ใน PATH พร้อมหมายเหตุ E-5
- [x] มี test ที่ core ด้วยของปลอม — unit tests 5 ข้อ (parse py, SDK layout, ANDROID_HOME vs default, vswhere/MSVC/SDK) + component tests 3 ข้อ
