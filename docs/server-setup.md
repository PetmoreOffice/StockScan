# คู่มือติดตั้งระบบสแกนผ่าน API ภายใน Server

เบราว์เซอร์ → เว็บสแกนพอร์ต 3000 → API กลาง 127.0.0.1:3001 → SQL

เมื่อเว็บและ API อยู่บน Server เดียวกัน ไม่ต้องเปิดพอร์ต 3001 ให้เครื่องผู้ใช้ เว็บส่ง Firebase token ต่อไปตรวจที่ API ตามเดิม ส่วนสาขายังอ่าน SQL โดยตรงและรายการสแกนบันทึก Excel ผ่านเว็บสแกน

## ติดตั้งครั้งแรก

1. นำ repository ระบบสแกนไปไว้โฟลเดอร์แยก เช่น C:\Apps\product-scan-system (เปลี่ยนตาม path จริง) หากต้องการ git pull ให้ใช้ git clone จาก URL repository ของระบบสแกน อย่าทับโฟลเดอร์ sku-stock
2. ไม่ต้องคัดลอก node_modules หรือ .next ให้ติดตั้ง/build บน Server
3. สร้าง .env จาก .env.example หากยังไม่มี ห้ามทับ .env เดิม ตั้งค่าต่อไปนี้:

```dotenv
DEMO_MODE=false
INVENTORY_API_URL=http://127.0.0.1:3001/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=ค่าจริงของFirebaseโครงการเดียวกับAPI
EXCEL_FILE_PATH=C:/Apps/product-scan-data/ScanData.xlsx
```

ตั้ง SQL_* ให้ตรงกับฐานข้อมูลสำหรับอ่านสาขา ใช้บัญชีอ่านอย่างเดียว และสร้างโฟลเดอร์เก็บ Excel ให้บัญชีที่รันเว็บเขียนได้ ไม่เก็บ .env และ Excel ใน Git ตรวจ .env.local หากมี เพราะอาจทับค่าจาก .env ตัวแปร NEXT_PUBLIC_INVENTORY_API_URL เดิมลบได้

4. เปิด API กลางในโฟลเดอร์ sku-stock ด้วย npm run dev:api แล้วตรวจ http://127.0.0.1:3001/api/v1/health บน Server ให้ได้ ok:true
5. เปิด CMD อีกหน้าต่าง ใช้ pnpm ที่ติดตั้งไว้ตาม lockfile ของโปรเจกต์:

```cmd
cd /d C:\Apps\product-scan-system
pnpm install --frozen-lockfile
pnpm run build
pnpm run start --hostname 0.0.0.0 --port 3000
```

ถ้า pnpm ไม่พบ ให้ติดตั้งผ่านผู้ดูแลเครื่องก่อน ตรวจด้วย pnpm --version

6. ทดสอบ http://127.0.0.1:3000 บน Server: Login, ค้นหาบาร์โค้ด, เลือกสาขา, บันทึก และตรวจ Excel
7. คอม/Handheld เปิด http://192.168.10.250:3000 หาก Server ยังใช้ IP นี้ ให้ IT อนุญาตพอร์ตเว็บ 3000 เฉพาะเครือข่ายที่ใช้ ไม่ต้องเปิดพอร์ต API 3001 สำหรับรูปแบบนี้

HTTP ใช้ทดสอบ LAN สำหรับใช้งานจริงควรมี HTTPS ผ่าน reverse proxy หน้าเว็บ เพราะ token ยังเดินทางจากเบราว์เซอร์ถึงเว็บสแกน การส่งต่อภายใน Server ไม่ได้เข้ารหัสช่วงนั้นให้เอง

## อัปเดตด้วย Git

แก้และทดสอบบนคอม → commit/push → pull บน Server สำรอง Excel ก่อนอัปเดต และหยุดเฉพาะเว็บสแกนด้วย Ctrl+C หรือ End Task ของเว็บสแกน เพื่อไม่ให้มีการบันทึกระหว่าง restart

```cmd
cd /d C:\Apps\product-scan-system
git status --short
git pull --ff-only
pnpm install --frozen-lockfile
pnpm run build
pnpm run start --hostname 0.0.0.0 --port 3000
```

หาก pull/build ล้มเหลว หยุดแก้ข้อผิดพลาดก่อน ไม่ reset ลบงาน ไม่ต้อง restart API กลางเมื่อแก้เฉพาะเว็บสแกน การ pull ทำได้หลัง push โค้ดรุ่นที่ต้องการแล้ว

## เปิดเว็บอัตโนมัติ

หลัง build ผ่าน สร้าง Task Scheduler แยกของเว็บสแกน ตั้ง At startup, Run whether user is logged on or not ใช้บัญชีที่อ่าน .env และเขียน Excel ได้ ตั้ง Actions ตามนี้ โดยปรับ path จริง:

| ช่อง | ค่า |
|---|---|
| Program/script | "C:\Program Files\nodejs\node.exe" |
| Add arguments | "C:\Apps\product-scan-system\node_modules\next\dist\bin\next" start --hostname 0.0.0.0 --port 3000 |
| Start in | C:\Apps\product-scan-system |

ตั้ง Restart on failure, ยกเลิกจำกัดเวลารัน และ Do not start a new instance หยุด CMD เว็บก่อนกด Run Task เพื่อไม่ให้พอร์ตชน API กลางต้องรันค้างหรือมี Task ของตัวเองด้วย

## ทดสอบบนคอมพัฒนา

ถ้ารัน API บนคอมเดียวกัน ใช้ INVENTORY_API_URL=http://127.0.0.1:3001/api/v1 และ pnpm run dev

ถ้า API อยู่บน Server แต่ Next.js อยู่บนคอม ต้องใช้ INVENTORY_API_URL=http://192.168.10.250:3001/api/v1 และคอมยังต้องเข้าถึงพอร์ตนั้นได้ Proxy ไม่ข้าม Firewall ระหว่างเครื่อง

## ข้อผิดพลาด

- 401: ไม่มี token, หมดอายุ หรือ Firebase คนละโครงการ
- 403: อีเมลไม่มีสิทธิ์
- 404: ไม่พบสินค้า/เส้นทางผิด
- 502: เว็บเชื่อม API ไม่สำเร็จ ตรวจ INVENTORY_API_URL, API ยังรันอยู่หรือไม่, timeout
- สาขาไม่ขึ้น: ตรวจ SQL ของเว็บสแกน แยกจาก API lookup
- Excel บันทึกไม่ได้: ตรวจ path, สิทธิ์และไฟล์ถูกเปิดล็อกหรือไม่

API สินค้า สาขา และบันทึก Excel ตรวจ Firebase ID token และอนุญาตเฉพาะบัญชี `@newgenman.co.th` หรือ `@petmoregroups.com` ทุกครั้ง เซิร์ฟเวอร์ต้องเชื่อมต่อ `identitytoolkit.googleapis.com` ผ่าน HTTPS ได้ และตั้ง `NEXT_PUBLIC_FIREBASE_API_KEY` ให้ตรงกับโครงการที่ใช้ Login การตรวจนี้ทำงานใน `DEMO_MODE` ด้วย
