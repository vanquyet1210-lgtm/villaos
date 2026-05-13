'use server';
// VillaOS v7 — lib/services/report.service.ts

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerSession }           from '@/lib/supabase/server';
import { DEFAULT_CATEGORIES }         from '@/types/report';
import type {
  ReportCategory, ReportEntry, MonthlyReport,
  ReportCategoryWithEntry, CostAlert, ChannelStat,
  HealthLevel, HealthMetric,
} from '@/types/report';

// ── Mappers ──────────────────────────────────────────────────

function mapCat(r: any): ReportCategory {
  return {
    id:          r.id,
    ownerId:     r.owner_id,
    villaId:     r.villa_id,
    name:        r.name,
    type:        r.type,
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

// ── Priority 3: Batch sort order update ─────────────────────

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

// ── Priority 2: Batch booking fetch (replaces N+1 calcAutoAmount) ──

interface BookingRow {
  id:               string;
  total:            number;
  status:           string;
  created_by_role:  string;
  checkin:          string;   // 'YYYY-MM-DD'
  checkout:         string;   // 'YYYY-MM-DD'
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
  // Priority 2 fix: use checkout >= from AND checkin <= to
  // This correctly captures stays that OVERLAP the month,
  // not just bookings whose checkin falls within the month.
  let q = (sb as any)
    .from('bookings')
    .select('id, total, status, created_by_role, checkin, checkout, source, villa_id, payment_status')
    .gte('checkout', fromDate)
    .lte('checkin', toDate);

  if (villaId) q = q.eq('villa_id', villaId);
  const { data } = await q;
  return data ?? [];
}

/** Returns auto amount for a given source + month from a pre-fetched booking set */
function calcAutoFromBatch(
  bookings: BookingRow[],
  source: string,
  year: number,
  month: number,
): number {
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0);   // last day of month

  // Only count bookings whose checkin falls in this calendar month
  const monthBookings = bookings.filter(b => {
    const checkin = new Date(b.checkin);
    return checkin >= from && checkin <= to;
  });

  if (source === 'villaos_confirmed') {
    return monthBookings
      .filter(b => b.status === 'confirmed')
      .reduce((s, b) => s + (b.total ?? 0), 0);
  }

  if (source === 'commission') {
    const base = monthBookings
      .filter(b => b.status === 'confirmed' && b.created_by_role === 'sale')
      .reduce((s, b) => s + (b.total ?? 0), 0);
    return Math.round(base * 0.05);
  }

  return 0;
}

// ── Priority 4: Derived metric helpers ──────────────────────

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

  const monthBookings = bookings.filter(b => {
    const c = new Date(b.checkin);
    return c >= from && c <= to && b.status === 'confirmed';
  });

  const map = new Map<string, { revenue: number; nights: number }>();
  for (const b of monthBookings) {
    const src = b.source ?? 'Trực tiếp';
    const nights = Math.max(1, Math.round(
      (new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / 86_400_000,
    ));
    const cur = map.get(src) ?? { revenue: 0, nights: 0 };
    map.set(src, { revenue: cur.revenue + (b.total ?? 0), nights: cur.nights + nights });
  }

  return Array.from(map.entries())
    .map(([source, { revenue, nights }]) => ({
      source,
      revenue,
      pct:       totalRevenue > 0 ? Math.round(revenue / totalRevenue * 100) : 0,
      adr:       nights > 0 ? Math.round(revenue / nights) : 0,
      occupancy: 0, // needs villa capacity — set downstream if available
      color:     CHANNEL_COLORS[source] ?? '#6B7280',
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function computeCostAlerts(
  expenses: ReportCategoryWithEntry[],
  prevExpenses: ReportCategoryWithEntry[],
): CostAlert[] {
  const prevMap = new Map(prevExpenses.map(e => [e.id, e.amount]));
  return expenses
    .filter(e => {
      const prev = prevMap.get(e.id) ?? 0;
      return prev > 0 && e.amount > prev * 1.15; // flag >15% increase
    })
    .map(e => {
      const prev = prevMap.get(e.id)!;
      const pct  = Math.round((e.amount - prev) / prev * 100);
      return {
        categoryId: e.id,
        name:       e.name,
        icon:       e.icon,
        color:      e.color,
        amount:     e.amount,
        prevAmount: prev,
        pctChange:  pct,
        reason:     `Tăng ${pct}% so với tháng trước`,
      };
    })
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

  const level = (v: number, hi: number, mid: number): HealthLevel =>
    v >= hi ? 'Xuất sắc' : v >= mid ? 'Tốt' : v >= mid * 0.6 ? 'Trung bình' : 'Kém';

  const metrics: HealthMetric[] = [
    { icon:'📅', label:'Công suất phòng',  value: level(occupancyRate,  80, 60) },
    { icon:'📊', label:'Tỷ lệ phụ thuộc OTA', value: level(100 - expenseRatioPct, 80, 50) },
    { icon:'🔧', label:'Chi phí vận hành', value: level(100 - expenseRatioPct, 80, 60) },
    { icon:'💹', label:'Lợi nhuận',        value: level(profitMarginPct, 50, 30) },
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

  // Month boundaries
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  // Priority 2: Compute the 6-month window start
  let win6Month = month - 5;
  let win6Year  = year;
  while (win6Month < 1) { win6Month += 12; win6Year--; }
  const win6From = `${win6Year}-${String(win6Month).padStart(2,'0')}-01`;
  const win6To   = new Date(year, month, 0).toISOString().slice(0, 10);

  // Priority 2: ONE batch query for all bookings covering 6-month window
  const allBookings = await fetchBookingsForRange(sb, villaId, win6From, win6To);

  // Priority 2: ONE query for all report_entries in the 6-month window
  const { data: allEntries } = await (sb as any)
    .from('report_entries')
    .select('*')
    .eq('owner_id', oid)
    .gte('year', win6Year)
    .lte('year', year);

  const entryMap = new Map<string, number>();
  (allEntries ?? []).forEach((e: any) => {
    entryMap.set(`${e.category_id}:${e.year}:${e.month}`, e.amount);
  });

  // Build amounts from pre-fetched data — no more per-category queries
  const withAmount = (c: ReportCategory, y: number, m: number): ReportCategoryWithEntry => {
    let amount = entryMap.get(`${c.id}:${y}:${m}`) ?? 0;
    if (c.isAuto && c.autoSource && amount === 0) {
      amount = calcAutoFromBatch(allBookings, c.autoSource, y, m);
    }
    if (c.fixedAmount > 0 && amount === 0) amount = c.fixedAmount;
    return { ...c, amount, note: null };
  };

  const revCats = cats.filter(c => c.type === 'revenue');
  const expCats = cats.filter(c => c.type === 'expense');

  const revItems      = revCats.map(c => withAmount(c, year,     month));
  const expItems      = expCats.map(c => withAmount(c, year,     month));
  const prevRevItems  = revCats.map(c => withAmount(c, prevYear, prevMonth));
  const prevExpItems  = expCats.map(c => withAmount(c, prevYear, prevMonth));

  const sum = (arr: ReportCategoryWithEntry[]) => arr.reduce((s, c) => s + c.amount, 0);
  const totalRev = sum(revItems);
  const totalExp = sum(expItems);
  const prevRev  = sum(prevRevItems);
  const prevExp  = sum(prevExpItems);

  // 6-month chart — now computed from already-fetched data
  const monthly6 = Array.from({ length: 6 }, (_, i) => {
    let m2 = month - 5 + i;
    let y2 = year;
    while (m2 < 1) { m2 += 12; y2--; }

    const rv = revCats.map(c => withAmount(c, y2, m2));
    const ex = expCats.map(c => withAmount(c, y2, m2));
    const r  = sum(rv);
    const e  = sum(ex);
    return { label: `T${m2}/${y2.toString().slice(2)}`, revenue: r, expense: e, profit: r - e };
  });

  // Priority 4: Cashflow from bookings this month
  const thisMonthFrom = `${year}-${String(month).padStart(2,'0')}-01`;
  const thisMonthTo   = new Date(year, month, 0).toISOString().slice(0, 10);

  const thisMonthBookings = allBookings.filter(b => {
    const c = new Date(b.checkin);
    const from = new Date(thisMonthFrom);
    const to   = new Date(thisMonthTo);
    return c >= from && c <= to;
  });

  const cashflowReceived = thisMonthBookings
    .filter(b => b.payment_status === 'paid')
    .reduce((s, b) => s + (b.total ?? 0), 0);

  const cashflowPending = thisMonthBookings
    .filter(b => b.payment_status !== 'paid' && b.status === 'confirmed')
    .reduce((s, b) => s + (b.total ?? 0), 0);

  // Occupancy: booked nights / total nights in month
  const daysInMonth = new Date(year, month, 0).getDate();
  const bookedNights = thisMonthBookings
    .filter(b => b.status === 'confirmed')
    .reduce((s, b) => {
      const nights = Math.max(1, Math.round(
        (new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / 86_400_000,
      ));
      return s + nights;
    }, 0);
  const occupancyRate = Math.min(100, Math.round(bookedNights / daysInMonth * 100));

  // Health score
  const profitMarginPct  = totalRev > 0 ? Math.round((totalRev - totalExp) / totalRev * 100) : 0;
  const expenseRatioPct  = totalRev > 0 ? Math.round(totalExp / totalRev * 100) : 100;
  const health           = computeHealthScore(occupancyRate, profitMarginPct, expenseRatioPct);

  // Cost alerts
  const costAlerts = computeCostAlerts(expItems, prevExpItems);

  // Channel stats
  const channelStats = computeChannelStats(allBookings, year, month, totalRev);

  // Revenue by source (for donut chart)
  const revenueBySource = channelStats.map(c => ({
    source: c.source,
    amount: c.revenue,
    pct:    c.pct,
    color:  c.color,
  }));

  // Upcoming payouts: future OTA bookings not yet paid
  const upcomingPayouts = allBookings
    .filter(b => {
      const checkin = new Date(b.checkin);
      const now     = new Date();
      return (
        b.status === 'confirmed' &&
        b.payment_status !== 'paid' &&
        checkin > now
      );
    })
    .slice(0, 5)
    .map(b => ({
      source:       b.source ?? 'Trực tiếp',
      amount:       b.total ?? 0,
      expectedDate: b.checkin,
      bookingRef:   b.id,
    }));

  // Top services — from extra_services table if available, fallback empty
  // TODO: join with extra_services once that table is confirmed
  const topServices = ([] as any[]);

  return {
    year, month, villaId: villaId ?? null,
    revenue:  revItems,
    expenses: expItems,
    totalRevenue:     totalRev,
    totalExpense:     totalExp,
    netProfit:        totalRev - totalExp,
    prevMonthRevenue: prevRev,
    prevMonthExpense: prevExp,
    prevMonthProfit:  prevRev - prevExp,
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
    topServices,
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
