// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/services/audit.service.ts               ║
// ║  Centralized audit logging — ghi vết mọi thay đổi quan trọng║
// ║  Dùng SECURITY DEFINER function → không cần service_role    ║
// ╚══════════════════════════════════════════════════════════════╝

'use server';

import { headers }                    from 'next/headers';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import type { UserRole }              from '@/types/database';

// ── Audit action types (mirror SQL enum) ─────────────────────────

export type AuditAction =
  | 'booking.created'   | 'booking.confirmed' | 'booking.cancelled'
  | 'booking.updated'   | 'booking.hold_created' | 'booking.hold_expired'
  | 'villa.created'     | 'villa.updated'     | 'villa.deleted'
  | 'villa.date_locked' | 'villa.date_unlocked'
  | 'user.login'        | 'user.logout'       | 'user.registered'
  | 'user.created_by_admin' | 'user.deleted'
  | 'sale.access_granted' | 'sale.access_revoked';

export interface AuditEntry {
  actorId:    string;
  actorRole:  UserRole;
  actorName:  string;
  action:     AuditAction;
  entityType: string;
  entityId:   string;
  entityName?: string;
  oldData?:   Record<string, unknown>;
  newData?:   Record<string, unknown>;
  ownerId?:   string;
}

// ── Main audit function ───────────────────────────────────────────

/**
 * Ghi audit log.
 * Fire-and-forget — KHÔNG throw nếu log thất bại
 * (không muốn audit fail block business logic).
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const sb = await createSupabaseServerClient();
    const hdrs = await headers();
    const ip        = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
                   ?? hdrs.get('x-real-ip')
                   ?? null;
    const userAgent = hdrs.get('user-agent') ?? null;

    // Gọi SECURITY DEFINER function — bypass RLS, không cần service_role key
    await (sb as any).rpc('insert_audit_log', {
      p_actor_id:    entry.actorId,
      p_actor_role:  entry.actorRole,
      p_actor_name:  entry.actorName,
      p_action:      entry.action,
      p_entity_type: entry.entityType,
      p_entity_id:   entry.entityId,
      p_entity_name: entry.entityName ?? null,
      p_old_data:    entry.oldData    ? JSON.stringify(entry.oldData)  : null,
      p_new_data:    entry.newData    ? JSON.stringify(entry.newData)  : null,
      p_owner_id:    entry.ownerId    ?? null,
      p_ip_address:  ip,
      p_user_agent:  userAgent,
    });
  } catch (err) {
    // Audit fail KHÔNG được crash app
    console.error('[Audit] Log failed (non-critical):', err);
  }
}


// ── Helper: Lấy actor info từ session hiện tại ───────────────────

export async function getCurrentActor(): Promise<{
  actorId:   string;
  actorRole: UserRole;
  actorName: string;
  ownerId?:  string;
} | null> {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Dùng admin client để bypass RLS
  const adminSb = createSupabaseAdminClient();
  const { data: _profile } = await adminSb
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single();

  const profile = _profile as any;
  if (!profile) return null;

  return {
    actorId:   profile.id,
    actorRole: profile.role,
    actorName: profile.name,
    // owner_id cho audit: owner = chính họ, sale = cần truyền thêm
    ownerId: profile.role === 'owner' ? profile.id : undefined,
  };
}


// ── READ: Lấy audit logs ─────────────────────────────────────────

export interface AuditLog {
  id:         string;
  actorName:  string;
  actorRole:  UserRole;
  action:     AuditAction;
  entityType: string;
  entityId:   string;
  entityName: string | null;
  oldData:    Record<string, unknown> | null;
  newData:    Record<string, unknown> | null;
  createdAt:  string;
}

export interface AuditFilter {
  entityType?: string;
  entityId?:   string;
  action?:     AuditAction;
  fromDate?:   string;  // ISO
  toDate?:     string;
  limit?:      number;
}

export async function getAuditLogs(
  filter: AuditFilter = {}
): Promise<{ data?: AuditLog[]; error?: string }> {
  const sb = await createSupabaseServerClient();

  let query = sb
    .from('audit_logs')
    .select('id, actor_name, actor_role, action, entity_type, entity_id, entity_name, old_data, new_data, created_at')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100);

  if (filter.entityType) query = query.eq('entity_type', filter.entityType);
  if (filter.entityId)   query = query.eq('entity_id',   filter.entityId);
  if (filter.action)     query = query.eq('action',      filter.action);
  if (filter.fromDate)   query = query.gte('created_at', filter.fromDate);
  if (filter.toDate)     query = query.lte('created_at', filter.toDate);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    data: (data as import('@/types/database').AuditLogRow[]).map(r => ({
      id:         r.id,
      actorName:  r.actor_name,
      actorRole:  r.actor_role,
      action:     r.action as AuditAction,
      entityType: r.entity_type,
      entityId:   r.entity_id,
      entityName: r.entity_name,
      oldData:    r.old_data,
      newData:    r.new_data,
      createdAt:  r.created_at,
    })),
  };
}
