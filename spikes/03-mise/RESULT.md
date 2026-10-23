# งานพิสูจน์ข้อ 3: mise — ผล

ทดสอบเมื่อ 23 ตุลาคม 2026 บนเครื่องนี้ (Windows 11 Pro 10.0.26300, x64)

**ผล: ผ่าน โดยมีเงื่อนไข** Flutter ต้องใช้ backend `vfox:jdx/vfox-flutter` แทน `http:flutter` ซึ่งเป็นค่าเริ่มต้น

## วิธีทดสอบ

- **ตัว mise:** mise v2026.10.17 (`mise-v2026.10.17-windows-x64.zip`) ตรวจ SHA256 กับ `SHASUMS256.txt` ของ release แล้วตรงกัน
- **การแยกที่เก็บ:** [mise.ps1](mise.ps1) ตั้ง `MISE_DATA_DIR`, `MISE_CACHE_DIR`, `MISE_STATE_DIR`, `MISE_CONFIG_DIR` และ `MISE_GLOBAL_CONFIG_FILE` ไปที่ `stores\<ชื่อ>` แล้วรันจากโฟลเดอร์นั้น `mise doctor` ยืนยันว่าทุก dir อยู่ในที่เก็บ และไม่มี config ของผู้ใช้ถูกโหลด
- **คำสั่งที่ใช้:** `mise install` อย่างเดียว ไม่ใช้ `mise use` ไม่เขียน config ไม่แตะ PATH หรือ registry

## ผลรายเครื่องมือ

| เครื่องมือ | เวอร์ชัน | ติดตั้ง | รันจากพาธตรง | ถอน |
|---|---|---|---|---|
| Java | `temurin-21.0.12+101.0.LTS` → จริงคือ 21.0.12.1 | ผ่าน 20 วินาที | `bin\java.exe -version` ผ่าน | ผ่าน |
| Node | 22.23.4 | ผ่าน 5 วินาที | `node.exe --version` ผ่าน | ผ่าน |
| Python | 3.13.17 | ผ่าน 6 วินาที | `python.exe --version` ผ่าน | ผ่าน |
| Go | 1.26.10 | ผ่าน 12 วินาที | `bin\go.exe version` ผ่าน | ผ่าน |
| Flutter (`http:flutter`) | 3.47.7 | **ล้มเหลว** "Access is denied. (os error 5)" ทั้ง 2 ครั้ง | – | – |
| Flutter (`vfox:jdx/vfox-flutter`) | 3.47.7 | ผ่าน 155 วินาที, 3.25 GB | มี `bin\flutter.bat`; Dart ในชุด 3.13.5 รันได้ | ผ่าน รวมไฟล์ read-only |

## สาเหตุที่ `http:flutter` ล้มเหลว

zip ของ Flutter มีไฟล์ read-only 4 ไฟล์ใน `flutter/.git/objects` ผมสร้าง zip ทดสอบสองไฟล์ที่ต่างกันแค่ไฟล์ read-only หนึ่งไฟล์ แล้วติดตั้งผ่าน `http:` backend ตัวที่มีไฟล์ read-only ล้มเหลวด้วย error เดียวกันภายใน 14 ms ส่วนตัวที่ไม่มีติดตั้งผ่าน ผลนี้ชี้ว่าเป็นบั๊กของ mise บน Windows ตอนแตกไฟล์ที่มี read-only attribute ไม่ใช่เรื่องพาธยาว (LongPathsEnabled = 1) ส่วน vfox backend แตกไฟล์ชุดเดียวกันได้

## ข้อเท็จจริงที่ได้เพิ่ม

