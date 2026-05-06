// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/services/booking.service.ts             ║
// ╚══════════════════════════════════════════════════════════════╝

'use server';

import { revalidatePath }             from 'next/cache';
import { invalidateBookingCache }     from '@/lib/cache/cache-invalidation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapBooking }                 from '@/types/database';
import { logAudit, getCurrentActor }  from './audit.service';
import type { Booking, BookingRow, BookingStatus, VillaRow } from '@/types/database';

export interface BookingInput {
  villaId:  string;
  customer: string;
  email?:   string;
  phone?:   string;
  checkin:  string;
  checkout: string;
  status:   Extract<BookingStatus, 'confirmed' | 'hold'>;
  total:    number;
  note?:    string;
}

export interface ServiceResult<T = void> {
  data?:  T;
  error?: string;
  code?:  string;
}

export type ServiceError = { error: string; code?: string };

const HOLD_MINUTES = 30;

// ── Shorthand: bypass Next.js 'use server' TypeScript inference bug ──
// When 'use server' is present, Next.js's TypeScript plugin breaks Supabase's
// generic type resolution for .from() calls, resolving Insert/Update as 'never'.
// Casting to (sb as any).from() restores correct runtime behaviour.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = (sb: Awaited<ReturnType<typeof createSupabaseServerClient>>) => sb as any;

// ── Date normalization ────────────────────────────────────────────
// Postgres TIMESTAMPTZ: nếu insert '2026-05-03' (không có time),
// Postgres lưu là '2026-05-03T00:00:00Z'. Khi đọc về từ Vietnam (UTC+7),
// đây là 07:00 sáng → vẫn đúng ngày 3/5. NHƯNG nếu Supabase trả về
// '2026-05-02T17:00:00+00:00' thì slice(0,10) = '2026-05-02' SAI.
//
// Fix triệt để: lưu với T12:00:00Z (noon UTC).
// Noon UTC = 19:00 Vietnam → an toàn, không bao giờ bị shift ngày
// dù ở bất kỳ timezone nào từ UTC-11 đến UTC+14.
function toDateOnly(ds: string): string {
  return ds.slice(0, 10) + 'T12:00:00.000Z';
}

// ── CREATE ────────────────────────────────────────────────────────

export async function createBooking(
  input: BookingInput
): Promise<ServiceResult<Booking>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const conflictErr = await _checkConflict(sb, input.villaId, input.checkin, input.checkout);
  if (conflictErr) return conflictErr;

  const lockedErr = await _checkLockedDates(sb, input.villaId, input.checkin, input.checkout);
  if (lockedErr) return lockedErr;

  const holdExpiresAt = input.status === 'hold'
    ? new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString()
    : null;

  const { data, error } = await q(sb)
    .from('bookings')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      villa_id:        input.villaId,
      created_by:      actor.actorId,
      created_by_role: actor.actorRole,
      customer:        input.customer.trim(),
      email:           input.email?.trim()  ?? null,
      phone:           input.phone?.trim()  ?? null,
      checkin:         toDateOnly(input.checkin),
      checkout:        toDateOnly(input.checkout),
      status:          input.status,
      total:           input.total,
      note:            input.note?.trim()   ?? null,
      hold_expires_at: holdExpiresAt,
    } as unknown as never)
    .select()
    .single();

  if (error) {
    if (error.code === '23P01') {
      return { error: 'Villa đã được đặt trong khoảng thời gian này.', code: 'BOOKING_CONFLICT' };
    }
    return { error: error.message };
  }

  const booking = mapBooking(data as BookingRow);

  await logAudit({
    actorId:    actor.actorId,
    actorRole:  actor.actorRole,
    actorName:  actor.actorName,
    action:     input.status === 'hold' ? 'booking.hold_created' : 'booking.created',
    entityType: 'booking',
    entityId:   booking.id,
    entityName: `${input.customer} | ${input.checkin} → ${input.checkout}`,
    newData:    { ...booking },
    ownerId:    booking.ownerId,
  });

  invalidateBookingCache(booking.villaId, booking.ownerId);
  revalidatePath('/owner/villas');
  revalidatePath('/owner/calendar');
  revalidatePath('/sale/calendar');
  return { data: booking };
}


// ── CONFIRM HOLD ──────────────────────────────────────────────────

export async function confirmHold(id: string): Promise<ServiceResult<Booking>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data: _before } = await q(sb).from('bookings').select('*').eq('id', id).single();
  const before = _before as BookingRow | null;

  const { data, error } = await q(sb)
    .from('bookings')
    .update({ status: 'confirmed', hold_expires_at: null })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  const booking = mapBooking(data as BookingRow);

  await logAudit({
    actorId:    actor.actorId,
    actorRole:  actor.actorRole,
    actorName:  actor.actorName,
    action:     'booking.confirmed',
    entityType: 'booking',
    entityId:   id,
    entityName: before?.customer,
    oldData:    before ? { status: before.status } : undefined,
    newData:    { status: 'confirmed' },
    ownerId:    booking.ownerId,
  });

  invalidateBookingCache(booking.villaId, booking.ownerId);
  revalidatePath('/owner/villas');
  revalidatePath('/owner/calendar');
  revalidatePath('/sale/calendar');
  return { data: booking };
}


// ── CANCEL ────────────────────────────────────────────────────────

