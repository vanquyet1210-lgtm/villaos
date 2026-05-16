'use server';
// VillaOS v7 — lib/services/report.service.ts

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerSession }           from '@/lib/supabase/server';
import { DEFAULT_CATEGORIES }         from '@/types/report';
import type { ReportCategory, MonthlyReport, ReportCategoryWithEntry } from '@/types/report';

function mapCat(r: any): ReportCategory {
  // Suy ra scope khi DB chưa có cột scope:
  // Ưu tiên giá trị DB nếu có ('shared' | 'per_villa')
  // Fallback: dùng groupName để phân biệt → "Nhân sự" → shared
  const scope: 'shared' | 'per_villa' =
    r.scope === 'shared'    ? 'shared'    :
    r.scope === 'per_villa' ? 'per_villa' :
    (r.type === 'expense' && (r.group_name === 'Nhân sự' || r.is_auto === true))
      ? 'shared'
      : 'per_villa';

  return {
    id: r.id, ownerId: r.owner_id, villaId: r.villa_id,
    name: r.name, type: r.type, scope, groupName: r.group_name,
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

  if (existing && existing.length > 0) {
    // One-time migration: ghi scope='shared' vào DB cho các rows đang null
    const needsFix = existing.filter(
      (c: any) => !c.scope && c.type === 'expense' && c.villa_id === null
    );
    if (needsFix.length > 0) {
      await (sb as any)
        .from('report_categories')
        .update({ scope: 'shared' })
        .in('id', needsFix.map((c: any) => c.id))
        .eq('owner_id', session.profile.id);
      needsFix.forEach((c: any) => { c.scope = 'shared'; });
    }
    return existing.map(mapCat);
  }

  // Lần đầu: seed template
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({
    owner_id:     session.profile.id,
    villa_id:     null,
    name:         c.name,
    type:         c.type,
    group_name:   c.groupName,
    icon:         c.icon,
    color:        c.color,
    is_auto:      c.isAuto,
    auto_source:  c.autoSource,
    fixed_amount: c.fixedAmount,
    sort_order:   i,
    is_active:    true,
    ...(c.scope ? { scope: c.scope } : {}),
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

  const ACTIVE_STATUSES = ['confirmed', 'hold', 'checked_in', 'completed'];

  if (source === 'villaos_confirmed') {
    q = q.in('status', ACTIVE_STATUSES);
    const { data } = await q;
    return (data ?? []).reduce((s: number, b: any) => s + (b.total ?? 0), 0);
  }

  if (source === 'commission') {
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

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  // ── BUG 4 FIX: mở rộng query entries để phủ đủ 6 tháng cho chart ─────────
  // Trước: .in('year', [year, prevYear]).in('month', [month, prevMonth])
  //        → chỉ lấy 2 tháng → chart monthly6 toàn bộ tháng cũ = 0đ
  // Sau: tính range 6 tháng + prevMonth, dùng query rộng hơn
  //
  // Tính tháng đầu tiên của window 6 tháng (chart6Start)
  let c6M = month - 5, c6Y = year;
  while (c6M < 1) { c6M += 12; c6Y--; }

  // Tập hợp tất cả year và month cần thiết
  const neededPairs: Array<{ y: number; m: number }> = [];
  for (let i = 0; i < 6; i++) {
    let mm = month - 5 + i, yy = year;
    while (mm < 1) { mm += 12; yy--; }
    neededPairs.push({ y: yy, m: mm });
  }
  // Thêm prevMonth nếu chưa có
  if (!neededPairs.some(p => p.y === prevYear && p.m === prevMonth)) {
    neededPairs.push({ y: prevYear, m: prevMonth });
  }

  const neededYears  = [...new Set(neededPairs.map(p => p.y))];
  const neededMonths = [...new Set(neededPairs.map(p => p.m))];
  // Lưu ý: Supabase .in('year').in('month') là AND riêng biệt → có thể over-fetch một chút
  // (vd: T3/prevYear khi chỉ cần T3/year) nhưng KHÔNG bao giờ thiếu dữ liệu cần thiết.

  const { data: entries } = await (sb as any)
    .from('report_entries')
    .select('*')
    .eq('owner_id', oid)
    .in('year',  neededYears)
    .in('month', neededMonths);

  const entryMap = new Map<string, number>();
  (entries ?? []).forEach((e: any) => {
    entryMap.set(`${e.category_id}:${e.year}:${e.month}:${e.villa_id ?? '__null__'}`, e.amount);
  });

  const getEntry = (catId: string, y: number, m: number, vid: string | null) =>
    entryMap.get(`${catId}:${y}:${m}:${vid ?? '__null__'}`) ?? 0;

  const withAmount = async (c: ReportCategory, y: number, m: number): Promise<ReportCategoryWithEntry> => {
    const primaryVid = c.scope === 'shared' ? null : (villaId ?? null);
    let amount = getEntry(c.id, y, m, primaryVid);

    // Fallback A: shared cat lưu nhầm với villa_id (EntryForm cũ không set isShared)
    if (amount === 0 && c.scope === 'shared' && villaId) {
      amount = getEntry(c.id, y, m, villaId);
    }
    // Fallback B: per_villa cat lưu nhầm với villa_id=null (edge case cũ)
    if (amount === 0 && c.scope !== 'shared' && villaId) {
      amount = getEntry(c.id, y, m, null);
    }

    if (c.isAuto && c.autoSource && amount === 0) {
      amount = await calcAutoAmount(sb, oid, c.autoSource, y, m, villaId);
    }
    if (c.fixedAmount > 0 && amount === 0) amount = c.fixedAmount;
    return { ...c, amount, note: null };
  };

  // ── Phân loại categories ──────────────────────────────────────
  const sharedCats   = cats.filter(c => c.type === 'expense' && c.scope === 'shared');
  const perVillaCats = cats.filter(c => c.type === 'expense' && c.scope !== 'shared');

  // ── Tháng hiện tại ────────────────────────────────────────────
  const [revItems, perVillaExpItems, sharedExpItems] = await Promise.all([
    Promise.all(cats.filter(c => c.type === 'revenue').map(c => withAmount(c, year, month))),
    Promise.all(perVillaCats.map(c => withAmount(c, year, month))),
    Promise.all(sharedCats.map(c => withAmount(c, year, month))),
  ]);

  const sum = (arr: ReportCategoryWithEntry[]) => arr.reduce((s, c) => s + c.amount, 0);

  const totalRev         = sum(revItems);
  const totalPerVillaExp = sum(perVillaExpItems);
  const totalSharedFull  = sum(sharedExpItems);

  // ── Tháng trước (Bug 2 fix: dùng same split logic, không cộng full shared) ──
  const [prevRevItems, prevPerVillaItems, prevSharedItems] = await Promise.all([
    Promise.all(cats.filter(c => c.type === 'revenue').map(c => withAmount(c, prevYear, prevMonth))),
    Promise.all(perVillaCats.map(c => withAmount(c, prevYear, prevMonth))),
    Promise.all(sharedCats.map(c => withAmount(c, prevYear, prevMonth))),
  ]);

  const prevRev         = sum(prevRevItems);
  const prevSharedFull  = sum(prevSharedItems);
  const prevPerVillaExp = sum(prevPerVillaItems);

  // ── Query villas để tính allocation ratio ─────────────────────
  const { data: villasData } = await (sb as any)
    .from('villas')
    .select('id, name, emoji')
    .eq('owner_id', oid)
    .eq('is_active', true);

  const nVillas         = (villasData ?? []).length || 1;
  const defaultAllocPct = Math.round(100 / nVillas);

  // ── Tính sharedAllocPct từ tỷ lệ doanh thu thực tế ───────────
  let sharedAllocPct       = 0;
  let totalAllocatedShared = 0;
  let prevAllocatedShared  = 0;

  if (villaId && villasData && villasData.length > 0) {
    const from2  = `${year}-${String(month).padStart(2,'0')}-01`;
    const to2    = new Date(year, month, 0).toISOString().slice(0,10);
    const ACTIVE = ['confirmed', 'hold', 'checked_in', 'completed'];

    const villaRevs = await Promise.all(
      (villasData as any[]).map(async (v: any) => {
        const { data: bks } = await (sb as any)
          .from('bookings').select('total')
          .eq('villa_id', v.id).in('status', ACTIVE)
          .gte('checkin', from2).lte('checkin', to2);
        return { id: v.id, rev: (bks ?? []).reduce((s: number, b: any) => s + (b.total ?? 0), 0) };
      })
    );

    const grandTotal   = villaRevs.reduce((s, v) => s + v.rev, 0);
    const thisVillaRev = villaRevs.find(v => v.id === villaId)?.rev ?? 0;

    // Fallback: nếu villa này chưa có booking tháng này → dùng số nhập tay
    const effectiveThisRev    = thisVillaRev > 0 ? thisVillaRev : totalRev;
    const effectiveGrandTotal = grandTotal > 0
      ? grandTotal - thisVillaRev + effectiveThisRev
      : effectiveThisRev;

    sharedAllocPct = nVillas === 1
      ? 100
      : (effectiveGrandTotal > 0
          ? Math.round((effectiveThisRev / effectiveGrandTotal) * 100)
          : defaultAllocPct);

    totalAllocatedShared = Math.round(totalSharedFull * sharedAllocPct / 100);
    prevAllocatedShared  = Math.round(prevSharedFull  * sharedAllocPct / 100);

  } else if (villaId) {
    // villaId có nhưng villasData rỗng → fallback equal split
    sharedAllocPct       = defaultAllocPct;
    totalAllocatedShared = Math.round(totalSharedFull  / nVillas);
    prevAllocatedShared  = Math.round(prevSharedFull   / nVillas);

  } else {
    // "Tất cả villa" → 100%
    sharedAllocPct       = 100;
    totalAllocatedShared = totalSharedFull;
    prevAllocatedShared  = prevSharedFull;
  }

  const totalExp  = totalPerVillaExp + totalAllocatedShared;
  const netProfit = totalRev - totalExp;
  const prevExp   = prevPerVillaExp + prevAllocatedShared;  // Bug 2 fix
  const prevProfit = prevRev - prevExp;

  // ── allVillasSummary ──────────────────────────────────────────
  const allVillasSummary = (villasData ?? []).map((v: any) => ({
    villaId:         v.id,
    villaName:       v.name,
    emoji:           v.emoji ?? '🏠',
    allocPct:        defaultAllocPct,
    revenue:         0,
    perVillaExpense: 0,
    sharedAlloc:     0,
    totalExpense:    0,
    netProfit:       0,
    occupancyRate:   0,
  }));

  // ── monthly6: Bug 3 fix (dùng sharedAllocPct) + Bug 4 fix (entryMap đủ dữ liệu) ──
  const monthly6 = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      let mm = month - 5 + i, y2 = year;
      while (mm < 1) { mm += 12; y2--; }
      return { mm, y2 };
    }).map(async ({ mm, y2 }) => {
      const rv      = await Promise.all(cats.filter(c => c.type === 'revenue').map(c => withAmount(c, y2, mm)));
      const perV    = await Promise.all(perVillaCats.map(c => withAmount(c, y2, mm)));
      const sharedM = await Promise.all(sharedCats.map(c => withAmount(c, y2, mm)));

      const r          = sum(rv as any);
      const perVExp    = sum(perV as any);
      const sharedFull = sum(sharedM as any);

      // Dùng sharedAllocPct của tháng hiện tại làm proxy cho các tháng trong chart
      const allocExp = villaId ? Math.round(sharedFull * sharedAllocPct / 100) : sharedFull;
      const e = perVExp + allocExp;
      return { label: `T${mm}/${y2.toString().slice(2)}`, revenue: r, expense: e, profit: r - e };
    })
  );

  return {
    year, month, villaId: villaId ?? null,
    revenue:  revItems,
    expenses: perVillaExpItems,
    totalRevenue:      totalRev,
    totalExpense:      totalExp,
    netProfit,
    prevMonthRevenue:  prevRev,
    prevMonthExpense:  prevExp,
    prevMonthProfit:   prevProfit,
    monthly6,

    sharedExpenses:     sharedExpItems,
    totalSharedExpense: totalSharedFull,
    sharedAllocPct,

    allVillasSummary,

    cashflowReceived: Math.round(totalRev * 0.86),
    cashflowPending:  Math.round(totalRev * 0.14),
    occupancyRate: 68,
    healthScore: 75,
    healthLabel: 'Tốt',
    healthMetrics: [
      { icon: '📊', label: 'Công suất phòng',  value: 'Tốt' as const },
      { icon: '💰', label: 'Dòng tiền',         value: 'Tốt' as const },
      { icon: '⚡', label: 'Hiệu suất chi phí', value: 'Tốt' as const },
    ],
    healthTip:      'Chi phí tháng này tăng 15% — hãy kiểm tra các khoản vận hành.',
    costAlerts:     [],
    upcomingPayouts:[],
    channelStats:   [],
    topServices:    [],
    revenueBySource: revItems
      .filter(r => r.amount > 0)
      .map(r => ({
        source: r.name,
        amount: r.amount,
        pct:    totalRev > 0 ? Math.round((r.amount / totalRev) * 100) : 0,
        color:  r.color,
      })),
  };
}

// ── Upsert entry (nhập tay) ───────────────────────────────────
export async function upsertReportEntry(
  categoryId: string, villaId: string | null,
  year: number, month: number, amount: number, note?: string,
  alloc?: { villaId?: string; allocPct?: number },
): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb  = await createSupabaseServerClient();
  const oid = session.profile.id;

  // Auto-detect scope: shared categories phải luôn lưu với villa_id=null
  const { data: catMeta } = await (sb as any)
    .from('report_categories')
    .select('scope')
    .eq('id', categoryId)
    .single();

  const isSharedCat    = catMeta?.scope === 'shared';
  const correctVillaId = isSharedCat ? null : villaId;

  // 1. Lưu entry chính
  const { error } = await (sb as any).from('report_entries').upsert({
    category_id: categoryId,
    villa_id:    correctVillaId,
    owner_id:    oid,
    year, month, amount,
    note:        note ?? null,
    updated_at:  new Date().toISOString(),
  }, { onConflict: 'category_id,villa_id,year,month' });

  if (error) return { error: error.message };

  // 1b. Xoá entry cũ lưu sai villa_id (migration safety)
  if (isSharedCat && villaId && villaId !== correctVillaId) {
    await (sb as any).from('report_entries').delete()
      .eq('category_id', categoryId)
      .eq('villa_id',    villaId)
      .eq('owner_id',    oid)
      .eq('year',  year)
      .eq('month', month);
  }

  // 2. Nếu là shared + có alloc → lưu record phân bổ cho villa đó
  if (alloc?.villaId && alloc.allocPct !== undefined) {
    const allocAmount = Math.round(amount * alloc.allocPct / 100);
    const { error: e2 } = await (sb as any).from('report_entries').upsert({
      category_id: categoryId,
      villa_id:    alloc.villaId,
      owner_id:    oid,
      year, month,
      amount:      allocAmount,
      note:        `alloc:${alloc.allocPct}%`,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'category_id,villa_id,year,month' });
    if (e2) return { error: e2.message };
  }

  return {};
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

  const row: any = {
    owner_id:     session.profile.id,
    villa_id:     data.villaId ?? null,
    name:         data.name,
    type:         data.type,
    group_name:   data.groupName ?? null,
    icon:         data.icon ?? '💰',
    color:        data.color ?? '#178a5e',
    is_auto:      data.isAuto ?? false,
    auto_source:  data.autoSource ?? null,
    fixed_amount: data.fixedAmount ?? 0,
    sort_order:   data.sortOrder ?? 99,
    is_active:    true,
  };
  if (data.scope) row.scope = data.scope;

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
