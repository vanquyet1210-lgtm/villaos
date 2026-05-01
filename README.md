# VillaOS v7 — Giai đoạn 1: Setup

## ✅ Giai đoạn 1 hoàn thành — cấu trúc project

```
villaos/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ✅
│   │   ├── globals.css             ✅ Design system đầy đủ
│   │   ├── page.tsx                ✅ Auto-redirect theo role
│   │   ├── auth/
│   │   │   ├── login/page.tsx      ✅
│   │   │   ├── register/page.tsx   ✅
│   │   │   ├── forgot-password/    ✅
│   │   │   └── callback/route.ts   ✅
│   │   ├── owner/
│   │   │   ├── layout.tsx          ✅ Sidebar + nav
│   │   │   ├── dashboard/page.tsx  ✅ (placeholder)
│   │   │   ├── villas/page.tsx     🔜 Giai đoạn 4
│   │   │   └── calendar/page.tsx   🔜 Giai đoạn 4
│   │   ├── sale/layout.tsx + pages ✅
│   │   ├── admin/layout.tsx + pages✅
│   │   └── customer/layout.tsx + pages ✅
│   ├── components/
│   │   └── AuditLogViewer.tsx      ✅
│   ├── hooks/
│   │   ├── useAuth.ts              ✅
│   │   └── useBookingsRealtime.ts  ✅
│   ├── lib/
│   │   ├── supabase/client.ts      ✅
│   │   ├── supabase/server.ts      ✅
│   │   ├── services/               ✅ auth, villa, booking, audit
│   │   ├── cache/query-cache.ts    ✅
│   │   └── rate-limit.ts          ✅
│   ├── types/database.ts           ✅ Fixed: owner_id trong Booking
│   └── middleware.ts               ✅
├── supabase/
│   ├── schema.sql                  ✅
│   ├── migrations/001_patch.sql    ✅
│   └── seed.ts                     ✅
├── package.json                    ✅
├── next.config.ts                  ✅
├── tsconfig.json                   ✅
└── .env.local.example              ✅
```

---

## 🚀 Cách chạy ngay

### 1. Tạo Supabase project
- Vào https://supabase.com → New Project → chọn Singapore
- Lưu Database Password

### 2. Chạy schema
```
Dashboard → SQL Editor → Paste supabase/schema.sql → Run
Dashboard → SQL Editor → Paste supabase/migrations/001_patch.sql → Run
```

### 3. Lấy API keys
```
Dashboard → Settings → API
```

### 4. Setup .env.local
```bash
cp .env.local.example .env.local
# Điền SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY
```

### 5. Cài packages + chạy
```bash
npm install
npm run dev
```

### 6. Seed demo data
```bash
npm run seed
```

### 7. Test login
```
http://localhost:3000/auth/login
owner@villa.com / Owner@123456
```

---

## 🔧 Config Supabase Auth
```
Dashboard → Authentication → URL Configuration
Site URL: http://localhost:3000
Redirect URLs: http://localhost:3000/auth/callback
```

---

## 📋 Giai đoạn tiếp theo

| Giai đoạn | Nội dung |
|-----------|----------|
| ✅ 1 | Setup project, copy files v7, fix bugs |
| 🔜 2 | Port utils: config.ts, utils.ts, validators.ts |
| 🔜 3 | Port components: Calendar.tsx, AmenityManager.tsx, ImageUploader.tsx |
| 🔜 4 | Build pages: owner/villas, owner/calendar, sale/calendar, admin... |
