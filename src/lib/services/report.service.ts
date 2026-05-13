'use server';
// VillaOS v7 — lib/services/report.service.ts

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerSession }           from '@/lib/supabase/server';
import { DEFAULT_CATEGORIES }         from '@/types/report';
import type {
  ReportCategory, ReportEntry, MonthlyReport,
  ReportCategoryWithEntry, CostAlert, ChannelStat,
  HealthLevel, HealthMetric, VillaSummary, CostScope,
} from '@/types/report';

// ── Mappers ──────────────────────────────────────────────────

function mapCat(r: any): ReportCategory {
  return {
    id:          r.id,
    ownerId:     r.owner_id,
    villaId:     r.villa_id,
    name:        r.name,
    type:        r.type,
    scope:       (r.scope ?? 'per_villa') as CostScope,
    groupName:   r.group_name,
    icon:        r.icon,
    color:       r.color,
    isAuto:      r.is_auto,
    autoSource:  r.auto_source,
    fixedAmount: r.fixed_amount ?? 0,
    sortOrder:   r.sort_order ?? 0,
    isActive:    r.is_active,
    createdAt:   r.created_at,
  };
}

// ── Categories ───────────────────────────────────────────────

export async function getOrInitCategories(): Promise<ReportCategory[]> {
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

  // First-time seed
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

export async function upsertCategory(data: {
  id?: string; name: string; type: 'revenue' | 'expense';
  scope?: CostScope;
  groupName?: string; icon?: string; color?: string;
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

export async function deactivateCategory(id: string): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();
  const { error } = await (sb as any)
    .from('report_categories')
    .update({ is_active: false })
    .eq('id', id)
    .eq('owner_id', session.profile.id);
  return error ? { error: error.message } : {};
}

export async function updateCategorySortOrders(
  orders: { id: string; sortOrder: number }[],
): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();

  const updates = orders.map(o =>
    (sb as any)
      .from('report_categories')
      .update({ sort_order: o.sortOrder })
      .eq('id', o.id)
      .eq('owner_id', session.profile.id),
  );

  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);
  return failed?.error ? { error: failed.error.message } : {};
}

// ── Booking helpers ──────────────────────────────────────────

interface BookingRow {
  id:               string;
  total:            number;
  status:           string;
  created_by_role:  string;
  checkin:          string;
  checkout:         string;
  source:           string | null;
  villa_id:         string | null;
  payment_status:   string | null;
}

async function fetchBookingsForRange(
  sb: any,
  villaId: string | undefined,
  fromDate: string,
  toDate: string,
): Promise<BookingRow[]> {
  let q = (sb as any)
    .from('bookings')
    .select('id, total, status, created_by_role, checkin, checkout, source, villa_id, payment_status')
    .gte('checkout', fromDate)
    .lte('checkin', toDate);
  if (villaId) q = q.eq('villa_id', villaId);
  const { data } = await q;
  return data ?? [];
}

function calcAutoFromBatch(
  bookings: BookingRow[],
  source: string,
  year: number,
  month: number,
): number {
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0);
  const mb   = bookings.filter(b => {
    const c = new Date(b.checkin);
    return c >= from && c <= to;
  });
  if (source === 'villaos_confirmed') {
    return mb.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.total ?? 0), 0);
  }
  if (source === 'commission') {
    const base = mb
      .filter(b => b.status === 'confirmed' && b.created_by_role === 'sale')
      .reduce((s, b) => s + (b.total ?? 0), 0);
    return Math.round(base * 0.05);
  }
  return 0;
}

// ── Derived metric helpers ───────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  'Agoda':       '#3266ad',
  'Booking.com': '#d65a1e',
  'Trực tiếp':   '#178a5e',
  'VillaOS':     '#178a5e',
  'Airbnb':      '#FF5A5F',
};

