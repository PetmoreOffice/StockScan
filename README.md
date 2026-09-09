# ระบบสแกนสินค้า

ระบบ Next.js สำหรับ Urovo CT58 รับบาร์โค้ดแบบ keyboard wedge ค้นข้อมูลสินค้าและสาขาจาก SQL Server แบบอ่านอย่างเดียว แล้วบันทึกรายการทุกสาขาลง Excel ไฟล์เดียว

## กฎการเชื่อมต่อ SQL Server

แอปมีคำสั่ง SQL สำหรับอ่านข้อมูลเท่านั้น (`SELECT`) และไม่สร้างหรือแก้ไข Table, Column, View, Procedure หรือข้อมูลใด ๆ ในฐานข้อมูลเดิม ควรใช้บัญชี SQL Server ที่มีสิทธิ์ Read-only

## เริ่มต้นใช้งาน

1. คัดลอก `.env.example` เป็น `.env` หรือ `.env.local`
2. ตั้งค่า `SQL_*` และ `EXCEL_FILE_PATH` ให้ตรงกับเครื่องเซิร์ฟเวอร์
3. ใช้ `DEMO_MODE=true` เพื่อดูหน้าจอและทดสอบโดยไม่ต่อ SQL Server
4. ติดตั้งแพ็กเกจด้วย `npm install` หรือ `pnpm install`
5. รันด้วย `npm run dev` หรือ `pnpm dev`

ไฟล์ Excel กลางจะถูกสร้างที่ `data/ScanData.xlsx` หากไม่ได้กำหนด `EXCEL_FILE_PATH` เอง
