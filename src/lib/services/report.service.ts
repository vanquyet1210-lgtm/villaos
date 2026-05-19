'use server';
// VillaOS v7 — lib/services/report.service.ts

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerSession }           from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CategoryScope = 'per_villa' | 'shared';
export type CategoryType  = 'revenue'   | 'expense';

export type Category = {
  id:         number;
  name:       string;
  type:       CategoryType;
  scope:      CategoryScope;
  icon:       string | null;
  sort_order: number;
  is_active:  boolean;
};

export type CategoryResult = Category & {
  amount:     number;                  // amount hiển thị (đã apply alloc_pct nếu cần)
  total:      number;                  // tổng hệ thống (villa_id = null)
  allocPct:   number;                  // % phân bổ (100 nếu per_villa hoặc xem tất cả)
  byVilla:    Record<number, number>;  // villaId → amount
  note:       string | null;
  // Optional display fields (used by ReportView / EntryForm)
  color?:     string;
  groupName?: string;
  isAuto?:    boolean;
};

export type MonthSummary = {
  label:   string;
  revenue: number;
  expense: number;
  profit:  number;
};

export type CostAlert = {
  name:      string;
  icon:      string;
  color:     string;
  amount:    number;
  pctChange: number;
  reason:    string;
};

export type HealthMetric = {
  icon:  string;
  label: string;
  value: string;
};

export type VillaSummary = {
  villaId:         number;
  villaName:       string;
  emoji:           string;
  revenue:         number;
  perVillaExpense: number;
  sharedAlloc:     number;
  totalExpense:    number;
  netProfit:       number;
  allocPct:        number;
};

export type MonthlyReport = {
  year:               number;
  month:              number;
  villaId:            number | null;
  revenue:            CategoryResult[];
  totalRevenue:       number;
  expenses:           CategoryResult[];   // per_villa expense
  totalExpense:       number;             // per_villa + shared allocated
  sharedExpenses:     CategoryResult[];
  totalSharedExpense: number;
  netProfit:          number;
  prevMonthRevenue:   number;
  prevMonthExpense:   number;
  prevMonthProfit:    number;
  allVillasSummary:   VillaSummary[];
  // Optional fields used by ReportView (analytics / future layers)
  sharedAllocPct?:        number;
  sharedAllocPctByVilla?: Record<string, number>;  // key: `${catId}_${villaId}`
  revenueBySource?:       { source: string; amount: number; color: string }[];
  costAlerts?:            CostAlert[];
  healthMetrics?:         HealthMetric[];
  monthly6?:              MonthSummary[];
  cashflowReceived?:      number;
  cashflowPending?:       number;
  occupancyRate?:         number;
  healthScore?:           number;
  healthLabel?:           string;
  healthTip?:             string;
  upcomingPayouts?:       unknown[];
  channelStats?:          unknown[];
  topServices?:           unknown[];
};

export type EntryInput = {
  category_id: number;
  scope:       CategoryScope;
  villa_id?:   number;                  // per_villa: bắt buộc
  amount:      number;
  alloc?:      Record<number, number>;  // shared: { villaId → pct }
  note?:       string;
};

// ─────────────────────────────────────────────────────────────
// getMonthlyReport
// ─────────────────────────────────────────────────────────────

