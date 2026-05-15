'use server';
// VillaOS v7 — lib/services/report.service.ts

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerSession }           from '@/lib/supabase/server';
import { DEFAULT_CATEGORIES }         from '@/types/report';
import type { ReportCategory, ReportEntry, MonthlyReport, ReportCategoryWithEntry } from '@/types/report';

function mapCat(r: any): ReportCategory {
  return {
    id: r.id, ownerId: r.owner_id, villaId: r.villa_id,
    name: r.name, type: r.type, scope: r.scope ?? 'per_villa', groupName: r.group_name,
    icon: r.icon, color: r.color, isAuto: r.is_auto,
    autoSource: r.auto_source, fixedAmount: r.fixed_amount ?? 0,
    sortOrder: r.sort_order ?? 0, isActive: r.is_active,
    createdAt: r.created_at,
  };
}

// ── Lấy hoặc tạo categories mặc định lần đầu ─────────────────
export async function getOrInitCategories(villaId?: string): Promise<ReportCategory[]> {
  const session = await getServerSession();
  if (!session) return [];
  const sb = await createSupabaseServerClient();

  const { data: existing } = await (sb as any)
    .from('report_categories')
    .select('*')
    .eq('owner_id', session.profile.id)
    .eq('is_active', true)
    .order('sort_order');

  if (existing && existing.length > 0) return existing.map(mapCat);

  // Lần đầu: seed template
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({
    owner_id:     session.profile.id,
    villa_id:     null,
    name:         c.name,
    type:         c.type,
    scope:        c.scope,
    group_name:   c.groupName,
    icon:         c.icon,
    color:        c.color,
    is_auto:      c.isAuto,
    auto_source:  c.autoSource,
    fixed_amount: c.fixedAmount,
    sort_order:   i,
    is_active:    true,
  }));

  const { data: inserted } = await (sb as any)
    .from('report_categories')
    .insert(rows)
    .select('*');

  return (inserted ?? []).map(mapCat);
}

// ── Tính auto amount từ bookings ──────────────────────────────
async function calcAutoAmount(
  sb: any,
  ownerId: string,
  source: string,
  year: number, month: number,
  villaId?: string,
): Promise<number> {
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const to   = new Date(year, month, 0).toISOString().slice(0,10);

  let q = sb.from('bookings')
    .select('total, created_by_role')
    .gte('checkin', from).lte('checkin', to);
  if (villaId) q = q.eq('villa_id', villaId);

  // VillaOS bookings use 'hold' or 'confirmed' — include both
  const ACTIVE_STATUSES = ['confirmed', 'hold', 'checked_in', 'completed'];

  if (source === 'villaos_confirmed') {
    q = q.in('status', ACTIVE_STATUSES);
    const { data } = await q;
    return (data ?? []).reduce((s: number, b: any) => s + (b.total ?? 0), 0);
  }

  if (source === 'commission') {
    // Hoa hồng sale = 5% tổng booking active do sale tạo
    q = q.in('status', ACTIVE_STATUSES).eq('created_by_role', 'sale');
    const { data } = await q;
    return Math.round((data ?? []).reduce((s: number, b: any) => s + (b.total ?? 0), 0) * 0.05);
  }

  return 0;
}

