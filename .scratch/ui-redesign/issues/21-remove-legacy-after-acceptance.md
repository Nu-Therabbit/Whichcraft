# 21: ลบ legacy presentation หลังผ่าน Windows acceptance

**What to build:** ส่งมอบ Whichcraft ที่เหลือ UI ใหม่เป็นทางหลักเพียงแบบเดียว หลังพิสูจน์จาก packaged app บน Windows แล้วว่าฟีเจอร์เดิมยังทำงานครบ.

**Blocked by:** 19: ตรวจ Windows จริง: Environment, permissions, shell และ recovery; 20: ตรวจ Windows จริง: inventory และวงจรการติดตั้งเครื่องมือ.

**Status:** ready-for-agent

**Kind:** Integration / contract after acceptance

- [ ] เริ่มถอด legacy fallback ได้เมื่อชุด Windows ทั้งสองผ่านเกณฑ์ที่กำหนดแล้ว; required fail/blocked ยังไม่ถือว่า gate ผ่าน และห้ามใช้ผลจาก API จำลองแทน.
- [ ] ใช้ action/parity inventory ที่เริ่มใน 02 และตรวจ candidate ใน 18 ตรวจการเข้าถึงและผลลัพธ์อีกครั้ง ไม่เริ่มรวบรวมรายการใหม่หลังลบ UI.
- [ ] ลบ legacy presentation/entry points และ compatibility exports/dependencies ที่ไม่มี callers เหลือ หลังย้าย callers ครบ; คง backend, Environment value types และ compatibility ที่ยังจำเป็นพร้อมเหตุผล.
- [ ] production branch ไม่มี prototype variant/switcher/state inspector หรือ simulated data/actions โดยตั้งต้นจาก production base และใช้ต้นแบบเป็น reference; ไม่ merge โค้ด throwaway เข้ามาเพื่อค่อยลบท้ายงาน.
- [ ] build/tests และ dependency checks ที่ได้รับผลกระทบผ่าน พร้อม packaged Windows smoke ของ navigation และ flow ที่การลบอาจกระทบ; ไม่จำเป็นต้องดาวน์โหลด/ถอนซ้ำทุกกรณีที่ไม่มีความเปลี่ยนแปลง แต่ต้องผูกหลักฐานกับ build ที่ตรวจจริง.
- [ ] ระบุผล Windows acceptance ทั้งสองชุด ผล recheck หลัง cleanup และข้อจำกัดคงเหลืออย่างตรงไปตรงมาก่อนปิดงาน; ไม่รายงาน production acceptance จากหน้าตา prototype หรือ build ที่ยังไม่ได้ตรวจ.

## Comments

### Gate (2026-10-24)

Not started. Tickets 19 and 20 have partial installed-candidate evidence and required blocked/not-run cases ([current report](../acceptance/2026-10-24/RESULT.md)). Neither suite has passed, so the legacy presentation stays. Successful builds, equivalent-tool flows and backend contracts do not waive the remaining acceptance gate.
