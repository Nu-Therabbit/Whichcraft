# งานพิสูจน์ข้อ 7: Process — ผล

ทดสอบเมื่อ 23 ตุลาคม 2026

**ผล: ผ่าน โดยมีเงื่อนไข** ตรวจ process ที่รันจากโฟลเดอร์ JDK ได้ ทั้ง java ธรรมดาและ Gradle daemon แต่ shell ที่ใช้โฟลเดอร์นั้นเป็น working directory ไม่ถูกจับ ทั้งที่ขวางการลบโฟลเดอร์ ต้องมีการตรวจด้วยการลองเปลี่ยนชื่อโฟลเดอร์อีกชั้น

## process จำลอง

ตอนทดสอบไม่มี Java, Gradle daemon หรือ Android Studio รันอยู่ จึงสร้าง process จำลองบน Temurin 17 (`C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`) 3 ตัว
1. **java ธรรมดา:** `java Sleep.java` (source launcher)
2. **Gradle daemon จริง:** Gradle 8.13 จาก wrapper cache รัน `help --offline` ในโปรเจกต์ว่าง โดยตั้ง `JAVA_HOME` เป็น JDK 17 daemon จึงค้างอยู่หลังคำสั่งจบ
3. **shell ที่ cd เข้าโฟลเดอร์:** `cmd /k` โดยตั้ง working directory เป็น `jdk…\bin`

Android Studio ไม่ได้ทดสอบ เพราะมันรันด้วย JBR ที่มากับตัวเอง (`…\Android Studio\jbr`) ไม่ได้ใช้ JDK ในรายการของเรา ถ้าผู้ใช้ตั้ง Gradle JDK ของ Android Studio เป็น JDK ในเครื่อง process ที่ใช้ JDK นั้นคือ Gradle daemon ซึ่งเป็นกรณีที่ 2

## ผลการตรวจ ([detect.ps1](detect.ps1))

| process | A: exe อยู่ใต้โฟลเดอร์ (WMI `ExecutablePath`) | B: Restart Manager (`RmGetList` กับ `java.exe`, `javaw.exe`, `jvm.dll`, `lib\modules`) |
|---|---|---|
| java ธรรมดา | พบ | พบ ("OpenJDK Platform binary") |
| Gradle daemon | พบ | พบ |
| cmd ที่ cd อยู่ในโฟลเดอร์ | **ไม่พบ** | **ไม่พบ** |
| ตัวควบคุม: JDK 21.0.12 ที่ไม่มีใครใช้ | ไม่พบ (ถูกต้อง) | ไม่พบ (ถูกต้อง) |

## working directory ขวางการลบ

ทดสอบกับโฟลเดอร์จำลองที่มี `cmd` cd ค้างอยู่
- ลองเปลี่ยนชื่อโฟลเดอร์ → **ถูกปฏิเสธ (Access denied)**
- ย้ายไป Recycle Bin → **ล้มเหลว** ("The system call level is not correct") โฟลเดอร์ยังอยู่ครบ
- ปิด cmd แล้วเปลี่ยนชื่อ → ทำได้

## สิ่งที่ได้สำหรับการออกแบบ

- ใช้ Restart Manager เป็นวิธีหลัก เพราะจับได้แม้ process ที่ใช้ DLL ของ JDK จะมี exe อยู่นอกโฟลเดอร์ ได้ชื่อแอปที่อ่านง่าย และเป็นกลไกเดียวกับที่ตัวติดตั้งของ Windows ใช้ ส่วนวิธี A ใช้เป็นตัวเสริม
- ก่อนถอน ให้ลองเปลี่ยนชื่อโฟลเดอร์ไปเป็นชื่ออื่นแล้วเปลี่ยนกลับ ถ้าไม่สำเร็จ ให้แจ้งว่า "มีโปรแกรมเปิดโฟลเดอร์นี้อยู่ เช่น Terminal ที่ cd เข้าไป" วิธีนี้ทำได้เลยกับการติดตั้งที่แอปจัดการและโฟลเดอร์ล้วน ส่วนโฟลเดอร์ใน Program Files ต้องมีสิทธิ์ admin
- ลำดับตรวจก่อนถอนตาม Q19: Restart Manager → ลองเปลี่ยนชื่อ → ถ้ามีอะไรเปิดอยู่ ให้แสดงรายการและไม่ให้ถอน แอปไม่ kill เอง สำหรับ Gradle daemon ให้แนะนำ `gradlew --stop`

**ตรวจหลังทดสอบ:** หยุด process จำลองทั้งหมดแล้ว (Gradle รายงาน "1 Daemon stopped") ไม่มี java ค้าง และลบโฟลเดอร์ทำงานแล้ว