export async function getMonthlyReport(
  year:     number,
  month:    number,
  villaId?: number,
): Promise<MonthlyReport | null> {
  const session = await getServerSession();
  if (!session) return null;
  const sb  = await createSupabaseServerClient();
  const oid = session.profile.id;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  // ── BUG #1 FIX: Tính last6 TRƯỚC để biết cần fetch năm/tháng nào ──
  // Trước đây chỉ fetch [year, prevYear] × [month, prevMonth] → chỉ 2 tháng,
  // nhưng monthly6 cần 6 tháng nên T-2..T-4 luôn trả về 0.
  const last6: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i; let y = year;
    while (m < 1) { m += 12; y--; }
    last6.push({ year: y, month: m });
  }

  // Gom tất cả (year, month) pairs cần thiết: trend + tháng hiện tại + tháng trước
  const neededPairs = new Set<string>();
  for (const p of last6) neededPairs.add(`${p.year}:${p.month}`);
  neededPairs.add(`${year}:${month}`);
  neededPairs.add(`${prevYear}:${prevMonth}`);

  // Fetch entries cho tất cả năm liên quan (tối đa 2 năm), filter tháng trong JS
  const neededYears = [...new Set([...neededPairs].map(k => Number(k.split(':')[0])))];

  // ── Fetch song song ──────────────────────────────────────────────
  const [{ data: cats }, { data: villasData }, { data: rawEntriesAll }] = await Promise.all([
    (sb as any)
      .from('categories')
      .select('*')
      .eq('owner_id', oid)
      .eq('is_active', true)
      .order('sort_order'),

    (sb as any)
      .from('villas')
      .select('id, name, emoji')
      .eq('owner_id', oid)
      .eq('status', 'active'),

    (sb as any)
      .from('entries')
      .select('*')
      .eq('owner_id', oid)
      .in('year', neededYears),
  ]);

  // Filter chỉ giữ (year, month) pairs thực sự cần → loại bỏ tháng thừa trong cùng năm
  const rawEntries = (rawEntriesAll ?? []).filter(
    (e: any) => neededPairs.has(`${e.year}:${e.month}`),
  );

  const allVillas: { id: number; name: string; emoji: string }[] = villasData ?? [];
  const nVillas      = allVillas.length || 1;
  const defaultAlloc = Math.round(100 / nVillas);

  // ── Index entries cho O(1) lookup ────────────────────────────────
  //
  // Có 2 loại row trong bảng entries:
  //   (A) Amount row  — alloc_pct IS NULL  → lưu số tiền
  //   (B) Alloc row   — alloc_pct NOT NULL → lưu % phân bổ, amount = 0
  //
  // amountMap key: `${catId}:${villaId ?? 'null'}:${year}:${month}`
  // allocMap  key: `${catId}:${villaId}:${year}:${month}`
  // noteMap   key: `${catId}:${villaId ?? 'null'}:${year}:${month}`

  const amountMap = new Map<string, number>();
  const allocMap  = new Map<string, number>();
  const noteMap   = new Map<string, string | null>();

  for (const e of rawEntries) {
    const vid = e.villa_id ?? 'null';
    const k   = `${e.category_id}:${vid}:${e.year}:${e.month}`;
    if (e.alloc_pct != null) {
      allocMap.set(k, e.alloc_pct);
    } else {
      amountMap.set(k, (amountMap.get(k) ?? 0) + e.amount);
      // BUG #5 FIX: index note cho cả per_villa lẫn shared
      if (e.note) noteMap.set(k, e.note);
    }
  }

  const getAmt = (catId: number, y: number, m: number, vid: number | null): number =>
    amountMap.get(`${catId}:${vid ?? 'null'}:${y}:${m}`) ?? 0;

  const getAllocPct = (catId: number, y: number, m: number, vid: number): number =>
    allocMap.get(`${catId}:${vid}:${y}:${m}`) ?? defaultAlloc;

  // BUG #5 FIX: helper lấy note từ noteMap thay vì dùng find() O(n)
  const getNote = (catId: number, y: number, m: number, vid: number | null): string | null =>
    noteMap.get(`${catId}:${vid ?? 'null'}:${y}:${m}`) ?? null;

  // ── Build CategoryResult ─────────────────────────────────────────
  const buildResult = (cat: Category, y: number, m: number): CategoryResult => {
    if (cat.scope === 'per_villa') {
      const byVilla: Record<number, number> = {};
      for (const v of allVillas) {
        const amt = getAmt(cat.id, y, m, v.id);
        if (amt > 0) byVilla[v.id] = amt;
      }
      const amount = villaId
        ? (byVilla[villaId] ?? 0)
        : Object.values(byVilla).reduce((a, b) => a + b, 0);

      // BUG #5 FIX: lấy note đúng villa (trước đây luôn trả null)
      const noteVid = villaId ?? (Object.keys(byVilla)[0] ? Number(Object.keys(byVilla)[0]) : null);
      const note    = noteVid !== null ? getNote(cat.id, y, m, noteVid) : null;

      return { ...cat, amount, total: amount, allocPct: 100, byVilla, note };
    }

    // shared
    const total    = getAmt(cat.id, y, m, null);
    const allocPct = villaId ? getAllocPct(cat.id, y, m, villaId) : 100;
    const amount   = villaId ? Math.round(total * allocPct / 100) : total;

    const byVilla: Record<number, number> = {};
    for (const v of allVillas) {
      const pct = getAllocPct(cat.id, y, m, v.id);
      byVilla[v.id] = Math.round(total * pct / 100);
    }

    // Shared note vẫn lấy từ row villa_id = null (không đổi)
    const note = getNote(cat.id, y, m, null);

    return { ...cat, amount, total, allocPct, byVilla, note };
  };

  // ── Phân loại ────────────────────────────────────────────────────
  const allCats      = (cats ?? []) as Category[];
  const revCats      = allCats.filter(c => c.type === 'revenue');
  const perVillaCats = allCats.filter(c => c.type === 'expense' && c.scope === 'per_villa');
  const sharedCats   = allCats.filter(c => c.type === 'expense' && c.scope === 'shared');

  const revItems    = revCats.map(c      => buildResult(c, year, month));
  const expItems    = perVillaCats.map(c => buildResult(c, year, month));
  const sharedItems = sharedCats.map(c   => buildResult(c, year, month));

  const prevRevItems    = revCats.map(c      => buildResult(c, prevYear, prevMonth));
  const prevExpItems    = perVillaCats.map(c => buildResult(c, prevYear, prevMonth));
  const prevSharedItems = sharedCats.map(c   => buildResult(c, prevYear, prevMonth));

  const sum = (arr: CategoryResult[]) => arr.reduce((s, c) => s + c.amount, 0);

  const totalRev    = sum(revItems);
  const totalShared = sum(sharedItems);
  const totalExp    = sum(expItems) + totalShared;
  const netProfit   = totalRev - totalExp;
  const prevRev     = sum(prevRevItems);
  const prevExp     = sum(prevExpItems) + sum(prevSharedItems);

  // ── BUG #4 FIX: Tính sharedAllocPct và sharedAllocPctByVilla ────
  // Trước đây không được gán vào return → ReportView luôn fallback về ?? 100.
  //
  // sharedAllocPct: trung bình có trọng số (weighted by total amount) của
  // allocPct từng shared category cho villa hiện tại.
  let sharedAllocPct = 100;
  if (villaId) {
    if (totalShared > 0) {
      const weightedSum = sharedItems.reduce((s, c) => s + c.total * c.allocPct, 0);
      sharedAllocPct = Math.round(weightedSum / totalShared);
    } else {
      sharedAllocPct = defaultAlloc;
    }
  }

  // sharedAllocPctByVilla: key = `${catId}_${villaId}` → % phân bổ (source of truth)
  const sharedAllocPctByVilla: Record<string, number> = {};
  for (const c of sharedItems) {
    for (const v of allVillas) {
      sharedAllocPctByVilla[`${c.id}_${v.id}`] = getAllocPct(c.id, year, month, v.id);
    }
  }

  // ── BUG #2 FIX: allVillasSummary tính sharedAlloc đúng per-category ──
  // Trước đây: average allocPct × totalShared → sai khi mỗi danh mục
  // có % phân bổ khác nhau.
  // Đúng: sum(catTotal × catAllocPct%) từng danh mục riêng.
  const allVillasSummary: VillaSummary[] = allVillas.map(v => {
    // Dùng lại byVilla từ items đã build → không gọi buildResult thừa
    const revenue         = revItems.reduce((s, c)    => s + (c.byVilla[v.id] ?? 0), 0);
    const perVillaExpense = expItems.reduce((s, c)    => s + (c.byVilla[v.id] ?? 0), 0);

    // BUG #2 FIX: tính từng category, không dùng trung bình
    const sharedAlloc = sharedItems.reduce((s, c) => {
      const catTotal  = c.total;
      const catPct    = getAllocPct(c.id, year, month, v.id);
      return s + Math.round(catTotal * catPct / 100);
    }, 0);

    const totalExpense = perVillaExpense + sharedAlloc;

    // allocPct hiển thị: trung bình có trọng số để dùng trong UI
    const allocPct = totalShared > 0
      ? Math.round(
          sharedItems.reduce((s, c) => s + c.total * getAllocPct(c.id, year, month, v.id), 0)
          / totalShared,
        )
      : defaultAlloc;

    return {
      villaId:   v.id,
      villaName: v.name,
      emoji:     v.emoji ?? '🏠',
      revenue,
      perVillaExpense,
      sharedAlloc,
      totalExpense,
      netProfit: revenue - totalExpense,
      allocPct,
    };
  });

  // ── monthly6: 6 tháng gần nhất để vẽ biểu đồ xu hướng ──────
  // BUG #1 FIX: last6 đã được tính ở trên và rawEntries đã bao gồm
  // đủ data cho tất cả 6 tháng.
  const MONTH_LBL = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
  const monthly6: MonthSummary[] = last6.map(p => {
    const r = sum(revCats.map(c => buildResult(c, p.year, p.month)));
    const e = sum(perVillaCats.map(c => buildResult(c, p.year, p.month)))
            + sum(sharedCats.map(c => buildResult(c, p.year, p.month)));
    return { label: MONTH_LBL[p.month - 1], revenue: r, expense: e, profit: r - e };
  });

  return {
    year, month,
    villaId:            villaId ?? null,
    revenue:            revItems,
    totalRevenue:       totalRev,
    expenses:           expItems,
    totalExpense:       totalExp,
    sharedExpenses:     sharedItems,
    totalSharedExpense: totalShared,
    netProfit,
    prevMonthRevenue:   prevRev,
    prevMonthExpense:   prevExp,
    prevMonthProfit:    prevRev - prevExp,
    allVillasSummary,
    monthly6,
    // BUG #4 FIX: gán đầy đủ vào return (trước đây bị thiếu)
    sharedAllocPct,
    sharedAllocPctByVilla,
  };
}

