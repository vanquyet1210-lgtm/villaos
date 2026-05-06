'use server';

import type { Booking } from '@/types/database';

/**
 * Server Action: lấy bookings của một villa — bypass RLS bằng service_role key.
 * CalendarShell gọi trong useEffect polling.
 */
export async function fetchVillaBookingsAction(villaId: string): Promise<Booking[]> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return [];

  const res = await fetch(
    `${supabaseUrl}/rest/v1/bookings?villa_id=eq.${villaId}&status=neq.cancelled&select=*&order=checkin.asc`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) return [];

  const rows = await res.json();
  const now  = new Date();

  return rows
    .filter((r: any) => !(r.status === 'hold' && r.hold_expires_at && new Date(r.hold_expires_at) < now))
    .map((r: any) => ({
      id:              r.id,
      villaId:         r.villa_id,
      ownerId:         r.owner_id,
      createdBy:       r.created_by,
      createdByRole:   r.created_by_role,
      createdByName:   r.created_by_name,
      createdByPhone:  r.created_by_phone,
      customer:        r.customer,
      email:           r.email  ?? '',
      phone:           r.phone  ?? '',
      checkin:         r.checkin,
      checkout:        r.checkout,
      status:          r.status,
      total:           r.total  ?? 0,
      note:            r.note   ?? '',
      holdExpiresAt:   r.hold_expires_at,
      createdAt:       r.created_at,
    }));
}
