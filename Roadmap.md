# 🎮 Steam Deals Tinder — Project Roadmap & Blueprint

เว็บแอปพลิเคชันสไตล์ Tinder สำหรับค้นหา **เกมที่กำลังลดราคาบน Steam**  
ปัดซ้ายเพื่อข้าม (`SKIP`) • ปัดขวาเพื่อเก็บเข้าคลัง (`FAVORITE`) • พร้อมระบบกรองตามแนวเกม งบประมาณ % ส่วนลด และผู้พัฒนา/ผู้จัดจำหน่าย

---

## 1. Tech Stack & Tools

| ส่วนงาน | เทคโนโลยี | หน้าที่หลัก |
| :--- | :--- | :--- |
| **Frontend** | **Next.js (App Router) + React** | หน้าเว็บหลัก, Routing, SSR/Client Components |
| **Styling & Motion** | **Tailwind CSS + Framer Motion** | ตกแต่ง UI และทำ Gesture ลาก/ปัดการ์ดซ้าย-ขวาแบบลื่น ๆ |
| **Backend & Worker** | **NestJS (TypeScript)** | REST API Server และ Background Worker สำหรับดึงข้อมูล Steam |
| **Scheduler & Validation** | **`@nestjs/schedule`, `class-validator`** | ตั้งเวลา Sync ดีลเกมอัตโนมัติ และตรวจสอบข้อมูลขาเข้า (DTO) |
| **Database** | **PostgreSQL** | เก็บข้อมูลเกม, ราคา/ส่วนลด, ผู้พัฒนา, หมวดหมู่ และประวัติการปัด |
| **ORM** | **Prisma** | จัดการ Schema, Migration และ Query ข้อมูลแบบ Type-safe |
| **External Data** | **Steam Storefront API** | ดึงรายชื่อเกมลดราคา (`specials`) และรายละเอียดเกม (`appdetails`) |
| **Local Dev Infra** | **Docker & Docker Compose** | รัน PostgreSQL บนเครื่องแบบไม่ต้องลง DB เองให้ยุ่งยาก |

---

## 2. System Architecture (ภาพรวมการทำงาน)

> **ทำไมหน้าเว็บไม่ยิงไปหา Steam โดยตรง?**  
> 1. เบราว์เซอร์จะติดปัญหา **CORS**  
> 2. Steam จำกัด **Rate Limit** เข้มงวด ถ้ายิงสดทุกครั้งที่ผู้ใช้ปัดจะโดนบล็อกชั่วคราว  
> **ทางแก้:** ใช้ NestJS ค่อย ๆ ดึงข้อมูลมาเก็บใน PostgreSQL ล่วงหน้า แล้วให้ Next.js คุยกับ NestJS เท่านั้น

```text
[ Steam Store API ]
        │  (Sync Worker + Rate Limit Guard)
        ▼
[ NestJS Backend ]  ◄──── REST API ────►  [ Next.js Frontend ]
        │                                  (Swipe Deck / Filters / Favorites)
        ▼
[ PostgreSQL (via Prisma) ]
```

---

## 3. Planned Project Structure (โครงสร้างโฟลเดอร์)

```text
(parent-folder)/
├── wumu-api/                # NestJS + Prisma (Backend & Steam Sync Worker)
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   ├── docker-compose.yml   # PostgreSQL container สำหรับพัฒนา
│   └── Roadmap.md           # เอกสารแผนงานฉบับนี้
└── wumu-web/                # Next.js + React + Tailwind (Frontend)
    └── src/
```

---

## 4. Roadmap (แผนพัฒนาทีละขั้น)

### Phase 0: เตรียมความพร้อม & วางโครงสร้าง (Setup)
- [x] เช็กเครื่องมือในเครื่อง (Node.js, npm/pnpm, Docker หรือ PostgreSQL)
- [x] สร้าง `docker-compose.yml` และรัน PostgreSQL ให้พร้อมใช้งาน
- [x] สร้างโปรเจกต์ `wumu-api` (NestJS) และ `wumu-web` (Next.js)
- [x] ตั้งค่าไฟล์ `.env` และทดสอบเชื่อมต่อฐานข้อมูลเบื้องต้น

### Phase 1: ออกแบบ Database ด้วย Prisma (Data Modeling)
- [x] ติดตั้ง Prisma ใน `wumu-api`
- [x] ออกแบบตารางหลัก:
  - `Game`: `steamAppId`, `name`, `shortDescription`, `headerImage`, `screenshots`, `trailerUrl`, `priceInitial`, `priceFinal`, `discountPercent`, `isOnSale`, `developers[]`, `publishers[]`, `genres[]`, `categories[]`
  - `User`: รองรับ Guest ID (สำหรับเล่นทันที) และเผื่อขยายเป็น Steam ID ในอนาคต
  - `UserSwipe`: เก็บคู่ `(userId, gameId)` และสถานะ `FAVORITE` / `SKIP`
- [x] รัน Migration แรก และตรวจสอบตารางผ่าน `Prisma Studio`

