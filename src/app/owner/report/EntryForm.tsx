'use client';
// VillaOS v7 — app/owner/report/EntryForm.tsx

import { useState } from 'react';
import type { MonthlyReport, ReportCategoryWithEntry } from '@/types/report';

export interface SaveEntry {
  categoryId:         string;
  amount:             number;
  note?:              string;
  isShared?:          boolean;
  allocPct?:          number;                      // % phân bổ cho villa đang xem
  allVillaAllocPcts?: Record<string, number>;      // % phân bổ tất cả villas: {villaId: pct}
}

interface Props {
  report:           MonthlyReport;
  villas:           { id: string; name: string; emoji: string }[];
  currentVillaId?:  string | null;   // which villa is currently selected
  onSave:           (entries: SaveEntry[]) => Promise<void>;
  onCopyPrevMonth?: () => void;
}

// ── Formatters ────────────────────────────────────────────────
const fmt   = (n: number) => n ? n.toLocaleString('vi-VN') : '';
const money = (n: number) => {
  if (!n) return '0 đ';
  return n.toLocaleString('vi-VN') + ' đ';
};
const moneyShort = (n: number) => {
  if (!n) return '0đ';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'') + ' tr';
  return n.toLocaleString('vi-VN') + 'đ';
};
const parseAmt = (v: string): number => {
  const s = v.trim();
  const tr = s.match(/^([\d.,]+)\s*tr$/i);
  if (tr) return Math.round(parseFloat(tr[1].replace(/\./g,'').replace(',','.')) * 1_000_000);
  return parseInt(s.replace(/\./g,'').replace(/,/g,'')) || 0;
};

// ── Brand icons ───────────────────────────────────────────────
const BRAND: Record<string, { bg: string; color: string; label: string }> = {
  'Agoda':           { bg:'#E8F0FE', color:'#1A73E8', label:'A'  },
  'Booking.com':     { bg:'#E8F4FD', color:'#003580', label:'B'  },
  'Airbnb':          { bg:'#FFF0F0', color:'#FF5A5F', label:'AB' },
  'VillaOS':         { bg:'#EBF7F2', color:'#0A6B44', label:'VO' },
  'Khách trực tiếp': { bg:'#F3E8FF', color:'#7C3AED', label:'KH' },
  'Tour / Vé':       { bg:'#FFF7ED', color:'#C2410C', label:'TR' },
  'Xe đưa đón':      { bg:'#F0FDF4', color:'#166534', label:'XE' },
  'Dịch vụ thêm':    { bg:'#FDF4FF', color:'#9333EA', label:'DV' },
};

function BrandIcon({ name, icon }: { name: string; icon: string }) {
  const b = BRAND[name];
  if (b) return (
    <span className="ef-brand" style={{ background: b.bg, color: b.color }}>
      {b.label}
    </span>
  );
  return <span className="ef-icon">{icon}</span>;
}