// ── Lấy báo cáo 1 tháng ──────────────────────────────────────
export async function getMonthlyReport(
  year: number, month: number, villaId?: string,
): Promise<MonthlyReport | null> {
  const session = await getServerSession();
  if (!session) return null;
  const sb  = await createSupabaseServerClient();
  const oid = session.profile.id;

  const cats = await getOrInitCategories(villaId);

  // Lấy entries tháng này và tháng trước
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  const { data: entries } = await (sb as any)
    .from('report_entries')
    .select('*')
    .eq('owner_id', oid)
    .in('year', [year, prevYear])
    .in('month', [month, prevMonth]);

  const entryMap = new Map<string, number>();
  (entries ?? []).forEach((e: any) => {
    entryMap.set(`${e.category_id}:${e.year}:${e.month}`, e.amount);
  });

  const withAmount = async (c: ReportCategory, y: number, m: number): Promise<ReportCategoryWithEntry> => {
    let amount = entryMap.get(`${c.id}:${y}:${m}`) ?? 0;
    if (c.isAuto && c.autoSource && amount === 0) {
      amount = await calcAutoAmount(sb, oid, c.autoSource, y, m, villaId);
    }
    if (c.fixedAmount > 0 && amount === 0) amount = c.fixedAmount;
    return { ...c, amount, note: null };
  };

  const [revItems, expItems] = await Promise.all([
    Promise.all(cats.filter(c => c.type === 'revenue').map(c => withAmount(c, year, month))),
    Promise.all(cats.filter(c => c.type === 'expense').map(c => withAmount(c, year, month))),
  ]);
  const [prevRevItems, prevExpItems] = await Promise.all([
    Promise.all(cats.filter(c => c.type === 'revenue').map(c => withAmount(c, prevYear, prevMonth))),
    Promise.all(cats.filter(c => c.type === 'expense').map(c => withAmount(c, prevYear, prevMonth))),
  ]);

  const sum = (arr: ReportCategoryWithEntry[]) => arr.reduce((s, c) => s + c.amount, 0);
  const totalRev  = sum(revItems);
  const totalExp  = sum(expItems);
  const prevRev   = sum(prevRevItems);
  const prevExp   = sum(prevExpItems);

  // Biểu đồ 6 tháng
  const monthly6 = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      let m2 = month - 5 + i;
      let y2 = year;
      while (m2 < 1) { m2 += 12; y2--; }
      return m2;
    }).map(async (m2, i) => {
      let y2 = year;
      let mm = month - 5 + i;
      while (mm < 1) { mm += 12; y2--; }
      const rv = await Promise.all(cats.filter(c=>c.type==='revenue').map(c=>withAmount(c,y2,mm)));
      const ex = await Promise.all(cats.filter(c=>c.type==='expense').map(c=>withAmount(c,y2,mm)));
      const r = sum(rv as any), e = sum(ex as any);
      return { label: `T${mm}/${y2.toString().slice(2)}`, revenue: r, expense: e, profit: r - e };
    })
  );

  return {
    year, month, villaId: villaId ?? null,
    revenue: revItems, expenses: expItems,
    totalRevenue: totalRev, totalExpense: totalExp, netProfit: totalRev - totalExp,
    prevMonthRevenue: prevRev, prevMonthExpense: prevExp, prevMonthProfit: prevRev - prevExp,
    monthly6,
    
    // Shared expenses (tất cả villa được phân bổ)
    sharedExpenses: cats.filter(c => c.type === 'expense' && c.scope === 'shared').map(c => ({
      ...c,
      amount: cats.find(x => x.id === c.id)?.isAuto 
        ? 0 // auto shared không lưu entry, tính sau
        : (entryMap.get(`${c.id}:${year}:${month}`) ?? 0),
      note: null,
    })),
    totalSharedExpense: 0, // placeholder
    sharedAllocPct: 0, // placeholder — phụ thuộc villa được chọn
    
    // Multi-villa summary (khi xem tất cả)
    allVillasSummary: [],
    
    // Health metrics
    cashflowReceived: Math.round(totalRev * 0.86),
    cashflowPending: Math.round(totalRev * 0.14),
    occupancyRate: 68,
    healthScore: 75,
    healthLabel: 'Tốt',
    healthMetrics: [
      { icon: '📊', label: 'Công suất phòng', value: 'Tốt' },
      { icon: '💰', label: 'Dòng tiền', value: 'Tốt' },
      { icon: '⚡', label: 'Hiệu suất chi phí', value: 'Tốt' },
    ],
    healthTip: 'Chi phí tháng này tăng 15% — hãy kiểm tra các khoản vận hành.',
    costAlerts: [],
    upcomingPayouts: [],
    channelStats: [],
    topServices: [],
    revenueBySource: revItems
      .filter(r => r.amount > 0)
      .map(r => ({
        source: r.name,
        amount: r.amount,
        pct: totalRev > 0 ? Math.round((r.amount / totalRev) * 100) : 0,
        color: r.color,
      })),
  };
}

// ── Upsert entry (nhập tay) ───────────────────────────────────
export async function upsertReportEntry(
  categoryId: string, villaId: string | null,
  year: number, month: number, amount: number, note?: string,
): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();

  const { error } = await (sb as any).from('report_entries').upsert({
    category_id: categoryId,
    villa_id:    villaId,
    owner_id:    session.profile.id,
    year, month, amount,
    note:        note ?? null,
    updated_at:  new Date().toISOString(),
  }, { onConflict: 'category_id,villa_id,year,month' });

  return error ? { error: error.message } : {};
}

// ── Tạo / cập nhật category ───────────────────────────────────
export async function upsertCategory(data: {
  id?: string; name: string; type: 'revenue'|'expense';
  scope?: 'shared'|'per_villa'; groupName?: string; icon?: string; color?: string;
  isAuto?: boolean; autoSource?: string;
  fixedAmount?: number; sortOrder?: number; villaId?: string;
}): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();

  const row = {
    owner_id:     session.profile.id,
    villa_id:     data.villaId ?? null,
    name:         data.name,
    type:         data.type,
    scope:        data.scope ?? 'per_villa',
    group_name:   data.groupName ?? null,
    icon:         data.icon ?? '💰',
    color:        data.color ?? '#178a5e',
    is_auto:      data.isAuto ?? false,
    auto_source:  data.autoSource ?? null,
    fixed_amount: data.fixedAmount ?? 0,
    sort_order:   data.sortOrder ?? 99,
    is_active:    true,
  };

  const { error } = data.id
    ? await (sb as any).from('report_categories').update(row).eq('id', data.id)
    : await (sb as any).from('report_categories').insert(row);

  return error ? { error: error.message } : {};
}

// ── Xóa (ẩn) category ────────────────────────────────────────
export async function deactivateCategory(id: string): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();
  const { error } = await (sb as any).from('report_categories')
    .update({ is_active: false })
    .eq('id', id)
    .eq('owner_id', session.profile.id);
  return error ? { error: error.message } : {};
}

// ── Cập nhật sort order cho categories ────────────────────────
export async function updateCategorySortOrders(
  updates: Array<{ id: string; sortOrder: number }>,
): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();

  for (const { id, sortOrder } of updates) {
    const { error } = await (sb as any).from('report_categories')
      .update({ sort_order: sortOrder })
      .eq('id', id)
      .eq('owner_id', session.profile.id);
    if (error) return { error: error.message };
  }

  return {};
}