function computeChannelStats(
  bookings: BookingRow[],
  year: number,
  month: number,
  totalRevenue: number,
): ChannelStat[] {
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0);
  const mb   = bookings.filter(b => {
    const c = new Date(b.checkin);
    return c >= from && c <= to && b.status === 'confirmed';
  });
  const map = new Map<string, { revenue: number; nights: number }>();
  for (const b of mb) {
    const src    = b.source ?? 'Trực tiếp';
    const nights = Math.max(1, Math.round(
      (new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / 86_400_000,
    ));
    const cur = map.get(src) ?? { revenue: 0, nights: 0 };
    map.set(src, { revenue: cur.revenue + (b.total ?? 0), nights: cur.nights + nights });
  }
  return Array.from(map.entries()).map(([source, { revenue, nights }]) => ({
    source,
    revenue,
    pct:       totalRevenue > 0 ? Math.round(revenue / totalRevenue * 100) : 0,
    adr:       nights > 0 ? Math.round(revenue / nights) : 0,
    occupancy: 0,
    color:     CHANNEL_COLORS[source] ?? '#8A8F9A',
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
}

function computeCostAlerts(
  current: ReportCategoryWithEntry[],
  prev:    ReportCategoryWithEntry[],
): CostAlert[] {
  const prevMap = new Map(prev.map(p => [p.id, p.amount]));
  return current
    .filter(c => c.type === 'expense' && c.amount > 0)
    .map(c => {
      const prevAmt = prevMap.get(c.id) ?? 0;
      const pct     = prevAmt > 0 ? Math.round((c.amount - prevAmt) / prevAmt * 100) : 0;
      return { ...c, prevAmount: prevAmt, pctChange: pct, reason: `Tăng ${pct}% so với tháng trước` };
    })
    .filter(c => c.pctChange >= 20)
    .sort((a, b) => b.pctChange - a.pctChange)
    .slice(0, 3);
}

function computeHealthScore(
  occupancyRate: number,
  profitMarginPct: number,
  expenseRatioPct: number,
): { score: number; label: HealthLevel; tip: string; metrics: HealthMetric[] } {
  const oScore = Math.min(100, occupancyRate * 1.25);
  const pScore = Math.min(100, profitMarginPct * 2);
  const eScore = Math.max(0, 100 - expenseRatioPct);
  const score  = Math.round(oScore * 0.4 + pScore * 0.4 + eScore * 0.2);
  const level  = (v: number, hi: number, mid: number): HealthLevel =>
    v >= hi ? 'Xuất sắc' : v >= mid ? 'Tốt' : v >= mid * 0.6 ? 'Trung bình' : 'Kém';
  const metrics: HealthMetric[] = [
    { icon:'📅', label:'Công suất phòng',     value: level(occupancyRate,      80, 60) },
    { icon:'📊', label:'Tỷ lệ phụ thuộc OTA', value: level(100 - expenseRatioPct, 80, 50) },
    { icon:'🔧', label:'Chi phí vận hành',    value: level(100 - expenseRatioPct, 80, 60) },
    { icon:'💹', label:'Lợi nhuận',           value: level(profitMarginPct,    50, 30) },
  ];
  const label: HealthLevel =
    score >= 85 ? 'Xuất sắc' : score >= 65 ? 'Tốt' : score >= 45 ? 'Trung bình' : 'Kém';
  const tips: Record<HealthLevel, string> = {
    'Xuất sắc':  'Tuyệt vời! Duy trì đà tăng trưởng và tối ưu hoá giá phòng vào cuối tuần.',
    'Tốt':       'Bạn có thể tăng doanh thu bằng cách tăng giá phòng vào cuối tuần.',
    'Trung bình':'Xem xét giảm chi phí vận hành hoặc mở rộng kênh bán trực tiếp.',
    'Kém':       'Cần rà soát lại cơ cấu chi phí và chiến lược giá ngay.',
  };
  return { score, label, tip: tips[label], metrics };
}

function computeOccupancy(bookings: BookingRow[], year: number, month: number): number {
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0);
  const days = to.getDate();
  const nights = bookings
    .filter(b => {
      const c = new Date(b.checkin);
      return c >= from && c <= to && b.status === 'confirmed';
    })
    .reduce((s, b) => {
      return s + Math.max(1, Math.round(
        (new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / 86_400_000,
      ));
    }, 0);
  return Math.min(100, Math.round(nights / days * 100));
}

// ── Main report function ─────────────────────────────────────

export async function getMonthlyReport(
  year: number,
  month: number,
  villaId?: string,
): Promise<MonthlyReport | null> {
  const session = await getServerSession();
  if (!session) return null;
  const sb  = await createSupabaseServerClient();
  const oid = session.profile.id;

  const cats = await getOrInitCategories();

  // Month window helpers
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  let win6Month = month - 5; let win6Year = year;
  while (win6Month < 1) { win6Month += 12; win6Year--; }
  const win6From = `${win6Year}-${String(win6Month).padStart(2,'0')}-01`;
  const win6To   = new Date(year, month, 0).toISOString().slice(0, 10);

  // Fetch all bookings (for this villa or all if no villaId)
  const allBookings = await fetchBookingsForRange(sb, villaId, win6From, win6To);

  // Fetch ALL entries (no villa filter — needed for shared cost allocation)
  const { data: allEntries } = await (sb as any)
    .from('report_entries')
    .select('*')
    .eq('owner_id', oid)
    .gte('year', win6Year)
    .lte('year', year);

  // entryMap key: categoryId:villaId:year:month
  // villaId 'null' = shared entry
  const entryMap = new Map<string, number>();
  const entryNoteMap = new Map<string, string | null>();
  (allEntries ?? []).forEach((e: any) => {
    const key = `${e.category_id}:${e.villa_id ?? 'null'}:${e.year}:${e.month}`;
    entryMap.set(key, e.amount);
    entryNoteMap.set(key, e.note ?? null);
  });

  // Split categories by scope
  const sharedCats   = cats.filter(c => c.scope === 'shared'    && c.type === 'expense');
  const perVillaCats = cats.filter(c => c.scope !== 'shared'    || c.type === 'revenue');
  const revCats      = cats.filter(c => c.type === 'revenue');
  const pvExpCats    = cats.filter(c => c.type === 'expense' && c.scope !== 'shared');

  // withAmount helpers
  const withAmountForVilla = (
    c: ReportCategory,
    y: number,
    m: number,
    vid: string | null,
  ): ReportCategoryWithEntry => {
    const key    = `${c.id}:${vid ?? 'null'}:${y}:${m}`;
    let amount   = entryMap.get(key) ?? 0;
    const note   = entryNoteMap.get(key) ?? null;
    if (c.isAuto && c.autoSource && amount === 0) {
      amount = calcAutoFromBatch(allBookings, c.autoSource, y, m);
    }
    if (c.fixedAmount > 0 && amount === 0) amount = c.fixedAmount;
    return { ...c, amount, note };
  };

  // Shared amount: always stored with villa_id=null
  const withSharedAmount = (c: ReportCategory, y: number, m: number): ReportCategoryWithEntry => {
    const key  = `${c.id}:null:${y}:${m}`;
    let amount = entryMap.get(key) ?? 0;
    const note = entryNoteMap.get(key) ?? null;
    if (c.isAuto && c.autoSource && amount === 0) {
      amount = calcAutoFromBatch(allBookings, c.autoSource, y, m);
    }
    if (c.fixedAmount > 0 && amount === 0) amount = c.fixedAmount;
    return { ...c, amount, note };
  };

  const sum = (arr: ReportCategoryWithEntry[]) => arr.reduce((s, c) => s + c.amount, 0);

  // ── Hướng 1: Allocation ratio ────────────────────────────────
  // When viewing a specific villa, compute its % of total revenue
  // to allocate shared costs proportionally.

  let sharedAllocPct = 100; // default: 100% if viewing all or single villa

  if (villaId) {
    // Get all other villa IDs from entries this month
    const villaIds = new Set<string>();
    (allEntries ?? []).forEach((e: any) => {
      if (e.villa_id && e.year === year && e.month === month) villaIds.add(e.villa_id);
    });
    villaIds.add(villaId);

    if (villaIds.size > 1) {
      // Sum revenue for each villa
      const totalAllVillasRev = Array.from(villaIds).reduce((total, vid) => {
        const r = revCats.map(c => withAmountForVilla(c, year, month, vid));
        return total + sum(r);
      }, 0);
      const thisVillaRev = sum(revCats.map(c => withAmountForVilla(c, year, month, villaId)));
      sharedAllocPct = totalAllVillasRev > 0
        ? Math.round(thisVillaRev / totalAllVillasRev * 100)
        : Math.round(100 / villaIds.size); // equal split if no revenue
    }
  }

  // Build current month items
  const revItems     = revCats.map(c => withAmountForVilla(c, year, month, villaId ?? null));
  const pvExpItems   = pvExpCats.map(c => withAmountForVilla(c, year, month, villaId ?? null));
  const sharedItems  = sharedCats.map(c => withSharedAmount(c, year, month));

  // Allocated shared items (amount scaled by allocPct)
  const sharedAllocated = sharedItems.map(c => ({
    ...c,
    allocAmount: c.amount,
    amount: Math.round(c.amount * sharedAllocPct / 100),
  }));

  const totalRev         = sum(revItems);
  const totalPvExp       = sum(pvExpItems);
  const totalSharedFull  = sum(sharedItems);
  const totalSharedAlloc = sum(sharedAllocated);
  const totalExp         = totalPvExp + totalSharedAlloc;

  // Prev month
  const prevRevItems    = revCats.map(c => withAmountForVilla(c, prevYear, prevMonth, villaId ?? null));
  const prevPvExpItems  = pvExpCats.map(c => withAmountForVilla(c, prevYear, prevMonth, villaId ?? null));
  const prevSharedItems = sharedCats.map(c => withSharedAmount(c, prevYear, prevMonth));
  const prevSharedAlloc = prevSharedItems.map(c => ({
    ...c,
    amount: Math.round(c.amount * sharedAllocPct / 100),
  }));
  const prevRev = sum(prevRevItems);
  const prevExp = sum(prevPvExpItems) + sum(prevSharedAlloc);

  // 6-month chart
  const monthly6 = Array.from({ length: 6 }, (_, i) => {
    let m2 = month - 5 + i; let y2 = year;
    while (m2 < 1) { m2 += 12; y2--; }
    const rv  = sum(revCats.map(c => withAmountForVilla(c, y2, m2, villaId ?? null)));
    const pve = sum(pvExpCats.map(c => withAmountForVilla(c, y2, m2, villaId ?? null)));
    const she = sum(sharedCats.map(c => {
      const si = withSharedAmount(c, y2, m2);
      return { ...si, amount: Math.round(si.amount * sharedAllocPct / 100) };
    }));
    const ex = pve + she;
    return { label: `T${m2}/${y2.toString().slice(2)}`, revenue: rv, expense: ex, profit: rv - ex };
  });

  // ── Hướng 2: All-villas summary ──────────────────────────────
  let allVillasSummary: VillaSummary[] = [];

  if (!villaId) {
    // Get villa list
    const { data: villaRows } = await (sb as any)
      .from('villas')
      .select('id, name, emoji')
      .eq('owner_id', oid)
      .eq('is_active', true);

    const villas = (villaRows ?? []) as { id: string; name: string; emoji: string }[];

    if (villas.length > 1) {
      // Compute per-villa revenue for allocation
      const villaRevMap = new Map<string, number>();
      let grandRevTotal = 0;
      for (const v of villas) {
        const r = sum(revCats.map(c => withAmountForVilla(c, year, month, v.id)));
        villaRevMap.set(v.id, r);
        grandRevTotal += r;
      }

      // Villa bookings for occupancy
      const villaBookings = await fetchBookingsForRange(sb, undefined, win6From, win6To);

      allVillasSummary = villas.map(v => {
        const vRev     = villaRevMap.get(v.id) ?? 0;
        const allocPct = grandRevTotal > 0 ? Math.round(vRev / grandRevTotal * 100) : Math.round(100 / villas.length);
        const pvExp    = sum(pvExpCats.map(c => withAmountForVilla(c, year, month, v.id)));
        const shAlloc  = Math.round(totalSharedFull * allocPct / 100);
        const vBookings = villaBookings.filter(b => b.villa_id === v.id);
        const occ      = computeOccupancy(vBookings, year, month);
        return {
          villaId:         v.id,
          villaName:       v.name,
          emoji:           v.emoji ?? '🏡',
          revenue:         vRev,
          perVillaExpense: pvExp,
          sharedAlloc:     shAlloc,
          totalExpense:    pvExp + shAlloc,
          netProfit:       vRev - pvExp - shAlloc,
          occupancyRate:   occ,
          allocPct,
        };
      });
    }
  }

  // Priority 4 metrics
  const thisMonthFrom    = `${year}-${String(month).padStart(2,'0')}-01`;
  const thisMonthTo      = new Date(year, month, 0).toISOString().slice(0, 10);
  const thisMonthBookings = allBookings.filter(b => {
    const c = new Date(b.checkin);
    return c >= new Date(thisMonthFrom) && c <= new Date(thisMonthTo);
  });

  const cashflowReceived = thisMonthBookings
    .filter(b => b.payment_status === 'paid')
    .reduce((s, b) => s + (b.total ?? 0), 0);
  const cashflowPending = thisMonthBookings
    .filter(b => b.payment_status !== 'paid' && b.status === 'confirmed')
    .reduce((s, b) => s + (b.total ?? 0), 0);

  const occupancyRate    = computeOccupancy(allBookings, year, month);
  const profitMarginPct  = totalRev > 0 ? Math.round((totalRev - totalExp) / totalRev * 100) : 0;
  const expenseRatioPct  = totalRev > 0 ? Math.round(totalExp / totalRev * 100) : 100;
  const health           = computeHealthScore(occupancyRate, profitMarginPct, expenseRatioPct);

  // Cost alerts: compare both per-villa + allocated shared
  const allExpCurrent = [...pvExpItems, ...sharedAllocated];
  const allExpPrev    = [...prevPvExpItems, ...prevSharedAlloc];
  const costAlerts    = computeCostAlerts(allExpCurrent, allExpPrev);

  const channelStats    = computeChannelStats(allBookings, year, month, totalRev);
  const revenueBySource = channelStats.map(c => ({
    source: c.source, amount: c.revenue, pct: c.pct, color: c.color,
  }));

  const upcomingPayouts = allBookings
    .filter(b => b.status === 'confirmed' && b.payment_status !== 'paid' && new Date(b.checkin) > new Date())
    .slice(0, 5)
    .map(b => ({
      source: b.source ?? 'Trực tiếp',
      amount: b.total ?? 0,
      expectedDate: b.checkin,
      bookingRef: b.id,
    }));

  // expenses in the return: per_villa + allocated shared (combined for UI)
  const allExpensesForUI = [
    ...pvExpItems,
    ...sharedAllocated.map(c => ({
      ...c,
      name: `${c.name} (chung)`,
      amount: c.amount, // allocated amount
    })),
  ];

  return {
    year, month, villaId: villaId ?? null,
    revenue:          revItems,
    expenses:         allExpensesForUI,
    totalRevenue:     totalRev,
    totalExpense:     totalExp,
    netProfit:        totalRev - totalExp,
    prevMonthRevenue: prevRev,
    prevMonthExpense: prevExp,
    prevMonthProfit:  prevRev - prevExp,
    // Hướng 1
    sharedExpenses:     sharedItems,
    totalSharedExpense: totalSharedFull,
    sharedAllocPct,
    // Hướng 2
    allVillasSummary,
    // 6-month
    monthly6,
    // Priority 4
    cashflowReceived,
    cashflowPending,
    occupancyRate,
    healthScore:   health.score,
    healthLabel:   health.label,
    healthMetrics: health.metrics,
    healthTip:     health.tip,
    costAlerts,
    upcomingPayouts,
    channelStats,
    topServices:   [],
    revenueBySource,
  };
}

// ── Upsert entry ─────────────────────────────────────────────

export async function upsertReportEntry(
  categoryId: string,
  villaId:    string | null,
  year:       number,
  month:      number,
  amount:     number,
  note?:      string,
): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();

  const { error } = await (sb as any).from('report_entries').upsert(
    {
      category_id: categoryId,
      villa_id:    villaId,
      owner_id:    session.profile.id,
      year, month, amount,
      note:        note ?? null,
      updated_at:  new Date().toISOString(),
    },
    { onConflict: 'category_id,villa_id,year,month' },
  );

  return error ? { error: error.message } : {};
}