// ── Smart input ───────────────────────────────────────────────
function AmtInput({ id, value, onChange, placeholder = 'Nhập số tiền' }: {
  id?: string; value: number; onChange: (v: number) => void; placeholder?: string;
}) {
  const [raw,   setRaw]   = useState('');
  const [focus, setFocus] = useState(false);
  return (
    <div className={`ef-inp${focus ? ' ef-inp--focus' : ''}`}>
      <input
        id={id} type="text" inputMode="numeric"
        value={focus ? raw : (value ? fmt(value) : '')}
        placeholder={placeholder}
        onChange={e => { setRaw(e.target.value); onChange(parseAmt(e.target.value)); }}
        onFocus={e => { setFocus(true); setRaw(value ? fmt(value) : ''); e.target.select(); }}
        onBlur={() => { setFocus(false); onChange(parseAmt(raw)); setRaw(''); }}
      />
      <span className="ef-inp-unit">đ</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function initMap(items: ReportCategoryWithEntry[]) {
  const m: Record<string, number> = {};
  items.forEach(c => { m[c.id] = c.amount; });
  return m;
}
function groupBy<T>(arr: T[], key: (x: T) => string) {
  return arr.reduce((acc, x) => {
    const k = key(x);
    (acc[k] = acc[k] ?? []).push(x);
    return acc;
  }, {} as Record<string, T[]>);
}
function sumMap(ids: string[], map: Record<string, number>) {
  return ids.reduce((s, id) => s + (map[id] ?? 0), 0);
}

// ── Group meta ────────────────────────────────────────────────
const GROUP_META: Record<string, { label: string; icon: string; accent: string; light: string; border: string }> = {
  'Vận hành': { label:'CHI PHÍ VẬN HÀNH',  icon:'🔧', accent:'#B45309', light:'rgba(217,119,6,.07)',  border:'#F59E0B' },
  'Tài chính': { label:'CHI PHÍ TÀI CHÍNH', icon:'💼', accent:'#6D28D9', light:'rgba(124,58,237,.07)', border:'#A78BFA' },
  'Cố định':   { label:'CHI PHÍ TÀI CHÍNH', icon:'💼', accent:'#6D28D9', light:'rgba(124,58,237,.07)', border:'#A78BFA' },
  'Khác':      { label:'CHI PHÍ KHÁC',       icon:'📦', accent:'#92400E', light:'rgba(180,83,9,.07)',   border:'#D97706' },
};
const FALLBACK_META = { label:'CHI PHÍ KHÁC', icon:'📦', accent:'#92400E', light:'rgba(180,83,9,.07)', border:'#D97706' };

function getGroupMeta(name: string, idx: number) {
  if (GROUP_META[name]) return GROUP_META[name];
  const fallbacks = [
    { label:'CHI PHÍ VẬN HÀNH',  icon:'🔧', accent:'#B45309', light:'rgba(217,119,6,.07)',  border:'#F59E0B' },
    { label:'CHI PHÍ TÀI CHÍNH', icon:'💼', accent:'#6D28D9', light:'rgba(124,58,237,.07)', border:'#A78BFA' },
    FALLBACK_META,
  ];
  return fallbacks[idx] ?? FALLBACK_META;
}

// ── Main ──────────────────────────────────────────────────────
export default function EntryForm({ report, villas, currentVillaId, onSave, onCopyPrevMonth }: Props) {
  const now = new Date().toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });

  // Revenue — sorted by preferred order + separated into auto and manual
  const REVENUE_ORDER = ['VillaOS', 'Agoda', 'Booking.com', 'Airbnb', 'Khách trực tiếp', 'Dịch vụ thêm'];
  const sortedRevenue = [...report.revenue].sort((a, b) => {
    const aIdx = REVENUE_ORDER.indexOf(a.name);
    const bIdx = REVENUE_ORDER.indexOf(b.name);
    const aSort = aIdx >= 0 ? aIdx : 999;
    const bSort = bIdx >= 0 ? bIdx : 999;
    return aSort - bSort;
  });
  
  const autoRev   = sortedRevenue.filter(c => c.isAuto && c.name !== 'VillaOS'); // VillaOS is editable even if auto
  const villaOS   = sortedRevenue.find(c => c.name === 'VillaOS'); // Separate VillaOS
  const manualRev = sortedRevenue.filter(c => !c.isAuto || c.name === 'VillaOS'); // Include VillaOS as editable

  // Per-villa expenses grouped
  const pvExp      = report.expenses.filter(c => c.scope !== 'shared' && !c.isAuto);
  const pvGroups   = groupBy(pvExp, c => c.groupName ?? 'Khác');
  const pvEntries  = Object.entries(pvGroups);

  // Shared
  const sharedExp  = report.sharedExpenses.filter(c => !c.isAuto);
  const sharedAuto = report.sharedExpenses.filter(c => c.isAuto);
  const sharedGrps = groupBy(sharedExp, c => c.groupName ?? 'Nhân sự');

  // State
  const [villaAmts,  setVA] = useState<Record<string,number>>(initMap([...manualRev, ...pvExp]));
  const [sharedAmts, setSA] = useState<Record<string,number>>(initMap(sharedExp));
  const [extraRows,  setER] = useState([{ label:'', amount:0 },{ label:'', amount:0 },{ label:'', amount:0 }]);
  const [saving,  setSaving] = useState(false);
  const [saved,   setSaved]  = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [expTab,  setExpTab] = useState(0);

  // Per-villa editable allocation percentages — initialized from allVillasSummary or equal split
  // Per-cell allocation % — keyed by `${villaId}_${catId}` so each cell is independent
  const allSharedCats = [
    ...(report.sharedExpenses ?? []).filter(c => c.isAuto),
    ...(report.sharedExpenses ?? []).filter(c => !c.isAuto),
  ];
  const initVillaAllocPcts = () => {
    // sharedAllocAmtByVilla key = `${catId}_${villaId}`
    const savedAmts  = report.sharedAllocAmtByVilla ?? {};
    const equalSplit = villas.length > 0 ? Math.round(100 / villas.length) : 0;
    const m: Record<string, number> = {};

    allSharedCats.forEach(cat => {
      const fullAmt = (report.sharedExpenses ?? []).find(s => s.id === cat.id)?.amount ?? 0;
      // Kiểm tra xem DB có alloc data cho category này không
      const hasData = villas.some(v => (savedAmts[`${cat.id}_${v.id}`] ?? 0) > 0);

      villas.forEach(v => {
        if (hasData && fullAmt > 0 && savedAmts[`${cat.id}_${v.id}`]) {
          // Restore % từ DB: allocAmt / fullAmt * 100
          m[`${v.id}_${cat.id}`] = Math.round(savedAmts[`${cat.id}_${v.id}`] / fullAmt * 100);
        } else {
          m[`${v.id}_${cat.id}`] = equalSplit;
        }
      });
    });
    return m;
  };

  const [villaAllocPcts, setVAP] = useState<Record<string,number>>(initVillaAllocPcts);

  const setVillaPct = (villaId: string, catId: string, raw: number) => {
    const pct = Math.min(100, Math.max(0, raw));
    setVAP(p => ({ ...p, [`${villaId}_${catId}`]: pct }));
  };

  // Validate: mỗi ROW (category) tổng % các villa = 100%
  const rowTotal = (catId: string) =>
    villas.reduce((s, v) => s + (villaAllocPcts[`${v.id}_${catId}`] ?? 0), 0);

  const allRowsOk = allSharedCats.every(c => rowTotal(c.id) === 100);

  // Cho display bar: % của villa này theo từng row (dùng cat đầu tiên làm đại diện)
  const villaColPct = (villaId: string) => {
    if (allSharedCats.length === 0) return 0;
    return villaAllocPcts[`${villaId}_${allSharedCats[0].id}`] ?? 0;
  };

  const totalAllocPct = villas.reduce((s, v) => s + villaColPct(v.id), 0);
  const allocOk = allRowsOk;

  const va = (id: string, v: number) => setVA(p => ({ ...p, [id]: v }));
  const sa = (id: string, v: number) => setSA(p => ({ ...p, [id]: v }));

  // Totals
  const totalAutoRev  = autoRev.reduce((s,c) => s + c.amount, 0);
  const totalManRev   = manualRev.reduce((s,c) => s + (villaAmts[c.id]??0), 0);
  const totalExtraRev = extraRows.reduce((s,r) => s + r.amount, 0);
  const totalRev      = totalAutoRev + totalManRev + totalExtraRev;
  const totalPvExp    = pvExp.reduce((s,c) => s + (villaAmts[c.id]??0), 0);
  const totalSharedFull = [...sharedExp.map(c => sharedAmts[c.id]??0), ...sharedAuto.map(c=>c.amount)].reduce((a,b)=>a+b,0);

  // Use per-cat allocation from the table state (villaAllocPcts) for the current villa.
  // This is correct even before the server persists allocPct, because the user can see
  // the live formula update as they adjust the % inputs.
  const allocShared = (() => {
    if (!currentVillaId) {
      // "Tất cả villa" view — use server-side pct as fallback
      const pct = report.sharedAllocPct ?? 0;
      return Math.round(totalSharedFull * pct / 100);
    }
    return allSharedCats.reduce((s, cat) => {
      const full = (cat as any).isAuto
        ? ((cat as any).amount as number)
        : (sharedAmts[cat.id] ?? 0);
      const pct = villaAllocPcts[`${currentVillaId}_${cat.id}`] ?? 0;
      return s + (full && pct ? Math.round(full * pct / 100) : 0);
    }, 0);
  })();

  const totalExp  = totalPvExp + allocShared;
  const netProfit = totalRev - totalExp;

  const handleSave = async () => {
    setSaving(true);

    const allSharedItems = [
      ...sharedExp.map(c  => ({ categoryId: c.id, amount: sharedAmts[c.id]??0, isAuto: false })),
      ...sharedAuto.map(c => ({ categoryId: c.id, amount: c.amount,             isAuto: true  })),
    ];

    await onSave([
      ...manualRev.map(c => ({ categoryId: c.id, amount: villaAmts[c.id]??0 })),
      ...pvExp.map(c     => ({ categoryId: c.id, amount: villaAmts[c.id]??0 })),
      ...allSharedItems.map(c => ({
        categoryId: c.categoryId,
        amount:     c.amount,
        isShared:   true,
        allocPct: currentVillaId
          ? (villaAllocPcts[`${currentVillaId}_${c.categoryId}`] ?? 0)
          : undefined,
        allVillaAllocPcts: Object.fromEntries(
          villas.map(v => [v.id, villaAllocPcts[`${v.id}_${c.categoryId}`] ?? 0])
        ),
      })),
    ]);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleRefresh = () => {
    setRefresh(true);
    setTimeout(() => setRefresh(false), 800);
  };

  // All villas from prop (always available regardless of selected villa)
  const allVillas = villas;

  return (
    <div className="ef">

      {/* ── Banner ── */}
      <div className="ef-banner">
        <div className="ef-banner-left">
          <div className="ef-banner-icon">☁️</div>
          <div>
            <div className="ef-banner-title">Dữ liệu tự động lấy từ hệ thống <span className="ef-banner-badge">Có thể chỉnh sửa</span></div>
            <div className="ef-banner-sub">Các khoản dưới đây được đồng bộ tự động từ booking. Bạn có thể chỉnh sửa nếu cần.</div>
          </div>
        </div>
        <div className="ef-banner-right">
          <span className="ef-banner-time">🕐 Cập nhật: {now}</span>
          <button className={`ef-refresh-btn${refresh ? ' spinning' : ''}`} onClick={handleRefresh} title="Làm mới">↻</button>
          <span className="ef-banner-hint">Gõ <kbd>18tr</kbd> = 18.000.000đ</span>
        </div>
      </div>

      {/* ══ SECTION 1: DOANH THU ══ */}
      <div className="ef-card">
        <div className="ef-card-hd ef-card-hd--rev">
          <span className="ef-card-num ef-card-num--rev">1</span>
          <span>NHẬP DOANH THU</span>
        </div>
        <div className="ef-rev-grid">
          {/* AUTO */}
          <div className="ef-rev-col">
            <div className="ef-col-tag ef-col-tag--auto"><span className="ef-col-tag-dot"/>AUTO</div>
            <div className="ef-tbl-head"><span>Nguồn doanh thu</span><span>Số tiền (đ)</span></div>
            {autoRev.map(c => (
              <div key={c.id} className="ef-tbl-row ef-tbl-row--auto">
                <div className="ef-tbl-name">
                  <BrandIcon name={c.name} icon={c.icon}/>
                  <span>{c.name}</span>
                  <span className="ef-auto-badge">auto</span>
                </div>
                <span className="ef-tbl-fixed">{c.amount ? fmt(c.amount) : '—'}</span>
              </div>
            ))}
            <div className="ef-col-subtotal ef-col-subtotal--rev">
              <span>Tổng doanh thu tự động</span>
              <span>{money(autoRev.reduce((s,c) => s + c.amount, 0))}</span>
            </div>
          </div>

          {/* MANUAL - includes VillaOS */}
          <div className="ef-rev-col ef-rev-col--manual">
            <div className="ef-col-tag ef-col-tag--manual"><span className="ef-col-tag-dot"/>MANUAL</div>
            <div className="ef-tbl-head"><span>Nguồn doanh thu nhập tay</span><span>Số tiền (đ)</span></div>
            {villaOS && (
              <div key={villaOS.id} className="ef-tbl-row">
                <div className="ef-tbl-name">
                  <BrandIcon name={villaOS.name} icon={villaOS.icon}/>
                  <span>{villaOS.name}</span>
                  {villaOS.isAuto && <span className="ef-auto-badge">auto</span>}
                </div>
                <AmtInput value={villaAmts[villaOS.id]??0} onChange={v=>va(villaOS.id,v)} placeholder="Nhập số tiền"/>
              </div>
            )}
            {manualRev.filter(c => c.name !== 'VillaOS').map(c => (
              <div key={c.id} className="ef-tbl-row">
                <div className="ef-tbl-name">
                  <BrandIcon name={c.name} icon={c.icon}/><span>{c.name}</span>
                </div>
                <AmtInput value={villaAmts[c.id]??0} onChange={v=>va(c.id,v)} placeholder="Nhập số tiền"/>
              </div>
            ))}
            {extraRows.map((row, i) => (
              <div key={`extra-${i}`} className="ef-tbl-row ef-tbl-row--extra">
                <input className="ef-extra-lbl" value={row.label}
                  placeholder={`Doanh thu khác ${i + 1}`}
                  onChange={e => setER(r => r.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                />
                <AmtInput value={row.amount}
                  onChange={v => setER(r => r.map((x,j) => j===i ? {...x,amount:v} : x))}/>
              </div>
            ))}
            <button className="ef-add-btn" onClick={() => setER(r => [...r,{label:'',amount:0}])}>＋ Thêm dòng</button>
            <div className="ef-col-subtotal ef-col-subtotal--manual">
              <span>Tổng nhập tay bổ sung</span>
              <span>{money(manualRev.filter(c => c.name !== 'VillaOS').reduce((s,c) => s + (villaAmts[c.id]??0), 0) + extraRows.reduce((s,r) => s + r.amount, 0))}</span>
            </div>
          </div>
        </div>
        <div className="ef-big-total ef-big-total--rev">
          <span>TỔNG DOANH THU (TỰ ĐỘNG + NHẬP TAY)</span>
          <span className="ef-big-total-val">{money(totalRev)}</span>
        </div>
      </div>

      {/* ══ SECTION 2: CHI PHÍ RIÊNG ══ */}
      <div className="ef-card">
        <div className="ef-card-hd ef-card-hd--exp">
          <span className="ef-card-num ef-card-num--exp">2</span>
          <span>NHẬP CHI PHÍ RIÊNG (THEO VILLA)</span>
        </div>
        <div className="ef-exp-grid ef-exp-grid--3">
          {pvEntries.slice(0, 3).map(([gName, items], gi) => {
            const meta = getGroupMeta(gName, gi);
            const gSum = sumMap(items.map(c=>c.id), villaAmts);
            return (
              <div key={gName} className="ef-exp-col">
                <div className="ef-exp-col-hd" style={{ background:meta.light, borderBottom:`2px solid ${meta.border}` }}>
                  <span>{meta.icon}</span>
                  <span style={{ color:meta.accent, fontWeight:800, fontSize:'.7rem', letterSpacing:'.05em' }}>
                    2.{gi+1} {meta.label}
                  </span>
                </div>
                <div className="ef-tbl-head"><span>Khoản chi</span><span>Số tiền (đ)</span></div>
                {items.map(c => (
                  <div key={c.id} className="ef-tbl-row">
                    <div className="ef-tbl-name">
                      <span className="ef-icon">{c.icon}</span>
                      <span className="ef-name-text">{c.name.replace(' (chung)','')}</span>
                    </div>
                    <AmtInput value={villaAmts[c.id]??0} onChange={v=>va(c.id,v)}/>
                  </div>
                ))}
                <div className="ef-col-subtotal" style={{ color:meta.accent }}>
                  <span>Tổng</span>
                  <span style={{ fontFamily:'Georgia,serif', fontStyle:'italic' }}>{money(gSum)}</span>
                </div>
              </div>
            );
          })}
          {pvEntries.length === 0 && (
            <div className="ef-empty-hint">Chưa có danh mục. Vào <strong>⚙️ Danh mục</strong> để thêm.</div>
          )}
        </div>
        <div className="ef-big-total ef-big-total--exp">
          <span>TỔNG CHI PHÍ RIÊNG (THEO VILLA)</span>
          <span className="ef-big-total-val">{money(totalPvExp)}</span>
        </div>
      </div>


      {/* ══ SECTION 3: CHI PHÍ CHUNG — multi-villa table ══ */}
      <div className="ef-card">
        <div className="ef-card-hd ef-card-hd--shared">
          <span className="ef-card-num ef-card-num--shared">3</span>
          <span>CHI PHÍ CHUNG (TOÀN HỆ THỐNG)</span>
          <span className="ef-shared-lock">🔒 Cố định · Không đổi theo Villa</span>
        </div>

        {/* % allocation validation bar */}
        <div className={`ef-alloc-bar${allocOk ? ' ef-alloc-bar--ok' : ' ef-alloc-bar--warn'}`}>
          <span className="ef-alloc-bar-label">
            {allocOk ? '✅' : '⚠️'}&nbsp;
            {allocOk
              ? 'Mỗi khoản chi phân bổ đúng 100%'
              : <>Chưa đúng 100% tại: <strong>{allSharedCats.filter(c => rowTotal(c.id) !== 100).map(c => c.name).join(', ')}</strong></>
            }
          </span>
          <div className="ef-alloc-bar-track">
            {allVillas.map((v, i) => {
              const pct = villaColPct(v.id);
              const COLORS = ['#3B5998','#2D6A4F','#92400E','#6D28D9','#B91C1C'];
              return pct > 0 ? (
                <div key={v.id} className="ef-alloc-bar-seg"
                  style={{ width:`${Math.min(pct, 100)}%`, background: COLORS[i % COLORS.length] }}
                  title={`${v.emoji} ${v.name}: ${pct}%`}
                />
              ) : null;
            })}
          </div>
        </div>

        <div className="ef-mv-wrap">
          <table className="ef-mv-tbl">
            <thead>
              <tr className="ef-mv-hdr-row">
                <th className="ef-mv-th ef-mv-th--name" rowSpan={2}>KHOẢN CHI</th>
                <th className="ef-mv-th ef-mv-th--all" colSpan={2}>ALL (TỔNG HỆ THỐNG)</th>
                {allVillas.map((v, i) => (
                  <th key={v.id} className={`ef-mv-th ef-mv-th--villa ef-mv-th--v${i % 5}`} colSpan={2}>
                    {v.emoji} {v.name.toUpperCase()}
                  </th>
                ))}
              </tr>
              <tr className="ef-mv-sub-row">
                <th className="ef-mv-sub">SỐ TIỀN (VND)</th>
                <th className="ef-mv-sub ef-mv-sub--100">100%</th>
                {allVillas.map(v => (
                  <>
                    <th key={v.id+'a'} className="ef-mv-sub">SỐ TIỀN (VND)</th>
                    <th key={v.id+'p'} className="ef-mv-sub ef-mv-sub--pct">% PHÂN BỔ</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ...sharedAuto.map(c => ({ ...c, isAutoItem: true as const })),
                ...sharedExp,
              ].map((c: any) => {
                const full = c.isAutoItem ? (c.amount as number) : (sharedAmts[c.id] ?? 0);
                return (
                  <tr key={c.id} className={`ef-mv-row${c.isAutoItem ? ' ef-mv-row--auto' : ''}`}>
                    <td className="ef-mv-td-name">
                      <span className="ef-mv-cat-icon">{c.icon}</span>
                      <span>{c.name}</span>
                      {c.isAutoItem && <span className="ef-auto-badge">auto</span>}
                    </td>
                    <td className="ef-mv-td-input">
                      {c.isAutoItem
                        ? <span className="ef-mv-num">{full ? full.toLocaleString('vi-VN') : '—'}</span>
                        : <AmtInput value={full} onChange={v => sa(c.id, v)}/>}
                    </td>
                    <td className="ef-mv-td-100">100%</td>
                    {allVillas.map(v => {
                      const cellKey = `${v.id}_${c.id}`;
                      const pct     = villaAllocPcts[cellKey] ?? 0;
                      const alloc   = full && pct ? Math.round(full * pct / 100) : 0;
                      return (
                        <>
                          <td key={v.id+'a'} className="ef-mv-td-alloc">
                            {alloc ? alloc.toLocaleString('vi-VN') : '—'}
                          </td>
                          <td key={v.id+'p'} className="ef-mv-td-pct-edit">
                            <div className="ef-pct-input-wrap">
                              <input
                                type="number" min="0" max="100" step="1"
                                className="ef-pct-input"
                                value={villaAllocPcts[cellKey] ?? 0}
                                placeholder="0"
                                onChange={e => setVillaPct(v.id, c.id, Number(e.target.value) || 0)}
                              />
                              <span className="ef-pct-sym">%</span>
                            </div>
                          </td>
                        </>
                      );
                    })}
                  </tr>
                );
              })}
              {sharedExp.length === 0 && sharedAuto.length === 0 && (
                <tr><td colSpan={3 + allVillas.length * 2} className="ef-empty-hint">Chưa có danh mục chi phí chung.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="ef-mv-footer-row">
                <td className="ef-mv-footer-lbl">TỔNG</td>
                <td className="ef-mv-footer-num">{totalSharedFull ? totalSharedFull.toLocaleString('vi-VN') : '—'}</td>
                <td className="ef-mv-footer-100">100%</td>
                {allVillas.map(v => {
                  // Sum actual allocations per villa across all rows
                  const totalVillaAlloc = allSharedCats.reduce((s, cat) => {
                    const full2 = cat.isAuto ? cat.amount : (sharedAmts[cat.id] ?? 0);
                    const pct2  = villaAllocPcts[`${v.id}_${cat.id}`] ?? 0;
                    return s + (full2 && pct2 ? Math.round(full2 * pct2 / 100) : 0);
                  }, 0);
                  const avgPct = villaColPct(v.id);
                  return (
                    <>
                      <td key={v.id+'a'} className="ef-mv-footer-num">
                        {totalVillaAlloc ? totalVillaAlloc.toLocaleString('vi-VN') : '—'}
                      </td>
                      <td key={v.id+'p'} className="ef-mv-footer-pct">~{avgPct}%</td>
                    </>
                  );
                })}
              </tr>
              {/* Per-row validation: each row's villa %s must sum to 100% */}
              {allSharedCats.map(cat => {
                const total = rowTotal(cat.id);
                const ok = total === 100;
                if (ok) return null;
                return (
                  <tr key={`warn-${cat.id}`} className="ef-mv-pct-total-row ef-mv-pct-total-row--warn">
                    <td colSpan={3} className="ef-mv-footer-lbl" style={{ fontSize:'.68rem' }}>
                      ⚠️ {cat.name}: tổng = {total}% (cần 100%)
                    </td>
                    {allVillas.map(v => (
                      <>
                        <td key={v.id+'a'}></td>
                        <td key={v.id+'p'} className="ef-mv-pct-total-cell">
                          {villaAllocPcts[`${v.id}_${cat.id}`] ?? 0}%
                        </td>
                      </>
                    ))}
                  </tr>
                );
              })}
            </tfoot>
          </table>
        </div>
      </div>

      {/* ══ SECTION 4: TỔNG KẾT ══ */}
      <div className="ef-card ef-summary ef-summary--full">
          <div className="ef-summary-hd">TỔNG KẾT THÁNG {report.month}/{report.year}</div>
          <div className="ef-formula">
            <div className="ef-formula-item">
              <div className="ef-formula-lbl">① Tổng doanh thu</div>
              <div className="ef-formula-val ef-formula-val--rev">{money(totalRev)}</div>
            </div>
            <div className="ef-formula-op">−</div>
            <div className="ef-formula-item">
              <div className="ef-formula-lbl">② Tổng chi phí riêng</div>
              <div className="ef-formula-val ef-formula-val--exp">{money(totalPvExp)}</div>
            </div>
            <div className="ef-formula-op">−</div>
            <div className="ef-formula-item">
              <div className="ef-formula-lbl">③ Chi phí chung (phân bổ)</div>
              <div className="ef-formula-val ef-formula-val--shared">{money(allocShared)}</div>
            </div>
            <div className="ef-formula-op">=</div>
            <div className={`ef-formula-result${netProfit < 0 ? ' negative' : ''}`}>
              <div className="ef-formula-lbl">LỢI NHUẬN ƯỚC TÍNH</div>
              <div className="ef-formula-big">{money(Math.abs(netProfit))}</div>
            </div>
          </div>
      </div>

      {/* ══ SECTION 5: HƯỚNG DẪN ══ */}
      <div className="ef-card ef-guide ef-guide--full">
          <div className="ef-guide-hd">📋 HƯỚNG DẪN NHANH</div>
          <div className="ef-guide-grid">
          {[
            { icon:'☁️', step:'Bước 1', title:'Dữ liệu tự động',
              text:'VillaOS tự lấy doanh thu từ hệ thống booking. Hiển thị ở cột AUTO. Bạn có thể sửa nếu cần.' },
            { icon:'✏️', step:'Bước 2', title:'Bổ sung thủ công',
              text:'Nhập thêm các khoản thu chưa có trong hệ thống vào cột MANUAL.' },
            { icon:'🏠', step:'Bước 3', title:'Chi phí riêng villa',
              text:'Điện, nước, vệ sinh... là chi phí từng villa. Nhập theo từng nhóm.' },
            { icon:'🔗', step:'Bước 4', title:'Chi phí chung hệ thống',
              text:'Lương, hoa hồng... chia sẻ giữa các villa. Điều chỉnh % phân bổ theo từng khoản.' },
            { icon:'💾', step:'Bước 5', title:'Lưu dữ liệu',
              text:'Nhấn "Lưu dữ liệu" để cập nhật vào báo cáo tháng và dashboard ngay lập tức.' },
          ].map((s, i) => (
            <div key={i} className="ef-guide-item">
              <div className="ef-guide-icon">{s.icon}</div>
              <div className="ef-guide-step-badge"><span>{s.step}</span></div>
              <div className="ef-guide-title">{s.title}</div>
              <div className="ef-guide-text">{s.text}</div>
            </div>
          ))}
          </div>
      </div>

      {/* ── Footer ── */}
      <div className="ef-footer">
        <button className="ef-btn ef-btn--copy" onClick={onCopyPrevMonth}>
          📋 Sao chép từ tháng trước
        </button>
        <div className="ef-footer-r">
          <button className="ef-btn ef-btn--ghost">Hủy</button>
          <button className="ef-btn ef-btn--reset" onClick={() => {
            setVA(initMap([...manualRev,...pvExp]));
            setSA(initMap(sharedExp));
            setER([{label:'',amount:0},{label:'',amount:0},{label:'',amount:0}]);
          }}>Reset</button>
          <button className="ef-btn ef-btn--save" disabled={saving} onClick={handleSave}>
            {saving ? '⏳ Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu dữ liệu'}
          </button>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
const CSS = `
.ef {
  --rev:         #0A6B44;
  --rev-lt:      #EBF7F2;
  --rev-bd:      #9FD9BF;
  --exp:         #B45309;
  --exp-lt:      #FEF3E2;
  --exp-bd:      #F59E0B;
  --shared:      #1A3A6B;
  --shared-lt:   #EAF0FB;
  --shared-bd:   #AABFE8;
  --danger:      #B94C2A;
  --muted:       #64748B;
  --border:      rgba(0,0,0,.08);
  --bg:          #F8FAFC;
  --surface:     #fff;
  --text:        #1A202C;
  --radius:      12px;
  --shadow:      0 1px 4px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.05);

  display: flex; flex-direction: column; gap: 14px;
  font-family: 'Be Vietnam Pro','Inter',system-ui,sans-serif;
  font-size: .84rem; color: var(--text);
}

/* ── Banner ── */
.ef-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-wrap: wrap;
  background: linear-gradient(135deg,rgba(14,109,209,.06),rgba(14,109,209,.03));
  border: 1px solid rgba(14,109,209,.2);
  border-radius: var(--radius); padding: 14px 18px;
}
.ef-banner-left { display: flex; gap: 12px; align-items: flex-start; }
.ef-banner-icon { font-size: 1.5rem; line-height: 1; }
.ef-banner-title { font-weight: 700; font-size: .85rem; color: #1E40AF; margin-bottom: 3px; }
.ef-banner-badge {
  display: inline-block; font-size: .65rem; font-weight: 600;
  background: rgba(14,109,209,.15); color: #1D4ED8; border-radius: 99px;
  padding: 1px 8px; margin-left: 6px; letter-spacing: .03em;
}
.ef-banner-sub { font-size: .76rem; color: #3B5998; line-height: 1.5; }
.ef-banner-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.ef-banner-time { font-size: .74rem; color: #64748B; }
.ef-refresh-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(14,109,209,.25); background: #fff;
  color: #1D4ED8; font-size: 1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .2s;
}
.ef-refresh-btn:hover { background: rgba(14,109,209,.08); }
.ef-refresh-btn.spinning { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ef-banner-hint {
  font-size: .74rem; color: #64748B;
  background: rgba(0,0,0,.04); border-radius: 6px; padding: 3px 10px;
}
.ef-banner-hint kbd {
  background: #1A202C; color: #fff; border-radius: 4px;
  padding: 1px 5px; font-size: .7rem;
}

/* ef-top-grid and ef-bot-grid removed — sections are now full-width stacked rows */

/* Summary — full width, bold highlight */
.ef-summary-guide-row { display: flex; flex-direction: column; gap: 14px; }
.ef-summary--full {
  border-top: 4px solid var(--rev) !important;
}
.ef-guide--full {
  border-top: 4px solid var(--shared) !important;
}

/* ── Cards ── */
.ef-card {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden;
}
.ef-card-hd {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; font-size: .88rem; font-weight: 800;
  letter-spacing: .09em; border-bottom: 1px solid var(--border);
}
.ef-card-num {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: .75rem; font-weight: 800;
}
.ef-card-hd--rev    { background: var(--rev-lt);    color: var(--rev);    }
.ef-card-num--rev   { background: var(--rev);    color: #fff; }
.ef-card-hd--exp    { background: var(--exp-lt);    color: var(--exp);    }
.ef-card-num--exp   { background: var(--exp);    color: #fff; }
.ef-card-hd--shared { background: var(--shared-lt); color: var(--shared); }
.ef-card-num--shared{ background: var(--shared); color: #fff; }
.ef-shared-lock {
  margin-left: auto; font-size: .68rem; font-weight: 500;
  background: rgba(26,58,107,.1); border-radius: 99px;
  padding: 2px 10px; letter-spacing: .02em;
}

/* ── Revenue grid ── */
.ef-rev-grid { display: grid; grid-template-columns: 1fr 1fr; }
.ef-rev-col { border-right: 1px solid var(--border); }
.ef-rev-col:last-child { border-right: none; }
.ef-rev-col--manual { background: rgba(217,119,6,.02); }

/* ── Column tag ── */
.ef-col-tag {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; font-size: .68rem; font-weight: 700;
  letter-spacing: .1em; border-bottom: 1px solid var(--border);
}
.ef-col-tag-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ef-col-tag--auto   { color: var(--rev); background: rgba(10,107,68,.04); }
.ef-col-tag--auto .ef-col-tag-dot { background: var(--rev); }
.ef-col-tag--manual { color: var(--exp); background: rgba(180,83,9,.04); }
.ef-col-tag--manual .ef-col-tag-dot { background: var(--exp); }

/* ── Table ── */
.ef-tbl-head {
  display: flex; justify-content: space-between;
  padding: 5px 12px; font-size: .66rem; font-weight: 600;
  color: var(--muted); background: rgba(0,0,0,.02);
  border-bottom: 1px solid var(--border);
}
.ef-tbl-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 12px; border-bottom: 1px solid rgba(0,0,0,.04); gap: 6px; min-width: 0;
}
.ef-tbl-row:last-of-type { border-bottom: none; }
.ef-tbl-row--auto   { background: rgba(0,0,0,.01); }
.ef-tbl-row--extra  { gap: 6px; }
.ef-tbl-name { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; font-size: .79rem; overflow: hidden; }
.ef-tbl-fixed {
  font-family: Georgia,serif; font-style: italic;
  font-size: .84rem; color: var(--text); white-space: nowrap;
  min-width: 80px; text-align: right;
}

/* Brand icon */
.ef-brand {
  width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: .6rem; font-weight: 800; letter-spacing: -.02em;
}
.ef-icon { font-size: 1rem; line-height: 1; flex-shrink: 0; }
.ef-auto-badge {
  font-size: .6rem; background: var(--rev-lt); color: var(--rev);
  border-radius: 4px; padding: 1px 5px; font-weight: 600;
  border: 1px solid var(--rev-bd); margin-left: 3px;
}

/* Column subtotal */
.ef-col-subtotal {
  display: flex; justify-content: space-between;
  padding: 9px 14px; font-size: .76rem; font-weight: 700;
  border-top: 1px solid var(--border); background: rgba(0,0,0,.02);
}
.ef-col-subtotal--rev  { color: var(--rev);  }
.ef-col-subtotal--manual { color: var(--exp); }

/* Big total */
.ef-big-total {
  display: flex; justify-content: space-between; align-items: center;
  padding: 13px 16px; font-size: .76rem; font-weight: 800;
  letter-spacing: .05em; border-top: 2px solid;
}
.ef-big-total--rev { border-color: var(--rev-bd); background: var(--rev-lt); color: var(--rev); }
.ef-big-total--exp { border-color: var(--exp-bd); background: var(--exp-lt); color: var(--exp); }
.ef-big-total-val {
  font-family: Georgia,serif; font-style: italic;
  font-size: 1.05rem; letter-spacing: 0;
}

/* Extra row inputs */
.ef-extra-lbl {
  flex: 1; border: 1px solid var(--border); border-radius: 7px;
  padding: 5px 8px; font-size: .78rem; color: var(--text);
  background: rgba(0,0,0,.02); outline: none; min-width: 0;
  font-family: inherit;
}
.ef-extra-lbl:focus { border-color: var(--exp); background: #fff; }
.ef-add-btn {
  width: 100%; padding: 8px; border: 1px dashed rgba(0,0,0,.15);
  background: transparent; font-size: .76rem; color: var(--muted);
  cursor: pointer; font-family: inherit; transition: all .15s;
}
.ef-add-btn:hover { background: rgba(0,0,0,.03); color: var(--text); }

/* ── Expense grid ── */
.ef-exp-grid { display: grid; }
.ef-exp-grid--1 { grid-template-columns: 1fr; }
.ef-exp-grid--2 { grid-template-columns: 1fr 1fr; }
.ef-exp-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
.ef-exp-col { border-right: 1px solid var(--border); }
.ef-exp-col:last-child { border-right: none; }
.ef-exp-col-hd {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 14px; font-size: .68rem; font-weight: 800;
  letter-spacing: .07em;
}

/* ── Smart input ── */
.ef-inp {
  display: flex; align-items: center; gap: 3px;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 4px 7px; background: rgba(0,0,0,.025);
  transition: all .15s; min-width: 0; flex-shrink: 0;
}
.ef-inp--focus { border-color: #3B82F6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.ef-inp input {
  border: none; background: transparent; font-size: .8rem;
  color: var(--text); width: 80px; text-align: right; outline: none; min-width: 0;
  font-family: inherit;
}
.ef-inp-unit { font-size: .65rem; color: #94A3B8; flex-shrink: 0; }

/* ── Shared section ── */
/* ── Multi-villa shared cost table ── */
.ef-mv-wrap { overflow-x: auto; }
.ef-mv-tbl {
  width: 100%; border-collapse: collapse;
  font-size: .79rem; min-width: 700px;
}

/* Header rows */
.ef-mv-hdr-row th, .ef-mv-sub-row th {
  padding: 0; border: 1px solid rgba(26,58,107,.15);
  text-align: center; white-space: nowrap;
}
.ef-mv-th {
  font-size: .7rem; font-weight: 800; letter-spacing: .06em;
  padding: 9px 12px; text-transform: uppercase;
}
.ef-mv-th--name {
  background: #1A3A6B; color: #fff;
  text-align: left; min-width: 180px; max-width: 220px;
}
.ef-mv-th--all {
  background: #2D4A7A; color: #fff;
  border-left: 2px solid rgba(255,255,255,.25);
}
.ef-mv-th--villa {
  background: #374151; color: #fff;
  border-left: 2px solid rgba(255,255,255,.2);
}
/* % allocation validation bar */
.ef-alloc-bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 16px; border-bottom: 1px solid var(--border);
  font-size: .78rem;
}
.ef-alloc-bar--ok  { background: rgba(10,107,68,.05); }
.ef-alloc-bar--warn { background: rgba(185,76,42,.05); }
.ef-alloc-bar-label { flex-shrink: 0; }
.ef-alloc-bar-hint { color: #B45309; font-weight: 500; }
.ef-alloc-bar-track {
  flex: 1; height: 8px; border-radius: 4px;
  background: rgba(0,0,0,.08); display: flex; overflow: hidden; min-width: 80px;
}
.ef-alloc-bar-seg { height: 100%; transition: width .2s; }

/* % total check row in tfoot */
.ef-mv-pct-total-row { background: #0F2A50; }
.ef-mv-pct-total-row td { padding: 6px 10px; border: 1px solid rgba(255,255,255,.1); }
.ef-mv-pct-total-row--ok .ef-mv-pct-total-cell { color: #6EE7B7; font-weight: 700; }
.ef-mv-pct-total-row--warn .ef-mv-pct-total-cell { color: #FCA5A5; font-weight: 700; }
.ef-mv-pct-total-cell { text-align: center; font-size: .75rem; }

/* warn state on pct input */
.ef-pct-input--warn { border-color: #F59E0B !important; background: #FFFBEB !important; }

/* Alternate villa header colors */
.ef-mv-th--v0 { background: #3B5998; }
.ef-mv-th--v1 { background: #2D6A4F; }
.ef-mv-th--v2 { background: #92400E; }
.ef-mv-th--v3 { background: #6D28D9; }
.ef-mv-th--v4 { background: #B91C1C; }

/* Sub-headers */
.ef-mv-sub-row { background: #F1F5F9; }
.ef-mv-sub {
  font-size: .62rem; font-weight: 700; letter-spacing: .05em;
  color: #374151; padding: 6px 10px;
  background: #EEF2F7;
}
.ef-mv-sub--100, .ef-mv-sub--pct {
  background: #E8EDF5; color: #1A3A6B;
}

/* Body rows */
.ef-mv-row { border-bottom: 1px solid rgba(0,0,0,.06); transition: background .1s; }
.ef-mv-row:hover { background: rgba(26,58,107,.025); }
.ef-mv-row--auto { background: rgba(0,0,0,.012); }
.ef-mv-row td { padding: 7px 10px; border: 1px solid rgba(0,0,0,.06); vertical-align: middle; }

/* Name cell */
.ef-mv-td-name {
  display: flex; align-items: center; gap: 6px;
  min-width: 180px; max-width: 220px;
  font-size: .78rem; color: #1A202C;
}
.ef-mv-cat-icon { font-size: .9rem; flex-shrink: 0; }

/* ALL column: editable input */
.ef-mv-td-input { text-align: right; min-width: 120px; }
.ef-mv-num { font-family: Georgia,serif; font-style: italic; color: #1A202C; }

/* 100% cell */
.ef-mv-td-100 {
  text-align: center; font-size: .7rem; font-weight: 700;
  color: #6B7280; background: rgba(0,0,0,.02);
  width: 44px;
}

/* Villa alloc amount */
.ef-mv-td-alloc {
  text-align: right; min-width: 110px;
  font-family: Georgia,serif; font-style: italic;
  color: #1A3A6B; font-weight: 600; font-size: .79rem;
}

/* Villa % input cell */
.ef-mv-td-pct-edit { text-align: center; width: 72px; padding: 4px 6px !important; }
.ef-pct-input-wrap {
  display: flex; align-items: center; justify-content: center; gap: 2px;
}
.ef-pct-input {
  width: 38px; padding: 3px 4px; text-align: right;
  border: 1.5px solid rgba(26,58,107,.25); border-radius: 5px;
  font-size: .78rem; font-weight: 700; color: #1A3A6B;
  font-family: inherit; background: #fff;
  transition: border-color .15s;
  /* hide number spinners */
  -moz-appearance: textfield;
}
.ef-pct-input::-webkit-outer-spin-button,
.ef-pct-input::-webkit-inner-spin-button { -webkit-appearance: none; }
.ef-pct-input:focus { outline: none; border-color: #1A3A6B; background: #EAF0FB; }
.ef-pct-sym { font-size: .72rem; font-weight: 700; color: #1A3A6B; }

/* Footer */
.ef-mv-footer-row { background: #1A3A6B; }
.ef-mv-footer-row td {
  padding: 9px 10px; border: 1px solid rgba(255,255,255,.12);
  font-weight: 700; color: #fff;
}
.ef-mv-footer-lbl { font-size: .75rem; letter-spacing: .07em; min-width: 180px; }
.ef-mv-footer-num {
  text-align: right; font-family: Georgia,serif; font-style: italic;
  font-size: .82rem; min-width: 110px;
}
.ef-mv-footer-100, .ef-mv-footer-pct {
  text-align: center; font-size: .72rem; opacity: .8;
  width: 44px;
}

/* Shared info */
.ef-shared-info {
  padding: 14px; display: flex; flex-direction: column;
  gap: 10px; justify-content: space-between;
  background: rgba(14,109,209,.02);
}
.ef-info-list { display: flex; flex-direction: column; gap: 8px; }
.ef-info-item { display: flex; gap: 7px; font-size: .74rem; color: #475569; line-height: 1.55; }
.ef-info-i {
  width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
  background: rgba(14,109,209,.15); color: #1D4ED8;
  font-size: .65rem; font-style: italic; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.ef-alloc-pill {
  background: rgba(10,107,68,.1); color: var(--rev);
  border-radius: 8px; padding: 8px 10px;
  font-size: .74rem; font-weight: 600; line-height: 1.6;
}

/* ── Right panel ── */
.ef-right { display: flex; flex-direction: column; gap: 14px; }

/* Summary */
.ef-summary {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden;
}
.ef-summary-hd {
  padding: 13px 18px; font-size: .78rem; font-weight: 900;
  letter-spacing: .1em; color: var(--rev);
  background: rgba(10,107,68,.06); border-bottom: 2px solid var(--rev-bd);
  display: flex; align-items: center; gap: 8px;
}
.ef-formula {
  display: flex; align-items: stretch; flex-wrap: wrap; gap: 0;
  padding: 14px 16px; background: rgba(10,107,68,.03);
}
.ef-formula-item {
  display: flex; flex-direction: column; justify-content: center;
  padding: 10px 16px; min-width: 130px; flex: 1;
  border-right: 1px solid rgba(0,0,0,.06);
}
.ef-formula-item:last-child { border-right: none; }
.ef-formula-lbl { font-size: .64rem; font-weight: 700; color: var(--muted); letter-spacing: .06em; margin-bottom: 5px; text-transform: uppercase; }
.ef-formula-val { font-family: Georgia,serif; font-style: italic; font-size: 1.05rem; font-weight: 700; }
.ef-formula-val--rev    { color: var(--rev); }
.ef-formula-val--exp    { color: var(--exp); }
.ef-formula-val--shared { color: var(--shared); }
.ef-formula-op {
  display: flex; align-items: center; justify-content: center;
  padding: 0 8px; font-size: 1.4rem; font-weight: 300; color: #CBD5E0;
  flex-shrink: 0; align-self: center;
}
.ef-formula-result {
  flex: 1.5; padding: 10px 20px;
  background: rgba(10,107,68,.08); border-left: 4px solid var(--rev) !important;
  display: flex; flex-direction: column; justify-content: center;
  border-right: none !important;
}
.ef-formula-result.negative { background: rgba(185,76,42,.08); border-left-color: var(--danger) !important; }
.ef-formula-big {
  font-family: Georgia,serif; font-style: italic; font-size: 1.45rem;
  font-weight: 800; color: var(--rev); margin-top: 4px;
}
.ef-formula-result.negative .ef-formula-big { color: var(--danger); }

/* Guide */
.ef-guide {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden;
}
.ef-guide--full { }
.ef-guide-hd {
  padding: 13px 18px; font-size: .78rem; font-weight: 900;
  letter-spacing: .1em; color: var(--shared);
  background: var(--shared-lt); border-bottom: 2px solid var(--shared-bd);
}
/* Horizontal 5-column grid for guide steps */
.ef-guide-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  padding: 0;
}
.ef-guide-item {
  display: flex; flex-direction: column; gap: 6px;
  padding: 16px 16px 18px;
  border-right: 1px solid rgba(0,0,0,.06);
  font-size: .78rem; line-height: 1.5;
}
.ef-guide-item:last-child { border-right: none; }
.ef-guide-icon { font-size: 1.4rem; }
.ef-guide-step-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .62rem; font-weight: 800; color: var(--shared);
  text-transform: uppercase; letter-spacing: .06em;
}
.ef-guide-title {
  font-size: .8rem; font-weight: 700; color: var(--text);
}
.ef-guide-text { color: #475569; font-size: .75rem; }
.ef-guide-cta {
  width: 100%; padding: 10px;
  background: var(--shared-lt); border: none; border-top: 1px solid var(--shared-bd);
  color: var(--shared); font-size: .78rem;
  font-weight: 600; font-family: inherit; cursor: pointer;
  transition: all .15s;
}
.ef-guide-cta:hover { background: rgba(26,58,107,.12); }

/* Empty hint */
.ef-empty-hint {
  padding: 20px 16px; text-align: center;
  font-size: .8rem; color: var(--muted);
  border: 1px dashed rgba(0,0,0,.1); border-radius: 8px; margin: 12px;
}

/* ── Footer ── */
.ef-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 0 2px; border-top: 1px solid var(--border); gap: 8px; flex-wrap: wrap;
}
.ef-footer-r { display: flex; gap: 8px; align-items: center; }
.ef-btn {
  padding: 8px 16px; border-radius: 99px; font-size: .82rem;
  font-family: inherit; cursor: pointer; transition: all .15s;
  font-weight: 500; white-space: nowrap; border: 1px solid transparent;
}
.ef-btn--copy  { color: #475569; border-color: var(--border); background: #fff; }
.ef-btn--copy:hover  { background: rgba(0,0,0,.04); }
.ef-btn--ghost { color: var(--muted); background: transparent; border-color: transparent; }
.ef-btn--reset { color: var(--exp); border-color: rgba(180,83,9,.25); background: rgba(180,83,9,.05); }
.ef-btn--reset:hover { background: rgba(180,83,9,.12); }
.ef-btn--save  { color: #fff; background: var(--shared); border-color: transparent; font-weight: 700; padding: 10px 24px; font-size: .85rem; }
.ef-btn--save:hover:not(:disabled) { opacity: .88; }
.ef-btn--save:disabled { opacity: .6; cursor: not-allowed; }

/* Responsive */
@media (max-width: 900px) {
  .ef-summary-guide-row { flex-direction: column; }
  .ef-guide-grid { grid-template-columns: 1fr 1fr !important; }
  .ef-rev-grid  { grid-template-columns: 1fr; }
  .ef-exp-grid  { grid-template-columns: 1fr !important; }
  .ef-mv-tbl { min-width: 500px; font-size: .72rem; }
  .ef-shared-thead,
  .ef-shared-row,
  .ef-shared-subtotal { grid-template-columns: 1.6fr 1fr 1fr; }
  .ef-shared-thead span:last-child,
  .ef-shared-row   > :last-child,
  .ef-shared-subtotal > :last-child { display: none; }
}
`;