### Phase 2: ระบบดึงข้อมูลเกมลดราคาจาก Steam (Steam Sync Worker)
- [x] ทดสอบยิง Steam API จริงเพื่อดูโครงสร้าง JSON (เน้นโซนไทย `cc=th&l=thai` เพื่อได้ราคา THB และคำอธิบายไทยถ้ามี)
- [x] สร้าง Sync Service ใน NestJS:
  - ดึงรายการเกมที่กำลังลดราคาอยู่ ณ เวลานั้น
  - **Smart Caching:** ถ้าเกมมีใน DB แล้ว ให้อัปเดตแค่ *ราคา, % ส่วนลด, `isOnSale = true`* (ไม่ยิง `appdetails` ซ้ำ)
  - ถ้าเป็นเกมใหม่ ค่อยเข้าคิวยิง `appdetails` โดยใส่ **Delay / Rate Limit Guard** (เช่น เว้นช่วงทุก 1.5–2 วินาที)
  - เกมที่หลุดจากรายการลดราคาแล้ว ให้ปรับเป็น `isOnSale = false`
- [x] ตั้ง Cron Job ด้วย `@nestjs/schedule` ให้อัปเดตดีลอัตโนมัติ

### Phase 3: Backend REST API สำหรับปัด & Filter (NestJS)
- [x] ทำระบบระบุตัวตนเบื้องต้น (Guest User ID ผ่าน Header หรือ Cookie)
- [x] `GET /games/deck` — ดึงการ์ดเกมที่ `isOnSale = true` และ **ตัดเกมที่ User เคยปัดไปแล้วออก**
  - รองรับ Filter: `genres`, `categories`, `developer`, `publisher`, `maxPrice`, `minDiscount`
- [x] `POST /swipes` — บันทึกผล `FAVORITE` หรือ `SKIP` (พร้อม Validation ด้วย DTO)
- [x] `GET /favorites` — ดึงรายการเกมที่ปัดขวาเก็บไว้ (รวมถึงเกมที่อาจหมดโปรแล้ว)
- [x] `DELETE /favorites/:gameId` — ลบออกจาก Favorite (หรือย้ายสถานะ)
- [x] เปิด CORS และทดสอบ API ทุกตัว

### Phase 4: หน้าเว็บปัดการ์ดแบบ Tinder (Next.js + React)
- [x] ตั้งค่า Layout, Tailwind CSS และ Theme (แนว Gaming / Dark Mode)
- [x] สร้าง **Game Card** แสดง:
  - รูปปก, ชื่อเกม, ป้าย `-%` ส่วนลด, ราคาเต็ม (ขีดฆ่า) vs ราคาลด (THB)
  - แท็ก `Genres`, ชื่อ `Developer` / `Publisher`, คำอธิบายสั้น
  - กดขยายดูรายละเอียดเพิ่มเติม / Screenshots / Trailer / ลิงก์ไปหน้า Steam Store
- [x] ทำ **Swipe Gesture** ด้วย Framer Motion (ลากซ้าย = Skip, ลากขวา = Favorite) + ปุ่มกดสำหรับคนใช้เมาส์/คีย์บอร์ด (ลูกศรซ้าย-ขวา)
- [x] ทำระบบ **Preload รูปภาพ** การ์ดถัดไป 2–3 ใบ เพื่อไม่ให้กระตุกตอนปัด
- [x] สร้าง **Filter Bar / Modal** (เลือกหมวดหมู่, งบสูงสุด, % ลดขั้นต่ำ)
- [x] สร้างหน้า **Favorites** (แสดงป้ายบอกว่าเกมไหน *"กำลังลดอยู่"* หรือ *"หมดโปรแล้ว"*)

### Phase 5: ขัดเกลา & ฟีเจอร์ต่อยอด (Polish & Future Ideas)
- [ ] ปุ่ม **Undo** ย้อนกลับการ์ดล่าสุดกรณีปัดพลาด
- [ ] ปุ่ม **Reset Skipped** หรือเงื่อนไข *"นำเกมที่เคย Skip กลับมาโชว์ใหม่ถ้าลดหนักกว่าเดิม"*
- [ ] ระบบ **Steam Login (OpenID)** เพื่อซ่อนเกมที่ User มีในคลังแล้ว (`GetOwnedGames`)
- [ ] เตรียม Deploy (เช่น Web บน Vercel + API/DB บน Railway / Render / Supabase)

---

## 5. ข้อควรระวังทางเทคนิค (Technical Notes)

1. **ขอบเขตข้อมูลของ Steam `appdetails`:**
   - มี: `developers`, `publishers`, `genres` (เช่น Action, RPG), `categories` (เช่น Co-op, Controller Support), `price_overview`, รูป/วิดีโอ
   - **ไม่มี:** User-defined Tags (เช่น *Soulslike, Cozy, Roguelike*) หากต้องการในอนาคตต้องดึงเสริมจากแหล่งอื่น
2. **บางเกมไม่มี `price_overview` หรือคำอธิบายภาษาไทย:**
   - เกมฟรีจะไม่มี `price_overview` (ต้องเช็ก `is_free` แทน) และหากเกมไม่มีคำอธิบายภาษาไทยควร Fallback เป็นภาษาอังกฤษ (`l=english`)
3. **Favorites เมื่อหมดโปร:**
   - เกมที่ User ปัดขวาเก็บไว้ **ไม่ควรถูกลบ** เมื่อหมดช่วงลดราคา แค่เปลี่ยนการแสดงผลสถานะราคาให้ตรงตามจริง
