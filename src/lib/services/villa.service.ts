// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/services/villa.service.ts               ║
// ╚══════════════════════════════════════════════════════════════╝

'use server';

import { createSupabaseServerClient }                    from '@/lib/supabase/server';
import { mapVilla }                                      from '@/types/database';
import { logAudit, getCurrentActor }                     from './audit.service';
import { invalidateVillaCache }                           from '@/lib/cache/cache-invalidation';
import { getCachedVillas,
         getCachedVillaDetail, getCachedPublicVillas }   from '@/lib/cache/query-cache';
import type { Villa, VillaRow }                          from '@/types/database';

export interface VillaInput {
  name: string; province: string; district: string;
  ward?: string; street?: string; bedrooms: number;
  adults: number; children?: number; price: number;
  amenities?: string[]; description?: string;
  images?: string[]; emoji?: string;
}

export interface ServiceResult<T = void> { data?: T; error?: string; }

// ── Bypass Next.js 'use server' TypeScript inference bug ──────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = (sb: Awaited<ReturnType<typeof createSupabaseServerClient>>) => sb as any;

// ── READ (cached) ─────────────────────────────────────────────────

export async function getVillas(): Promise<ServiceResult<Villa[]>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  try {
    if (actor.actorRole === 'customer') {
      const data = await getCachedPublicVillas();
      return { data };
    }
    if (actor.actorRole === 'owner') {
      const data = await getCachedVillas(actor.actorId);
      return { data };
    }
    const { data, error } = await q(sb).from('villas').select('*').order('created_at', { ascending: false });
    if (error) return { error: error.message };
    return { data: (data as VillaRow[]).map(mapVilla) };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Lỗi không xác định' };
  }
}

export async function getVillaById(id: string): Promise<ServiceResult<Villa>> {
  try {
    const data = await getCachedVillaDetail(id);
    if (!data) return { error: 'Không tìm thấy villa.' };
    return { data };
  } catch {
    return { error: 'Không tìm thấy villa.' };
  }
}

// ── CREATE ────────────────────────────────────────────────────────

export async function createVilla(input: VillaInput): Promise<ServiceResult<Villa>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data, error } = await q(sb)
    .from('villas')
    .insert({
      owner_id:    actor.actorId,
      name:        input.name.trim(),
      province:    input.province,
      district:    input.district,
      ward:        input.ward        ?? null,
      street:      input.street      ?? null,
      bedrooms:    input.bedrooms,
      adults:      input.adults,
      children:    input.children    ?? 0,
      price:       input.price,
      amenities:   input.amenities   ?? [],
      description: input.description ?? null,
      images:      input.images      ?? [],
      emoji:       input.emoji       ?? '🏡',
      locked_dates: [],
      status:      'active',
    })
    .select()
    .single();

  if (error) return { error: error.code === '23514' ? 'Thông tin villa không hợp lệ.' : error.message };

  const villa = mapVilla(data as VillaRow);
  invalidateVillaCache(villa.id, actor.actorId);

  await logAudit({
    actorId: actor.actorId, actorRole: actor.actorRole, actorName: actor.actorName,
    action: 'villa.created', entityType: 'villa',
    entityId: villa.id, entityName: villa.name,
    newData: { name: villa.name, province: villa.province, price: villa.price },
    ownerId: actor.actorId,
  });

  return { data: villa };
}

// ── UPDATE ────────────────────────────────────────────────────────

export async function updateVilla(id: string, patch: Partial<VillaInput>): Promise<ServiceResult<Villa>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data: _before } = await q(sb).from('villas').select('*').eq('id', id).single();
  const before = _before as VillaRow | null;

  const dbPatch: Record<string, unknown> = {};
  if (patch.name        !== undefined) dbPatch.name        = patch.name.trim();
  if (patch.province    !== undefined) dbPatch.province    = patch.province;
  if (patch.district    !== undefined) dbPatch.district    = patch.district;
  if (patch.ward        !== undefined) dbPatch.ward        = patch.ward;
  if (patch.street      !== undefined) dbPatch.street      = patch.street;
  if (patch.bedrooms    !== undefined) dbPatch.bedrooms    = patch.bedrooms;
  if (patch.adults      !== undefined) dbPatch.adults      = patch.adults;
  if (patch.children    !== undefined) dbPatch.children    = patch.children;
  if (patch.price       !== undefined) dbPatch.price       = patch.price;
  if (patch.amenities   !== undefined) dbPatch.amenities   = patch.amenities;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.images      !== undefined) dbPatch.images      = patch.images;
  if (patch.emoji       !== undefined) dbPatch.emoji       = patch.emoji;

  const { data, error } = await q(sb)
    .from('villas')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  const villa = mapVilla(data as VillaRow);
  invalidateVillaCache(id, villa.ownerId);

  await logAudit({
    actorId: actor.actorId, actorRole: actor.actorRole, actorName: actor.actorName,
    action: 'villa.updated', entityType: 'villa',
    entityId: id, entityName: before?.name,
    oldData: before ? { name: before.name, price: before.price } : undefined,
    newData: dbPatch,
    ownerId: villa.ownerId,
  });

  return { data: villa };
}

// ── DELETE ────────────────────────────────────────────────────────

export async function deleteVilla(id: string): Promise<ServiceResult> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data: _before } = await q(sb).from('villas').select('*').eq('id', id).single();
  const before = _before as VillaRow | null;

  const { error } = await q(sb).from('villas').delete().eq('id', id);
  if (error) return { error: error.message };

  if (before) {
    invalidateVillaCache(id, before.owner_id);
    await logAudit({
      actorId: actor.actorId, actorRole: actor.actorRole, actorName: actor.actorName,
      action: 'villa.deleted', entityType: 'villa',
      entityId: id, entityName: before.name,
      oldData: { name: before.name, province: before.province },
      ownerId: before.owner_id,
    });
  }

  return {};
}

// ── TOGGLE LOCK DATE ──────────────────────────────────────────────

export async function toggleLockDate(villaId: string, dateStr: string): Promise<ServiceResult<string[]>> {
  const sb    = await createSupabaseServerClient();
  const actor = await getCurrentActor();
  if (!actor) return { error: 'Chưa đăng nhập.' };

  const { data: _current } = await q(sb)
    .from('villas')
    .select('locked_dates, owner_id, name')
    .eq('id', villaId)
    .single();
  const current = _current as Pick<VillaRow, 'locked_dates' | 'owner_id' | 'name'> | null;
  if (!current) return { error: 'Không tìm thấy villa.' };

  const currentLocked: string[] = current.locked_dates ?? [];
  const isLocked  = currentLocked.includes(dateStr);
  const newLocked = isLocked
    ? currentLocked.filter(d => d !== dateStr)
    : [...currentLocked, dateStr].sort();

  const { data, error } = await q(sb)
    .from('villas')
    .update({ locked_dates: newLocked })
    .eq('id', villaId)
    .select('locked_dates')
    .single();

  if (error) return { error: error.message };

  invalidateVillaCache(villaId, current.owner_id);

  await logAudit({
    actorId: actor.actorId, actorRole: actor.actorRole, actorName: actor.actorName,
    action: isLocked ? 'villa.date_unlocked' : 'villa.date_locked',
    entityType: 'villa', entityId: villaId, entityName: current.name,
    newData: { date: dateStr },
    ownerId: current.owner_id,
  });

  const result = data as Pick<VillaRow, 'locked_dates'>;
  return { data: result.locked_dates };
}