// ─────────────────────────────────────────────────────────────
// saveEntries
// Thay thế upsertReportEntry + deleteSharedAllocEntries cũ
// ─────────────────────────────────────────────────────────────

export async function saveEntries(
  year:    number,
  month:   number,
  entries: EntryInput[],
): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb  = await createSupabaseServerClient();
  const oid = session.profile.id;

  const valid = entries.filter(e => e.amount > 0);
  if (valid.length === 0) return {};

  // ── BUG #3 FIX: DELETE scope-aware, không xóa nhầm villa khác ──
  // Trước đây: DELETE WHERE category_id IN catIds (toàn bộ) →
  // khi lưu villa A, data villa B cùng danh mục bị xóa mà không re-insert.
  //
  // Đúng:
  //   shared  → DELETE amount row (villa_id IS NULL) + tất cả alloc rows cho cat đó
  //   per_villa → DELETE chỉ đúng villa_id đang được lưu

  const sharedValid    = valid.filter(e => e.scope === 'shared');
  const perVillaValid  = valid.filter(e => e.scope === 'per_villa');

  // Xóa shared entries (an toàn: shared rows không chứa data riêng villa nào)
  if (sharedValid.length > 0) {
    const sharedCatIds = [...new Set(sharedValid.map(e => e.category_id))];

    // Xóa amount rows (villa_id IS NULL)
    const { error: e1 } = await (sb as any)
      .from('entries')
      .delete()
      .eq('owner_id', oid)
      .eq('year', year)
      .eq('month', month)
      .in('category_id', sharedCatIds)
      .is('villa_id', null);
    if (e1) return { error: e1.message };

    // Xóa alloc marker rows (alloc_pct IS NOT NULL)
    const { error: e2 } = await (sb as any)
      .from('entries')
      .delete()
      .eq('owner_id', oid)
      .eq('year', year)
      .eq('month', month)
      .in('category_id', sharedCatIds)
      .not('alloc_pct', 'is', null);
    if (e2) return { error: e2.message };
  }

  // Xóa per_villa entries — chỉ đúng villa_id đang được lưu
  if (perVillaValid.length > 0) {
    // Group theo villa_id để tránh xóa nhầm villa khác
    const byVilla = new Map<number, number[]>(); // villaId → catIds
    for (const e of perVillaValid) {
      if (!e.villa_id) continue;
      const vid = Number(e.villa_id);
      if (!byVilla.has(vid)) byVilla.set(vid, []);
      byVilla.get(vid)!.push(e.category_id);
    }

    for (const [vid, catIds] of byVilla) {
      const { error: e3 } = await (sb as any)
        .from('entries')
        .delete()
        .eq('owner_id', oid)
        .eq('year', year)
        .eq('month', month)
        .eq('villa_id', vid)
        .in('category_id', catIds);
      if (e3) return { error: e3.message };
    }
  }

  // Build payload
  const payload: any[] = [];

  for (const e of valid) {
    const base = {
      owner_id:    oid,
      category_id: e.category_id,
      year, month,
      note:        e.note ?? null,
    };

    if (e.scope === 'per_villa') {
      if (!e.villa_id) continue;
      payload.push({ ...base, villa_id: e.villa_id, amount: e.amount, alloc_pct: null });
    }

    if (e.scope === 'shared') {
      // Row tổng (villa_id = null)
      payload.push({ ...base, villa_id: null, amount: e.amount, alloc_pct: null });

      // Alloc marker rows — source of truth là alloc_pct
      for (const [vid, pct] of Object.entries(e.alloc ?? {})) {
        if (!pct || pct <= 0) continue;
        payload.push({
          ...base,
          villa_id:  Number(vid),
          amount:    0,
          alloc_pct: pct,
        });
      }
    }
  }

  if (payload.length === 0) return {};

  const { error } = await (sb as any).from('entries').insert(payload);
  return error ? { error: error.message } : {};
}