- **ที่เก็บ A/B:** ติดตั้ง Node 22.23.4 ทั้งในที่เก็บ A และ B แล้วถอนจาก A โดยใช้ context ของ A ผลคือของใน A หายหมด รวม junction ส่วนของใน B ยังรันได้ และ `ls` ของ B เห็นเฉพาะของตัวเอง
- **`--dry-run`:** แสดงพาธที่จะลบ คือโฟลเดอร์การติดตั้งและ cache ของเวอร์ชันนั้น
- **junction:** mise สร้าง junction ชี้ไปโฟลเดอร์เวอร์ชันจริง เช่น `1.26`, `latest`, `temurin-21` และ `lts-jod` ตัวค้นหาของแอปต้องข้าม junction เหล่านี้ และใช้เฉพาะโฟลเดอร์เวอร์ชันจริง
- **`mise ls --json`:** มีแค่ 4 field คือ `version`, `install_path`, `installed` และ `active` ไม่มีผู้จำหน่าย และชื่อเวอร์ชันของ Java ไม่ตรงกับเวอร์ชันจริง ผู้จำหน่ายและเวอร์ชันเต็มต้องอ่านจากไฟล์ `release` ของ JDK (`IMPLEMENTOR`, `JAVA_VERSION`)
- **Flutter:** ไม่มีไฟล์ `version` ที่รากแล้ว ใช้ `bin\cache\flutter.version.json` แทน (`frameworkVersion`, `channel`)
- **งานพิสูจน์ข้อ 5:** `py -0p` เห็นแค่ Python 3.14 เดิม **มองไม่เห็น** Python ที่ mise ติดตั้ง
- **ขนาด mise.exe ของ Windows:** 240 MB (zip 81 MB) ถ้าแอปพก mise มาเอง ตัวติดตั้งจะใหญ่ตามไปด้วย

## พบภายหลัง: junction ของ mise ใช้พาธเต็ม

หลังเปลี่ยนชื่อโฟลเดอร์โปรเจกต์จาก `E:\Dev\Switchyard` เป็น `E:\Dev\Whichcraft` junction ทุกตัวในที่เก็บ (`22`, `22.23`, `latest`, `lts-jod`) ยังชี้ไปพาธเดิม จึงกลายเป็น junction เสีย ส่วนโฟลเดอร์เวอร์ชันจริง (`22.23.4`) ยังรันได้ปกติ ถ้าย้ายหรือเปลี่ยนชื่อโฟลเดอร์ของที่เก็บ junction จะเสียหมด ข้อนี้ยืนยันว่า environment ต้องชี้ไปโฟลเดอร์เวอร์ชันจริงเท่านั้น (เกณฑ์ A-5, D-3) และสนับสนุนการตัดสินใจ Q17 ที่ไม่ย้ายการติดตั้งเดิมตามเมื่อเปลี่ยนที่เก็บ

## พบภายหลัง: pin ปลั๊กอิน vfox ได้

`vfox:jdx/vfox-flutter` โหลดปลั๊กอินจาก Git แยกต่างหาก ในงานพิสูจน์นี้ได้ commit `835840d` (HEAD ณ วันทดสอบ) ทดลองเพิ่มในที่เก็บแยก ได้ผลดังนี้
- `mise plugins install vfox-jdx-vfox-flutter https://github.com/jdx/vfox-flutter#<sha>` ใช้ SHA แบบย่อไม่ได้ ("abbreviated commit SHAs are not supported") ต้องใช้ SHA เต็ม
- pin ไว้ที่ commit ก่อน HEAD (`2b8eaef…`) ได้ และหลังเรียก `ls-remote` ผ่าน backend แล้ว HEAD ยังอยู่ที่ commit ที่ pin ไว้ ส่วน `plugins ls --refs` แสดง `2b8eaef`
- SHA เต็มของ `835840d` คือ `835840d23e05bfe0de18ef85cfead412e33c3039`
- **ยังไม่ได้ตรวจ:** ระหว่าง `mise install` จะมีการอัปเดตปลั๊กอินอัตโนมัติหรือไม่ (mise มีการตั้งค่า `plugin_autoupdate_last_check_duration`)

## ยังไม่ได้ทดสอบ

- ถอนขณะมี process ใช้อยู่ (งานพิสูจน์ข้อ 7)
- ติดตั้งระหว่างที่เน็ตหลุด หรือยกเลิกกลางทาง (ตาราง "เมื่อล้มเหลวหรือถูกยกเลิกกลางทาง")
- ยังไม่ได้รัน `flutter --version` เพราะคำสั่งนี้เขียน config ลงโปรไฟล์ผู้ใช้ ซึ่งใช้ร่วมกับ Flutter ที่ `E:\Dev\flutter`

ลบที่เก็บทดลองไปแล้ว (2.24 GB) เหลือไว้เฉพาะ mise.exe ใน `bin-extract` และ log
