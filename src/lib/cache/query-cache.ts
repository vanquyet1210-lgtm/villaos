// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/cache/query-cache.ts                    ║
// ║  Next.js Data Cache với tag-based invalidation              ║
// ║  Thay thế: mỗi render gọi Supabase → cache 60s, invalidate  ║
// ║  khi có mutation                                            ║
// ╚══════════════════════════════════════════════════════════════╝

import { unstable_cache } from 'next/cache';
import { mapVilla, mapBooking } from '@/types/database';
import type { Villa, Booking, VillaRow, BookingRow } from '@/types/database';

// ── Cache Tags — dùng để invalidate đúng chỗ ─────────────────────

export const CACHE_TAGS = {
  // Global tags
  villas:         'villas',
  bookings:       'bookings',
  // Per-owner tags
  ownerVillas:    (ownerId: string)  => `owner:${ownerId}:villas`,
  ownerBookings:  (ownerId: string)  => `owner:${ownerId}:bookings`,
  // Per-villa tags
  villaBookings:  (villaId: string)  => `villa:${villaId}:bookings`,
  villaDetail:    (villaId: string)  => `villa:${villaId}`,
  // Per-user tags
  userProfile:    (userId: string)   => `user:${userId}:profile`,
} as const;

// ── Cache TTL ─────────────────────────────────────────────────────
// Villa list: 5 phút (ít thay đổi)
// Booking list: 30 giây (thay đổi thường xuyên hơn)
// Calendar: 30 giây (realtime quan trọng)

const TTL = {
  VILLAS:   300,   // 5 phút
  BOOKINGS: 30,    // 30 giây
  PROFILE:  600,   // 10 phút
};


// ══════════════════════════════════════════════════════════════════
// CACHED QUERIES
// Mỗi function dưới đây được wrap bởi unstable_cache.
// Khi data thay đổi (mutation), gọi revalidateTag() để invalidate.
// ══════════════════════════════════════════════════════════════════

/**
 * Lấy villas — cached per owner.
 * Cache key: owner ID → mỗi owner có cache riêng (multi-tenant safe).
 */
export function getCachedVillas(ownerId: string) {
  return unstable_cache(
    async (): Promise<Villa[]> => {
      // ⚠️ Không thể dùng createSupabaseServerClient() trong cached function
      // vì cookies() không available trong cache context.
      // Dùng service_role + filter by owner_id thay thế.
      const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
      const sb = createSupabaseAdminClient();

      const { data, error } = await sb
        .from('villas')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data as VillaRow[]).map(mapVilla);
    },
    [`villas:${ownerId}`],  // unique cache key
    {
      revalidate: TTL.VILLAS,
      tags: [
        CACHE_TAGS.villas,
        CACHE_TAGS.ownerVillas(ownerId),
      ],
    }
  )();
}

/**
 * Lấy villas public (customer browse) — cache chung cho tất cả users.
 */
export const getCachedPublicVillas = unstable_cache(
  async (): Promise<Villa[]> => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
    const sb = createSupabaseAdminClient();

    const { data, error } = await sb
      .from('villas')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as VillaRow[]).map(mapVilla);
  },
  ['villas:public'],
  {
    revalidate: TTL.VILLAS,
    tags: [CACHE_TAGS.villas],
  }
);

/**
 * Lấy chi tiết 1 villa — cached per villaId.
 */
export function getCachedVillaDetail(villaId: string) {
  return unstable_cache(
    async (): Promise<Villa | null> => {
      const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
      const sb = createSupabaseAdminClient();

      const { data } = await sb
        .from('villas')
        .select('*')
        .eq('id', villaId)
        .single();

      return data ? mapVilla(data as VillaRow) : null;
    },
    [`villa:${villaId}`],
    {
      revalidate: TTL.VILLAS,
      tags: [CACHE_TAGS.villaDetail(villaId)],
    }
  )();
}

/**
 * Lấy bookings của 1 villa — cached per villaId.
 * TTL ngắn (30s) vì calendar cần near-realtime.
 */
export function getCachedVillaBookings(villaId: string) {
  return unstable_cache(
    async (): Promise<Booking[]> => {
      const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
      const sb = createSupabaseAdminClient();

      const { data, error } = await sb
        .from('bookings')
        .select('*, creator:profiles!created_by(name, phone)')
        .eq('villa_id', villaId)
        .neq('status', 'cancelled')
        .order('checkin', { ascending: true });

      if (error) throw new Error(error.message);
      return (data as any[]).map(row => ({
        ...mapBooking(row),
        createdByName:  row.creator?.name  ?? undefined,
        createdByPhone: row.creator?.phone ?? undefined,
      }));
    },
    [`bookings:villa:${villaId}`],
    {
      revalidate: TTL.BOOKINGS,
      tags: [
        CACHE_TAGS.bookings,
        CACHE_TAGS.villaBookings(villaId),
      ],
    }
  )();
}

/**
 * Lấy tất cả bookings của 1 owner — cho dashboard/analytics.
 */
export function getCachedOwnerBookings(ownerId: string) {
  return unstable_cache(
    async (): Promise<Booking[]> => {
      const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
      const sb = createSupabaseAdminClient();

      const { data, error } = await sb
        .from('bookings')
        .select('*')
        .eq('owner_id', ownerId)          // ← dùng được nhờ PATCH 1
        .order('checkin', { ascending: false });

      if (error) throw new Error(error.message);
      return (data as BookingRow[]).map(mapBooking);
    },
    [`bookings:owner:${ownerId}`],
    {
      revalidate: TTL.BOOKINGS,
      tags: [
        CACHE_TAGS.bookings,
        CACHE_TAGS.ownerBookings(ownerId),
      ],
    }
  )();
}

