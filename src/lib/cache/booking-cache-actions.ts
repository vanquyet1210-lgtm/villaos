// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/cache/booking-cache-actions.ts          ║
// ║  Server Action wrappers cho cached queries                  ║
// ║  Client components gọi qua đây — KHÔNG import query-cache   ║
// ║  trực tiếp (tránh server.ts bị bundle vào client).          ║
// ╚══════════════════════════════════════════════════════════════╝

'use server';

import { getCachedVillaBookings } from './query-cache';
import type { Booking } from '@/types/database';

/**
 * Server Action: lấy bookings của một villa.
 * CalendarShell gọi trong useEffect — an toàn vì đây là 'use server'.
 */
export async function fetchVillaBookingsAction(villaId: string): Promise<Booking[]> {
  return getCachedVillaBookings(villaId);
}