// ─────────────────────────────────────────────────────────────
// Category CRUD
// ─────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const session = await getServerSession();
  if (!session) return [];
  const sb = await createSupabaseServerClient();
  const { data } = await (sb as any)
    .from('categories')
    .select('*')
    .eq('owner_id', session.profile.id)
    .eq('is_active', true)
    .order('sort_order');
  return (data ?? []) as Category[];
}

export async function upsertCategory(data: {
  id?:         number;
  name:        string;
  type:        CategoryType;
  scope:       CategoryScope;
  icon?:       string;
  sort_order?: number;
}): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();

  const row = {
    owner_id:   session.profile.id,
    name:       data.name,
    type:       data.type,
    scope:      data.scope,
    icon:       data.icon ?? '💰',
    sort_order: data.sort_order ?? 99,
    is_active:  true,
  };

  const { error } = data.id
    ? await (sb as any).from('categories').update(row).eq('id', data.id).eq('owner_id', session.profile.id)
    : await (sb as any).from('categories').insert(row);

  return error ? { error: error.message } : {};
}

export async function deactivateCategory(id: number): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();
  const { error } = await (sb as any)
    .from('categories')
    .update({ is_active: false })
    .eq('id', id)
    .eq('owner_id', session.profile.id);
  return error ? { error: error.message } : {};
}

