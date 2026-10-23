# ประเมินสถาปัตยกรรม: Clean Architecture + MVI

สถานะ: ตกลงทำทุกขั้น (2026-10-24, ADR-0005) ประเมินจาก `feat/v1-tickets` ที่ `350c441`

## สรุป

- **Rust:** มีโครงของ ports and adapters อยู่แล้วและใช้ได้ดีในบางส่วน (EnvBackend, Elevator, UsageProbe, Uninstaller พร้อม fake และ contract test) แต่ services หลายตัวยังทำ I/O เอง type หลักกระจายอยู่ใน ports/services และการประสานงานบางส่วนอยู่ใน Tauri commands จึงยังไม่ใช่ Clean Architecture เต็มรูป
- **React:** ไม่ใช่ MVI เลย state ทั้งหมดของหน้าเครื่องมืออยู่ใน hook เดียว (`useDeveloperTools`) ที่มี `useState` 35 ตัว และไม่มี test บั๊กระดับ P1/P2 สามข้อในรีวิวล่าสุด (#1, #3, #5) เกิดจาก state ที่กระจายกันแบบนี้
- **ข้อเสนอ:** ปรับทีละขั้น ขั้นละ commit พฤติกรรมไม่เปลี่ยน และ test ต้องผ่านทุกขั้น เริ่มจากฝั่ง React ก่อน เพราะได้ประโยชน์ชัดที่สุดและเสี่ยงต่ำที่สุด

## ฝั่ง Rust

### เป้าหมาย

```
domain        type และกฎล้วน ไม่มี I/O (ToolKind, ToolInstallation, เวอร์ชันและสาย, แผน PATH, กฎโฟลเดอร์ Q26, pin ของโปรไฟล์)
application   use case: สลับ, Undo, กู้คืน, ติดตั้ง, อัปเดต, ถอน, โปรไฟล์, ทำความสะอาด PATH (เรียกผ่าน port เท่านั้น)
ports         trait ที่ application ต้องใช้
adapters      winreg, process, mise, ไฟล์ JSON, HTTP, Restart Manager, Recycle Bin
interface     Tauri commands แบบบาง และ composition root ที่สร้าง adapter ครั้งเดียว
```

dependency ชี้เข้าด้านในเท่านั้น: interface → application → domain และ adapters → ports ← application

### สิ่งที่ตรงอยู่แล้ว

- `EnvBackend` + `MemBackend` แยกการอ่านเขียน registry ออกจากตรรกะ ทำให้ test แผน, Apply, Undo, กู้คืน ได้โดยไม่แตะเครื่องจริง
- `Elevator`, `UsageProbe`, `Uninstaller` เป็น port มี fake และ adapter ของ Windows มี contract test แยก
- ตรรกะหลายส่วนเป็นฟังก์ชันล้วนอยู่แล้ว: `update::newest_in_line`, `path_plan`, `uninstall::folder_refusal`, `profiles::pin_means`, `split_command_line`

### จุดที่ไม่ตรง

| # | ปัญหา | ตัวอย่าง |
|---|---|---|
| R-a | services ทำ I/O เอง แทนที่จะผ่าน port | `tool_inventory` อ่านโฟลเดอร์และ env เอง แล้วเรียก `WinInstallerCatalog` ตรง ๆ ผ่าน `installer_kinds()` (ชั้นในพึ่งชั้นนอก); `supplemental_inventory` ใช้ `winreg` และรัน `vswhere`/`py` เอง; `java_inventory`, `profiles`, `uninstall` (ไฟล์บันทึก), `path_cleanup` (`dir_exists`) |
| R-b | type หลักไม่อยู่ใน domain | `ToolInstallation` อยู่ใน `ports/installation_probe`, `ToolInstallationView` อยู่ใน `services/tool_inventory`, `ToolApplyPlan` อยู่ใน `services/tool_plan` และฝัง `EnvSnapshot` ของ Envarly |
| R-c | persistence ถูกเรียกตรงจาก services | journal, selection, settings ไม่ผ่าน port ส่วน port `Journal` ที่มีอยู่ไม่มีใครใช้ |
| R-d | โครงที่ไม่ได้ใช้ | port `environment_resolver`, `journal`, `shell_probe`, `terminal_launcher` และ `WhichcraftCore::with_fakes()` ซึ่งใช้แค่ตอบ health check; `#[allow(dead_code)]` ใน `whichcraft/mod.rs` |
| R-e | use case อยู่ใน Tauri commands | `build_uninstall_plan`, `missing_for`, `installing_manager`, `merge_settings` อยู่ใน `commands/whichcraft.rs` (566 บรรทัด, 42 commands) และทุก command สร้าง adapter เอง (`WinregBackend`, `WinElevator`, `MiseToolManager::new()`) |
| R-f | port ของ mise ไม่ครบ | `ToolManager` มีแค่ `list_installed`/`list_remote` ส่วน install/uninstall เรียก `MiseToolManager` ตรง จึงใช้ fake ใน test ของ use case ติดตั้งไม่ได้ |

## ฝั่ง React

### เป้าหมาย (MVI)

```
Model    state เดียวแบบ immutable ของหน้าเครื่องมือ แบ่งเป็นส่วน: inventory, plan, install, update, uninstall, profiles, cleanup, recovery
Intent   union ของสิ่งที่ผู้ใช้หรือระบบทำ เช่น { type: "chooseReplacement", root }, { type: "applyPlan" }
Reduce   ฟังก์ชันล้วน (state, event) → state ซึ่ง test ได้โดยไม่ต้อง render
Effects  แปลง intent เป็นการเรียก api แล้ว dispatch event ผลลัพธ์ (succeeded / failed)
View     component รับ state ส่วนที่ใช้ และ dispatch เท่านั้น
```

### จุดที่ไม่ตรง

| # | ปัญหา | ตัวเลข |
|---|---|---|
| F-a | hook เดียวถือทุกอย่าง | `useDeveloperTools.ts` 620 บรรทัด, `useState` 35 ตัว, `useCallback` 28 ตัว, คืนค่า 66 key, เรียก `setError` 50 จุด, ไม่มี test |
| F-b | สถานะของ flow กระจายเป็น flag | flow อัปเดตแล้วถอนใช้ `plan`, `replacedRoot`, `updatedRoot`, `repointOffer`, `uninstallPlan`, `replacementPlan` ร่วมกัน ต้องอ่าน callback หลายตัวจึงจะรู้ว่าอยู่ขั้นไหน |
| F-c | props ยาวและมีชั้นแปลงซ้ำ | `ToolsPanel` มี Props 80 บรรทัด และ `App.tsx` ต้องประกอบ object ส่งต่อทีละ prop (บั๊ก #1 เกิดจาก arrow function ที่สร้างใหม่ในชั้นนี้) |
| F-d | ของเก่าค้าง | `useJavaTools.ts` ไม่มีใครใช้; API แยกของ Java (`planJavaApply`, `applyJavaPlan`, `listJavaInstallations`) ซ้ำกับแบบทั่วไป |

บั๊กในรีวิวล่าสุดที่โครงแบบ MVI จะกันได้:
- **#1:** effect ผูกกับ identity ของ callback ใน MVI การโหลดเป็น effect ของ intent `openInstallList` ไม่ใช่ของ render
- **#3:** แผนสลับไม่ได้อยู่ใน state ที่หน้าจอแสดง ใน MVI การยืนยันถอนอ่านจาก state เดียวกับที่ render
- **#5:** ขั้นตอนอัปเดตต่อด้วยถอนต้องไล่ flag หลายตัว ใน MVI เป็นสถานะเดียว (`update.stage`) ที่ reducer test ได้

## แผนทีละขั้น

แต่ละขั้นเป็น commit แยก พฤติกรรมไม่เปลี่ยน test เดิมต้องผ่าน และเพิ่ม test ของส่วนที่ย้าย

| ขั้น | งาน | ขนาด | ความเสี่ยง |
|---|---|---|---|
| 0 | ADR-0005 บันทึกการตัดสินใจและกฎการพึ่งพา | เล็ก | ไม่มี |
| 1 | ลบของที่ไม่ใช้ (R-d, F-d) ให้ UI ของ Java ใช้ API ทั่วไป | เล็ก | ต่ำ |
| 2 | **React:** โครง MVI (`tools/state.ts`, `intents.ts`, `reduce.ts`, `effects.ts`, `useToolsStore`) แล้วย้าย flow ถอน + อัปเดต + ย้ายโปรไฟล์มาก่อน เพราะเป็นจุดที่บั๊กเกิด พร้อม test ของ reducer | กลาง | กลาง |
| 3 | **React:** ย้ายส่วนที่เหลือทีละส่วน: แผน/Apply/Undo/กู้คืน → ติดตั้ง → โปรไฟล์ → ทำความสะอาด, settings, SDK, shell | กลาง | ต่ำ (ทีละส่วน) |
| 4 | **React:** `ToolsPanel` และส่วนย่อยรับ `{ state, dispatch }` ลบ `useDeveloperTools` และชั้นแปลงใน `App.tsx` | เล็ก | ต่ำ |
| 5 | **Rust:** ย้าย type และกฎล้วนไป `whichcraft/domain` (R-b) เป็นการย้ายไฟล์เท่านั้น | กลาง | ต่ำ |
| 6 | **Rust:** port สำหรับ I/O ที่เหลือ (R-a, R-c, R-f): `InstallationSource`, `InstallerCatalog` ที่ inject เข้า inventory, `SettingsStore`, `SelectionStore`, `JournalStore`, `ProfileStore`, `UninstallLog`, `SdkProbe`, ขยาย `ToolManager` ให้มี install/uninstall พร้อม fake | ใหญ่ | กลาง |
| 7 | **Rust:** ชั้น application รับ `Deps` (ชุด port) ย้าย orchestration ออกจาก commands (R-e) และทำ composition root เป็น Tauri managed state | กลาง | กลาง |
| 8 | **Rust:** commands บางลงเหลือแปลง input → use case → output และเพิ่ม test ของ use case ด้วย fake แทน tempdir ที่ทำได้ | กลาง | ต่ำ |

ลำดับที่แนะนำคือ 0 → 1 → 2 → 3 → 4 แล้วค่อย 5 → 8 ฝั่ง React ได้ประโยชน์ทันทีและไม่แตะ Rust ส่วนฝั่ง Rust ใช้งานได้ถูกต้องอยู่แล้ว (contract test ผ่านบนเครื่องจริง) จึงทำทีหลังได้โดยไม่เร่ง

## ข้อที่ต้องตัดสิน

1. ขอบเขต: ทำทั้งสองฝั่ง หรือฝั่ง React ก่อนแล้วค่อยดูผล
2. ส่วนที่มาจาก Envarly (`env_store`, `model`, `commands/path`, `path_manage`) ให้คงไว้เป็น adapter และ type ภายนอก หรือย้าย type ที่ Whichcraft ใช้ (`EnvSnapshot`, `EnvValue`) เข้า domain ของ Whichcraft แนะนำให้คงไว้และห่อด้วย port เพื่อไม่แตะส่วนที่ fork มา
3. state ของ React ใช้ `useReducer` ที่มีอยู่แล้ว หรือใช้ไลบรารี (เช่น Zustand) แนะนำ `useReducer` + effect runner เล็ก ๆ ของเราเอง เพราะไม่เพิ่ม dependency และ test reducer ได้ตรง
