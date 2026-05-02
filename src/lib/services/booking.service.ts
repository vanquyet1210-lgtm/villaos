// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/services/booking.service.ts (updated)  ║
// ║  Changes:                                                   ║
// ║  • owner_id tự động set qua DB trigger (không cần client)  ║
// ║  • Audit log sau mỗi action                                ║
// ╚══════════════════════════════════════════════════════════════╝

'use server';

import { revalidatePath }             from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapBooking }                 from '@/types/database';
import { logAudit, getCurrentActor }  from './audit.service';
import type { Booking, BookingRow, BookingStatus } from '@/types/database';

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

const HOLD_MINUTES = 30;

// ── CREATE ────────────────────────────────────────────────────────

export async function createBooking(
  input: BookingInput
): Promise<ServiceResult<Booking>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  // Pre-check conflict
  const conflictErr = await _checkConflict(sb, input.villaId, input.checkin, input.checkout);
  if (conflictErr) return conflictErr as ServiceResult<Booking>;

  const lockedErr = await _checkLockedDates(sb, input.villaId, input.checkin, input.checkout);
  if (lockedErr) return lockedErr as ServiceResult<Booking>;

  const holdExpiresAt = input.status === 'hold'
    ? new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString()
    : null;

  const { data, error } = await sb
    .from('bookings')
    .insert({
      villa_id:        input.villaId,
      created_by:      actor.actorId,
      created_by_role: actor.actorRole,
      // owner_id: KHÔNG cần truyền — DB trigger tự set từ villa.owner_id
      customer:        input.customer.trim(),
      email:           input.email?.trim()  ?? null,
      phone:           input.phone?.trim()  ?? null,
      checkin:         input.checkin,
      checkout:        input.checkout,
      status:          input.status,
      total:           input.total,
      note:            input.note?.trim()   ?? null,
      hold_expires_at: holdExpiresAt,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23P01') {
      return { error: 'Villa đã được đặt trong khoảng thời gian này.', code: 'BOOKING_CONFLICT' };
    }
    return { error: error.message };
  }

  const booking = mapBooking(data as BookingRow);

  // ── Audit log ─────────────────────────────────────────────────
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

  revalidatePath('/owner/villas');
  revalidatePath('/sale/calendar');
  return { data: booking };
}


// ── CONFIRM HOLD ──────────────────────────────────────────────────

export async function confirmHold(id: string): Promise<ServiceResult<Booking>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  // Lấy snapshot trước khi thay đổi (cho audit diff)
  const { data: _before } = await sb.from('bookings').select('*').eq('id', id).single();
  const before = _before as any;

  const { data, error } = await sb
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

  revalidatePath('/owner/villas');
  return { data: booking };
}


// ── CANCEL ────────────────────────────────────────────────────────

export async function cancelBooking(id: string): Promise<ServiceResult<Booking>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data: _before } = await sb.from('bookings').select('*').eq('id', id).single();
  const before = _before as any;

  const { data, error } = await sb
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  const booking = mapBooking(data as BookingRow);

  // ⚠️ Quan trọng: log ai cancel, cancel booking gì, lúc nào
  await logAudit({
    actorId:    actor.actorId,
    actorRole:  actor.actorRole,
    actorName:  actor.actorName,
    action:     'booking.cancelled',
    entityType: 'booking',
    entityId:   id,
    entityName: before?.customer,
    oldData:    before ? { status: before.status, checkin: before.checkin, checkout: before.checkout, total: before.total } : undefined,
    newData:    { status: 'cancelled' },
    ownerId:    booking.ownerId,
  });

  revalidatePath('/owner/villas');
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

  const { data: _before } = await sb.from('bookings').select('*').eq('id', id).single();
  const before = _before as any;

  if (patch.checkin || patch.checkout) {
    const newCheckin  = patch.checkin  ?? before?.checkin;
    const newCheckout = patch.checkout ?? before?.checkout;
    if (before && newCheckin && newCheckout) {
      const conflictErr = await _checkConflict(sb, before.villa_id, newCheckin, newCheckout, id);
      if (conflictErr) return conflictErr as ServiceResult<Booking>;
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

  const { data, error } = await sb
    .from('bookings')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23P01') return { error: 'Ngày mới bị trùng với booking khác.', code: 'BOOKING_CONFLICT' };
    return { error: error.message };
  }

  const booking = mapBooking(data as BookingRow);

  // Chỉ log các field thực sự thay đổi
  const changedFields = Object.keys(patch);
  const oldSnapshot = changedFields.reduce((acc, k) => {
    if (before) acc[k] = (before as Record<string, unknown>)[k === 'checkin' ? 'checkin' : k];
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

  revalidatePath('/owner/villas');
  return { data: booking };
}


// ── PRIVATE HELPERS ───────────────────────────────────────────────

async function _checkConflict(
  sb: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  villaId:   string,
  checkin:   string,
  checkout:  string,
  excludeId?: string,
): Promise<ServiceResult | null> {
  let query = sb
    .from('bookings')
    .select('id, checkin, checkout, customer')
    .eq('villa_id', villaId)
    .neq('status', 'cancelled')
    .lt('checkin', checkout)
    .gt('checkout', checkin);

  if (excludeId) query = query.neq('id', excludeId);

  const { data: conflicts } = await query.limit(1);
  if (conflicts?.length) {
    const c = conflicts[0];
    return { error: `Villa đã có booking (${c.checkin} → ${c.checkout}).`, code: 'BOOKING_CONFLICT' };
  }
  return null;
}

async function _checkLockedDates(
  sb: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  villaId: string,
  checkin: string,
  checkout: string,
): Promise<ServiceResult | null> {
  const { data: _villa } = await sb.from('villas').select('locked_dates').eq('id', villaId).single();
  const villa = _villa as any;
  if (!villa?.locked_dates?.length) return null;

  // Half-open interval [checkin, checkout): checkout day NOT blocked
  // → nếu lock ends ngày X, booking checkin ngày X vẫn hợp lệ
  const lockedSet = new Set<string>(villa.locked_dates as string[]);
  let d = new Date(checkin);
  const end = new Date(checkout);
  while (d < end) {
    const ds = d.toISOString().split('T')[0];
    if (lockedSet.has(ds)) {
      return { error: `Ngày ${ds} đã bị chủ nhà khóa.`, code: 'DATE_LOCKED' };
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}