export async function updateCategorySortOrders(
  updates: { id: number; sort_order: number }[],
): Promise<{ error?: string }> {
  const session = await getServerSession();
  if (!session) return { error: 'Chưa đăng nhập' };
  const sb = await createSupabaseServerClient();
  for (const { id, sort_order } of updates) {
    const { error } = await (sb as any)
      .from('categories')
      .update({ sort_order })
      .eq('id', id)
      .eq('owner_id', session.profile.id);
    if (error) return { error: error.message };
  }
  return {};
}

// ─────────────────────────────────────────────────────────────
// seedDefaultCategories
// Tạo danh mục mặc định cho owner nếu chưa có
// ─────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'is_active'>[] = [
  // ── 1. DOANH THU (per_villa) ─────────────────────────────
  { name: 'VillaOS',            type: 'revenue', scope: 'per_villa', icon: '🏠', sort_order:  0 },
  { name: 'Agoda',              type: 'revenue', scope: 'per_villa', icon: '🔴', sort_order:  1 },
  { name: 'Booking.com',        type: 'revenue', scope: 'per_villa', icon: '💙', sort_order:  2 },
  { name: 'Airbnb',             type: 'revenue', scope: 'per_villa', icon: '🌸', sort_order:  3 },
  { name: 'Traveloka',          type: 'revenue', scope: 'per_villa', icon: '💚', sort_order:  4 },
  { name: 'Facebook',           type: 'revenue', scope: 'per_villa', icon: '👥', sort_order:  5 },
  { name: 'Trực tiếp',          type: 'revenue', scope: 'per_villa', icon: '🤝', sort_order:  6 },
  { name: 'Doanh thu khác',     type: 'revenue', scope: 'per_villa', icon: '💰', sort_order:  7 },

  // ── 2.1 CHI PHÍ VẬN HÀNH (per_villa) ────────────────────
  { name: 'Điện',               type: 'expense', scope: 'per_villa', icon: '⚡', sort_order: 10 },
  { name: 'Nước',               type: 'expense', scope: 'per_villa', icon: '💧', sort_order: 11 },
  { name: 'Internet',           type: 'expense', scope: 'per_villa', icon: '📶', sort_order: 12 },
  { name: 'Vệ sinh',            type: 'expense', scope: 'per_villa', icon: '🧹', sort_order: 13 },
  { name: 'Vật tư tiêu hao',    type: 'expense', scope: 'per_villa', icon: '🛒', sort_order: 14 },
  { name: 'Bảo trì',            type: 'expense', scope: 'per_villa', icon: '🔧', sort_order: 15 },
  { name: 'Chi phí khác',       type: 'expense', scope: 'per_villa', icon: '📦', sort_order: 16 },

  // ── 2.2 CHI PHÍ TÀI CHÍNH (per_villa) ───────────────────
  { name: 'Thuê mặt bằng',      type: 'expense', scope: 'per_villa', icon: '🏢', sort_order: 20 },
  { name: 'Thuế GTGT',          type: 'expense', scope: 'per_villa', icon: '🧾', sort_order: 21 },
  { name: 'Thuế TNDN',          type: 'expense', scope: 'per_villa', icon: '🧾', sort_order: 22 },
  { name: 'Thuế TNCN',          type: 'expense', scope: 'per_villa', icon: '🧾', sort_order: 23 },
  { name: 'Thuế khác',          type: 'expense', scope: 'per_villa', icon: '🧾', sort_order: 24 },
  { name: 'Trả ngân hàng',      type: 'expense', scope: 'per_villa', icon: '🏦', sort_order: 25 },

  // ── 2.3 CHI PHÍ KHÁC (per_villa) ────────────────────────
  { name: 'Marketing',          type: 'expense', scope: 'per_villa', icon: '📣', sort_order: 30 },
  { name: 'Văn phòng phẩm',     type: 'expense', scope: 'per_villa', icon: '✏️', sort_order: 31 },
  { name: 'Phí dịch vụ',        type: 'expense', scope: 'per_villa', icon: '💼', sort_order: 32 },
  { name: 'Chi phí phát sinh',  type: 'expense', scope: 'per_villa', icon: '🗂️', sort_order: 33 },

  // ── 3. CHI PHÍ CHUNG (shared) ────────────────────────────
  { name: 'Lương nhân viên',    type: 'expense', scope: 'shared',    icon: '💵', sort_order: 40 },
  { name: 'Lễ tân',             type: 'expense', scope: 'shared',    icon: '🛎️', sort_order: 41 },
  { name: 'Quản lý',            type: 'expense', scope: 'shared',    icon: '👔', sort_order: 42 },
  { name: 'Chi phí chung khác', type: 'expense', scope: 'shared',    icon: '🤝', sort_order: 43 },
];

export async function seedDefaultCategories(): Promise<{ inserted: number; error?: string }> {
  const session = await getServerSession();
  if (!session) return { inserted: 0, error: 'Chưa đăng nhập' };
  const sb  = await createSupabaseServerClient();
  const oid = session.profile.id;

  // Chỉ seed nếu chưa có danh mục nào
  const { data: existing } = await (sb as any)
    .from('categories')
    .select('id')
    .eq('owner_id', oid)
    .limit(1);

  if (existing && existing.length > 0) {
    return { inserted: 0, error: 'Đã có danh mục, không seed lại' };
  }

  const payload = DEFAULT_CATEGORIES.map(c => ({
    ...c,
    owner_id:  oid,
    is_active: true,
  }));

  const { error } = await (sb as any).from('categories').insert(payload);
  return error
    ? { inserted: 0, error: error.message }
    : { inserted: payload.length };
}
