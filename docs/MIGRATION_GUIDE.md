# 🚀 VillaOS v7 — Migration Guide: localStorage → Supabase SaaS

## Tổng quan kiến trúc mới

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌──────────┐  useAuth()  ┌────────────────────────────┐   │
│  │ React    │◄────────────│ Supabase JS Client          │   │
│  │ Components│  RLS token │ (anon key + JWT session)    │   │
│  └──────────┘             └────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────┘
                                   │ HTTPS
┌──────────────────────────────────▼──────────────────────────┐
│  Next.js Server (Vercel / Railway)                          │
│  ┌─────────────┐   ┌──────────────────────────────────────┐ │
│  │ middleware  │   │ Server Actions                        │ │
│  │ (auth guard │   │ auth.service.ts                       │ │
│  │  role check)│   │ villa.service.ts                      │ │
│  └─────────────┘   │ booking.service.ts                    │ │
│                    └──────────────────┬───────────────────┘ │
└───────────────────────────────────────┼─────────────────────┘
                                        │ Service Role (server only)
                                        │ Anon Key (RLS-protected)
┌───────────────────────────────────────▼─────────────────────┐
│  Supabase                                                    │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ Auth (bcrypt)│  │ PostgreSQL     │  │ Realtime         │ │
│  │ JWT sessions │  │ + RLS policies │  │ (live calendar)  │ │
│  │ Email confirm│  │ + EXCLUDE      │  │                  │ │
│  └──────────────┘  │   constraint   │  └──────────────────┘ │
│                    └────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 File structure tạo ra

```
villaos-saas/
├── supabase/
│   ├── schema.sql          ← Chạy 1 lần trong Supabase SQL Editor
│   └── seed.ts             ← Tạo demo users (dev only)
│
├── types/
│   └── database.ts         ← TypeScript types + mappers
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts       ← Browser Supabase client
│   │   └── server.ts       ← Server Supabase client + admin client
│   └── services/
│       ├── auth.service.ts     ← Login, register, logout (Server Actions)
│       ├── villa.service.ts    ← CRUD villa (Server Actions)
│       └── booking.service.ts  ← CRUD booking (Server Actions)
│
├── hooks/
│   └── useAuth.ts          ← React hook thay APP.user / APP.role
│
├── middleware.ts            ← Auth guard + role routing (server-side)
│
├── app/
│   └── auth/
│       ├── login/page.tsx
│       ├── register/page.tsx
│       └── callback/route.ts  ← OAuth + email confirm handler
│
└── .env.local.example
```

---

## 🔧 Setup từng bước

### Bước 1 — Tạo Supabase project

1. Vào https://supabase.com → New Project
2. Đặt tên: `villaos-prod`
3. Chọn region: `Southeast Asia (Singapore)`
4. Lưu Database Password an toàn

### Bước 2 — Chạy schema

```
Supabase Dashboard → SQL Editor → New Query
→ Paste toàn bộ nội dung supabase/schema.sql
→ Run
```

### Bước 3 — Lấy API keys

```
Dashboard → Settings → API
→ Copy: Project URL, anon key, service_role key
→ Paste vào .env.local (copy từ .env.local.example)
```

### Bước 4 — Cài packages

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Bước 5 — Setup Next.js project

```bash
npx create-next-app@latest villaos --typescript --app --tailwind
cd villaos

# Copy các file từ migration guide này vào đúng vị trí
# (xem File structure ở trên)
```

### Bước 6 — Seed demo data

```bash
# Cần tsx: npm install -D tsx
npx tsx supabase/seed.ts
```

### Bước 7 — Config Supabase Auth

```
Dashboard → Authentication → URL Configuration
Site URL: http://localhost:3000
Redirect URLs: http://localhost:3000/auth/callback
```

---

## 🔄 Migration map — Code cũ → Code mới

