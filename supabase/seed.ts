// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — supabase/seed.ts                              ║
// ║  Tạo demo users + seed data (chỉ chạy 1 lần trên dev)      ║
// ║  Chạy: npx tsx supabase/seed.ts                             ║
// ╚══════════════════════════════════════════════════════════════╝

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL             = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Thiếu env vars. Copy .env.local và thử lại.');
  process.exit(1);
}

const adminSb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Demo Users ────────────────────────────────────────────────────

const DEMO_USERS = [
  {
    email:    'admin@villa.com',
    password: 'Admin@123456',   // ← ĐỔI TRƯỚC KHI DEPLOY
    name:     'Super Admin',
    role:     'admin',
    brand:    'VillaOS HQ',
  },
  {
    email:    'owner@villa.com',
    password: 'Owner@123456',
    name:     'Nguyễn Chủ Villa',
    role:     'owner',
    brand:    'VillaOS Đà Nẵng',
  },
  {
    email:    'sale@villa.com',
    password: 'Sale@123456',
    name:     'Trần Sale CTV',
    role:     'sale',
    brand:    'VillaOS Đà Nẵng',
  },
  {
    email:    'customer@villa.com',
    password: 'Customer@123456',
    name:     'Khách Demo',
    role:     'customer',
    brand:    '',
  },
];

// ── Seed Villas ───────────────────────────────────────────────────

const SEED_VILLAS = [
  {
    name: 'Villa Xuân Quỳnh', province: 'Khánh Hòa', district: 'Nha Trang',
    ward: 'Lộc Thọ', street: '12 Xuân Quỳnh',
    bedrooms: 5, adults: 10, children: 5, price: 5000000,
    amenities: ['pool','bbq','seaview','karaoke'],
    description: 'Villa sang trọng với hồ bơi riêng, view biển tuyệt đẹp.',
    emoji: '🏖️', images: [], locked_dates: [], status: 'active',
  },
  {
    name: 'Villa Đoàn Khuê', province: 'Đà Nẵng', district: 'Ngũ Hành Sơn',
    ward: 'Mỹ Khê', street: '270 Đoàn Khuê',
    bedrooms: 6, adults: 12, children: 6, price: 8000000,
    amenities: ['pool','bbq','billiard','karaoke','seaview'],
    description: 'Villa cao cấp đầy đủ tiện ích, phù hợp nhóm lớn.',
    emoji: '🌊', images: [], locked_dates: [], status: 'active',
  },
];

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Bắt đầu seed VillaOS v7...\n');

  let ownerUserId: string | null = null;

  // 1. Tạo users
  for (const u of DEMO_USERS) {
    const { data, error } = await adminSb.auth.admin.createUser({
      email:         u.email,
      password:      u.password,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role, brand: u.brand },
    });

    if (error) {
      if (error.message.includes('already')) {
        console.log(`  ⏭️  ${u.email} — đã tồn tại, bỏ qua`);
      } else {
        console.error(`  ❌ ${u.email}: ${error.message}`);
      }
    } else {
      console.log(`  ✅ Tạo user: ${u.email} (${u.role})`);
      if (u.role === 'owner') ownerUserId = data.user.id;
    }
  }

  // 2. Tạo villas cho owner
  if (ownerUserId) {
    for (const v of SEED_VILLAS) {
      const { error } = await adminSb
        .from('villas')
        .insert({ ...v, owner_id: ownerUserId });

      if (error) {
        console.error(`  ❌ Villa ${v.name}: ${error.message}`);
      } else {
        console.log(`  ✅ Tạo villa: ${v.name}`);
      }
    }
  }

  console.log('\n✅ Seed xong!');
  console.log('\n📋 Demo accounts:');
  DEMO_USERS.forEach(u => {
    console.log(`   ${u.role.padEnd(8)} | ${u.email.padEnd(24)} | ${u.password}`);
  });
}

main().catch(console.error);
