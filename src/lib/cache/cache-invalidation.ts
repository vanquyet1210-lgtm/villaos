// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/cache/cache-invalidation.ts             ║
// ║  Cache invalidation helpers — SERVER ONLY                   ║
// ║  Tách khỏi query-cache.ts để tránh revalidateTag bị bundle  ║
// ║  vào client (do CalendarShell.tsx import query-cache).      ║
// ╚══════════════════════════════════════════════════════════════╝

import { revalidateTag as _revalidateTag } from 'next/cache';
const revalidateTag = (tag: string) => (_revalidateTag as any)(tag);
import { CACHE_TAGS } from './query-cache';

/**
 * Invalidate cache sau khi tạo/sửa/xóa villa.
 */
export function invalidateVillaCache(villaId: string, ownerId: string) {
  revalidateTag(CACHE_TAGS.villaDetail(villaId));
  revalidateTag(CACHE_TAGS.ownerVillas(ownerId));
  revalidateTag(CACHE_TAGS.villas); // public list cũng cần refresh
}

/**
 * Invalidate cache sau khi tạo/sửa/cancel booking.
 */
export function invalidateBookingCache(villaId: string, ownerId: string) {
  revalidateTag(CACHE_TAGS.villaBookings(villaId));
  revalidateTag(CACHE_TAGS.ownerBookings(ownerId));
  revalidateTag(CACHE_TAGS.bookings);
}