export async function cancelBooking(id: string): Promise<ServiceResult<Booking>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data: _before } = await q(sb).from('bookings').select('*').eq('id', id).single();
  const before = _before as BookingRow | null;

  const { data, error } = await q(sb)
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  const booking = mapBooking(data as BookingRow);

  await logAudit({
    actorId:    actor.actorId,
    actorRole:  actor.actorRole,
    actorName:  actor.actorName,
    action:     'booking.cancelled',
    entityType: 'booking',
    entityId:   id,
    entityName: before?.customer,
    oldData:    before
      ? { status: before.status, checkin: before.checkin, checkout: before.checkout, total: before.total }
      : undefined,
    newData:    { status: 'cancelled' },
    ownerId:    booking.ownerId,
  });

  invalidateBookingCache(booking.villaId, booking.ownerId);
  revalidatePath('/owner/villas');
  revalidatePath('/owner/calendar');
  revalidatePath('/sale/calendar');
  return { data: booking };
}


// ── UPDATE BOOKING ────────────────────────────────────────────────

export async function updateBooking(
  id:    string,
  patch: Partial<Pick<BookingInput, 'customer' | 'email' | 'phone' | 'note' | 'total' | 'checkin' | 'checkout'>>
): Promise<ServiceResult<Booking>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data: _before } = await q(sb).from('bookings').select('*').eq('id', id).single();
  const before = _before as BookingRow | null;

  if (patch.checkin || patch.checkout) {
    const newCheckin  = patch.checkin  ?? before?.checkin;
    const newCheckout = patch.checkout ?? before?.checkout;
    if (before && newCheckin && newCheckout) {
      const conflictErr = await _checkConflict(sb, before.villa_id, newCheckin, newCheckout, id);
      if (conflictErr) return conflictErr;
    }
  }

  const dbPatch: Record<string, unknown> = {};
  if (patch.customer !== undefined) dbPatch.customer = patch.customer.trim();
  if (patch.email    !== undefined) dbPatch.email    = patch.email;
  if (patch.phone    !== undefined) dbPatch.phone    = patch.phone;
  if (patch.note     !== undefined) dbPatch.note     = patch.note;
  if (patch.total    !== undefined) dbPatch.total    = patch.total;
  if (patch.checkin  !== undefined) dbPatch.checkin  = patch.checkin;
  if (patch.checkout !== undefined) dbPatch.checkout = patch.checkout;

  const { data, error } = await q(sb)
    .from('bookings')
    .update(dbPatch as unknown as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23P01') return { error: 'Ngày mới bị trùng với booking khác.', code: 'BOOKING_CONFLICT' };
    return { error: error.message };
  }

  const booking = mapBooking(data as BookingRow);

  const changedFields = Object.keys(patch);
  const oldSnapshot = changedFields.reduce((acc, k) => {
    if (before) acc[k] = (before as unknown as Record<string, unknown>)[k];
    return acc;
  }, {} as Record<string, unknown>);

  await logAudit({
    actorId:    actor.actorId,
    actorRole:  actor.actorRole,
    actorName:  actor.actorName,
    action:     'booking.updated',
    entityType: 'booking',
    entityId:   id,
    entityName: before?.customer,
    oldData:    oldSnapshot,
    newData:    patch as Record<string, unknown>,
    ownerId:    booking.ownerId,
  });

  invalidateBookingCache(booking.villaId, booking.ownerId);
  revalidatePath('/owner/villas');
  revalidatePath('/owner/calendar');
  revalidatePath('/sale/calendar');
  return { data: booking };
}


// ── PRIVATE HELPERS ───────────────────────────────────────────────

type SB = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function _checkConflict(
  sb: SB,
  villaId:    string,
  checkin:    string,
  checkout:   string,
  excludeId?: string,
): Promise<ServiceError | null> {
  const nowIso = new Date().toISOString();
  // Bỏ qua: cancelled + hold đã hết hạn (hold_expires_at < now)
  let query = q(sb)
    .from('bookings')
    .select('id, checkin, checkout, customer, status, hold_expires_at')
    .eq('villa_id', villaId)
    .neq('status', 'cancelled')
    .or(`status.neq.hold,hold_expires_at.gt.${nowIso}`)
    .lt('checkin', checkout)
    .gt('checkout', checkin);

  if (excludeId) query = query.neq('id', excludeId);

  const { data: conflicts } = await query.limit(1);
  if (conflicts?.length) {
    const c = conflicts[0] as Pick<BookingRow, 'checkin' | 'checkout'>;
    return { error: `Villa đã có booking (${c.checkin} → ${c.checkout}).`, code: 'BOOKING_CONFLICT' };
  }
  return null;
}

async function _checkLockedDates(
  sb: SB,
  villaId: string,
  checkin:  string,
  checkout: string,
): Promise<ServiceError | null> {
  const { data: _villa } = await q(sb)
    .from('villas')
    .select('locked_dates')
    .eq('id', villaId)
    .single();
  const villa = _villa as Pick<VillaRow, 'locked_dates'> | null;
  if (!villa?.locked_dates?.length) return null;

  // Check locked dates: dùng plain YYYY-MM-DD (KHÔNG dùng toDateOnly vì
  // toDateOnly thêm T12:00:00Z — chỉ dùng cho INSERT, không dùng so sánh chuỗi)
  // Logic half-open [checkin, checkout): ngày checkout KHÔNG bị check
  let ci = checkin.slice(0, 10);
  const co = checkout.slice(0, 10);
  while (ci < co) {
    if (villa.locked_dates.includes(ci)) {
      return { error: `Ngày ${ci} đã bị chủ nhà khóa.`, code: 'DATE_LOCKED' };
    }
    // Advance 1 day via Date.UTC (no timezone issue)
    const [y, m, d] = ci.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    ci = next.toISOString().slice(0, 10);
  }
  return null;
}