| Code cũ (v6)                          | Code mới (v7)                        |
|---------------------------------------|--------------------------------------|
| `APP.user`, `APP.role`                | `useAuth()` hook                     |
| `UserService.findUserByCredentials()` | `loginAction()`                      |
| `UserService.register()`              | `registerAction()`                   |
| `StorageService.loadVillas()`         | `getVillas()` Server Action          |
| `VillaService.add()`                  | `createVilla()` Server Action        |
| `VillaService.update()`               | `updateVilla()` Server Action        |
| `BookingService.add()`                | `createBooking()` Server Action      |
| `BookingService.hasConflict()`        | PostgreSQL EXCLUDE constraint        |
| `localStorage.getItem()`             | Supabase PostgreSQL                  |
| Role check: `APP.role === 'owner'`    | `middleware.ts` + RLS + `useAuth()`  |
| `doLogout()`                          | `logoutAction()`                     |
| `adminCreateUser()`                   | `adminCreateUserAction()`            |

---

## 🔐 Security layers — v6 vs v7

```
                v6 (dễ bypass)          v7 (không bypass được)
               ─────────────────────    ─────────────────────────────
Password       Plain text localStorage  bcrypt trong Supabase Auth
Auth           Client-side check        JWT + server verification
Role           APP.role (đổi được)      DB profile + middleware + RLS
Booking lock   Client-side JS           PostgreSQL EXCLUDE constraint
Route guard    URL check trong JS       Next.js middleware (server)
Data access    Không có                 Row Level Security (per-user)
Admin create   HTML form trực tiếp      Server Action + verify caller
```

---

## ⚡ Realtime Calendar (bonus)

Sau khi setup xong auth, thêm realtime vào calendar:

```typescript
// hooks/useBookingsRealtime.ts
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Booking } from '@/types/database';

export function useBookingsRealtime(villaId: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const sb = getSupabaseBrowserClient();

  useEffect(() => {
    // Subscribe to realtime changes
    const channel = sb
      .channel(`bookings:${villaId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'bookings',
        filter: `villa_id=eq.${villaId}`,
      }, (payload) => {
        // Khi có booking mới/update → tự reload calendar
        if (payload.eventType === 'INSERT') {
          setBookings(prev => [...prev, mapBooking(payload.new as BookingRow)]);
        } else if (payload.eventType === 'UPDATE') {
          setBookings(prev => prev.map(b =>
            b.id === payload.new.id ? mapBooking(payload.new as BookingRow) : b
          ));
        } else if (payload.eventType === 'DELETE') {
          setBookings(prev => prev.filter(b => b.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [villaId]);

  return bookings;
}
```

---

## 🚀 Deploy lên Vercel

```bash
# 1. Push lên GitHub
git init && git add . && git commit -m "VillaOS v7"
git remote add origin https://github.com/you/villaos
git push -u origin main

# 2. Import vào Vercel
# vercel.com → Import Project → GitHub

# 3. Add env vars trong Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# 4. Update Supabase redirect URLs:
# Dashboard → Auth → URL Configuration
# Site URL: https://your-domain.vercel.app
# Redirect URLs: https://your-domain.vercel.app/auth/callback
```

---

## ✅ Checklist trước khi go-live

- [ ] Xóa DEMO_USERS khỏi `seed.ts` trước khi seed production
- [ ] Đổi tất cả demo passwords thành strong passwords
- [ ] Enable Email Confirmation trong Supabase Dashboard
- [ ] Setup custom SMTP (Resend / SendGrid) thay Supabase email mặc định
- [ ] Enable 2FA cho Supabase Dashboard account
- [ ] Rotate service_role key sau khi deploy
- [ ] Setup Supabase backups (Settings → Database → Backups)
- [ ] Setup `pg_cron` để auto-expire holds:
  ```sql
  SELECT cron.schedule('expire-holds', '*/5 * * * *', 'SELECT expire_holds();');
  ```
- [ ] Review RLS policies với dữ liệu thật
- [ ] Test từng role trong môi trường staging
