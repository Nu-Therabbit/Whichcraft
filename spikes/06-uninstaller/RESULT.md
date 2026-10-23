# งานพิสูจน์ข้อ 6: Uninstaller — ผล

ทดสอบเมื่อ 23 ตุลาคม 2026 อ่านอย่างเดียว ไม่ได้เรียก uninstaller ตัวใดจริง

**ผล: ผ่าน** อ่าน UninstallString ของ Temurin 17 ได้ และจับคู่การติดตั้งภายนอกทุกตัวในเครื่องกับรายการ uninstall ได้ครบ ระบุได้ด้วยว่าตัวไหนเป็นโฟลเดอร์ล้วน แต่วิธีถอนต้องแยกตามชนิดของตัวติดตั้ง จะใช้ UninstallString ตรง ๆ ไม่ได้

## รายการที่อ่านได้

อ่านจาก `HKLM\...\Uninstall`, `HKLM\SOFTWARE\WOW6432Node\...\Uninstall` และ `HKCU\...\Uninstall`

| การติดตั้ง | ชนิดตัวติดตั้ง | InstallLocation | UninstallString | วิธีถอนที่ควรใช้ |
|---|---|---|---|---|
| Temurin 17.0.20.1 | MSI (HKLM) | มี | `MsiExec.exe /I{E8C508F2-…}` | `msiexec /x {E8C508F2-…}` |
| Temurin 21.0.12.1, 21.0.12 | MSI (HKLM) | มี | `MsiExec.exe /I{…}` | `msiexec /x {…}` |
| Temurin 21.0.11 (ใต้ LocalAppData) | MSI (**HKLM** แม้ติดตั้งในโฟลเดอร์ของผู้ใช้) | มี | `MsiExec.exe /I{9D450299-…}` | `msiexec /x {…}` |
| Node.js 24.20.0 | MSI (HKLM) | **ว่าง** | `MsiExec.exe /I{DC5BBE4F-…}` | `msiexec /x {…}` |
| Go 1.27.0 | MSI (HKLM) | **ว่าง** | `MsiExec.exe /X{649B7E21-…}` | `msiexec /x {…}` |
| Git 2.55.0.5 | Inno Setup | มี | `"C:\Program Files\Git\unins001.exe"` | ใช้ UninstallString ตามนั้น (`QuietUninstallString` มี `/SILENT` แต่ Q18 ให้เปิดแบบปกติ) |
| Python 3.14.6 | Python install manager (HKCU) | มี | `pymanager.exe uninstall --yes --by-id "pythoncore-3.14-64"` | ใช้ UninstallString ตามนั้น (มี `--yes` ในตัว ไม่มีหน้าจอให้ยืนยัน) |
| Flutter `E:\Dev\flutter` | **ไม่มีรายการ** | – | – | โฟลเดอร์ล้วน: ย้ายไป Recycle Bin ตามเงื่อนไข Q26 |
| Android Studio (นอกขอบเขตเครื่องมือ) | JetBrains Toolbox (HKCU) | มี | **ว่าง** | มีเครื่องมืออื่นดูแลอยู่ ไม่ควรลบเป็นโฟลเดอร์ล้วน |

## สิ่งที่พบ

1. **UninstallString ของ MSI มักเป็น `/I` (โหมดแก้ไข) ไม่ใช่ `/X` (ถอน)** ถ้าเรียกตรง ๆ จะเปิดหน้า Modify/Repair/Remove ของ Temurin ถ้า `WindowsInstaller=1` แอปควรเรียก `msiexec /x {ProductCode}` เอง ส่วนชนิดอื่นใช้ UninstallString ตามที่ลงทะเบียนไว้
2. **InstallLocation อาจว่าง** (Node, Go) แต่หาโฟลเดอร์ได้จาก MSI ที่ Windows cache ไว้ (`ProductInfo(code, "LocalPackage")`) ขั้นตอนคือ
   - หา component ของ `node.exe`/`go.exe` ในตาราง `File`
   - หา `ComponentId` ในตาราง `Component`
   - เรียก `ComponentPath(product, componentId)` ได้ `C:\Program Files\nodejs\node.exe` และ `C:\Program Files\Go\bin\go.exe`

   การไล่ `Installer.Components` ทั้งหมดผ่าน COM จาก PowerShell คืนค่า 0 รายการ ใช้ไม่ได้
3. **MSI ที่ติดตั้งในโฟลเดอร์ของผู้ใช้ก็ลงทะเบียนใน HKLM ได้** (Temurin 21.0.11) แอปจึงต้องค้นทั้ง HKLM และ HKCU ไม่ว่าโฟลเดอร์จะอยู่ที่ไหน
4. **รายการที่ไม่มี UninstallString** (Android Studio จาก Toolbox) หมายถึงมีเครื่องมืออื่นดูแลอยู่ ต้องแยกออกจาก "โฟลเดอร์ล้วน" ไม่อย่างนั้นแอปจะเสนอให้ลบโฟลเดอร์ที่ Toolbox ยังดูแลอยู่
5. **`E:\Dev\flutter` ผ่านเงื่อนไขโฟลเดอร์ล้วนของ Q26:**
   - มี `bin\flutter.bat` และ `bin\cache\flutter.version.json`
   - ไม่ใช่ junction
   - ข้างในไม่มีการติดตั้งอื่น
   - มีไฟล์ read-only 3 ไฟล์ใน `.git`
6. **Recycle Bin:** ทดสอบกับโฟลเดอร์จำลองที่มีไฟล์ read-only ใน `.git` ย้ายไป Recycle Bin ได้ (`FileSystem.DeleteDirectory(..., SendToRecycleBin)`)
