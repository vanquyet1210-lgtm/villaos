'use client';
// VillaOS v7 — app/owner/report/EntryForm.tsx  [v3 — Full Redesign]

import { useState, useCallback, useEffect } from 'react';
import type { MonthlyReport, ReportCategoryWithEntry } from '@/types/report';

export interface SaveEntry {
  categoryId: string;
  amount:     number;
  note?:      string;
  isShared?:  boolean;
}

interface Props {
  report:           MonthlyReport;
  onSave:           (entries: SaveEntry[]) => Promise<void>;
  onCopyPrevMonth?: () => void;
  villaName?:       string;
  villaCount?:      number;
}

// ─────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────

const MONTHS = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

/** Locale-formatted Vietnamese money */
function fmtVND(n: number) {
  if (!n) return '0 đ';
  return n.toLocaleString('vi-VN') + ' đ';
}

/** Compact: 203.000.000 → 203 tr */
function fmtCompact(n: number) {
  if (!n) return '0 đ';
  if (Math.abs(n) >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr đ';
  if (Math.abs(n) >= 1_000)
    return (n / 1_000).toFixed(0) + 'k đ';
  return n.toLocaleString('vi-VN') + ' đ';
}

function parseRaw(s: string): number {
  return parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
}

function nowStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
    + `/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────
// AmountInput — clean controlled input with locale format
// ─────────────────────────────────────────────────────────────

function AmountInput({
  id, value, onChange, placeholder = 'Nhập số tiền', readOnly = false,
  accentColor = '#0A8A55',
}: {
  id?: string; value: number; onChange: (v: number) => void;
  placeholder?: string; readOnly?: boolean; accentColor?: string;
}) {
  const [isFocused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  const displayed = isFocused ? raw : (value ? value.toLocaleString('vi-VN') : '');

  return (
    <div
      className="ef-input-cell"
      style={{ '--acc': accentColor } as React.CSSProperties}
      data-focused={isFocused || undefined}
      data-has-value={value > 0 || undefined}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        readOnly={readOnly}
        placeholder={placeholder}
        value={displayed}
        onFocus={() => { setFocused(true); setRaw(value ? String(value) : ''); }}
        onBlur={() => { setFocused(false); onChange(parseRaw(raw)); }}
        onChange={e => setRaw(e.target.value.replace(/[^\d]/g, ''))}
      />
      <span className="ef-unit">đ</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SectionCard — collapsible wrapper with color token
// ─────────────────────────────────────────────────────────────

function SectionCard({
  num, title, sub, accent, children, defaultOpen = true,
}: {
  num?: string; title: string; sub?: string; accent: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ef-card" style={{ '--card-accent': accent } as React.CSSProperties}>
      <button className="ef-card-header" onClick={() => setOpen(o => !o)}>
        <div className="ef-card-title-row">
          {num && <span className="ef-card-num">{num}</span>}
          <span className="ef-card-title">{title}</span>
          {sub && <span className="ef-card-sub">{sub}</span>}
        </div>
        <span className="ef-card-chevron" data-open={open}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="ef-card-body">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function EntryForm({
  report, onSave, onCopyPrevMonth, villaName = 'Villa', villaCount = 4,
}: Props) {

  // ── Seed amounts from report data ──────────────────────────
  const buildInit = () => {
    const m: Record<string, number> = {};
    [...report.revenue, ...report.expenses].forEach(c => { m[c.id] = c.amount; });
    return m;
  };

  const [amounts,    setAmounts]    = useState<Record<string, number>>(buildInit);
  const [lastSync,   setLastSync]   = useState(nowStr);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [showGuide,  setShowGuide]  = useState(true);

  // Extra manual revenue rows (editable label + amount)
  const [extraRows, setExtraRows] = useState([
    { id: 'x1', label: 'Doanh thu khác 1', amount: 0 },
    { id: 'x2', label: 'Doanh thu khác 2', amount: 0 },
    { id: 'x3', label: 'Doanh thu khác 3', amount: 0 },
  ]);

  // Fixed shared-cost demo rows (simulate staff costs)
  const sharedRows = [
    { label: 'Lương nhân viên',  icon: '👤', total: 120_000_000 },
    { label: 'Lễ tân',           icon: '🧑‍💼', total:  60_000_000 },
    { label: 'Quản lý',          icon: '👔', total:  60_000_000 },
    { label: 'Bảo trì',          icon: '🔧', total:  40_000_000 },
  ];
  const allocPct     = villaCount > 0 ? Math.round(100 / villaCount) : 10;
  const totalShared  = sharedRows.reduce((s, r) => s + r.total, 0);
  const totalSharedAlloc = Math.round(totalShared * allocPct / 100);

  // ── Helpers ────────────────────────────────────────────────
  const set = useCallback((id: string, v: number) =>
    setAmounts(prev => ({ ...prev, [id]: v })), []);

  const setExtra = (id: string, v: number) =>
    setExtraRows(prev => prev.map(r => r.id === id ? { ...r, amount: v } : r));

  const setExtraLabel = (id: string, l: string) =>
    setExtraRows(prev => prev.map(r => r.id === id ? { ...r, label: l } : r));

  const addExtraRow = () =>
    setExtraRows(prev => [
      ...prev,
      { id: `x${Date.now()}`, label: `Doanh thu khác ${prev.length + 1}`, amount: 0 },
    ]);

  const handleRefresh = () => setLastSync(nowStr());

  const handleReset = () => {
    setAmounts(buildInit());
    setExtraRows([
      { id: 'x1', label: 'Doanh thu khác 1', amount: 0 },
      { id: 'x2', label: 'Doanh thu khác 2', amount: 0 },
      { id: 'x3', label: 'Doanh thu khác 3', amount: 0 },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    const entries: SaveEntry[] = [
      ...Object.entries(amounts).map(([categoryId, amount]) => ({ categoryId, amount })),
    ];
    await onSave(entries);
    setSaving(false);
    setSaved(true);
    setLastSync(nowStr());
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Categorise revenue ─────────────────────────────────────
  const autoRev   = report.revenue.filter(c => c.isAuto);
  const manualRev = report.revenue.filter(c => !c.isAuto);

  // Demo auto revenue if empty (for design preview)
  const autoRevDisplay: Array<{ id: string; icon: string; name: string; amount: number; isReal?: boolean }> =
    autoRev.length > 0
      ? autoRev.map(c => ({ id: c.id, icon: c.icon, name: c.name, amount: amounts[c.id] ?? c.amount, isReal: true }))
      : [
          { id: 'd-agoda',   icon: '🅰️', name: 'Agoda',            amount: 70_000_000 },
          { id: 'd-booking', icon: '🔵', name: 'Booking.com',       amount: 65_000_000 },
          { id: 'd-airbnb',  icon: '🏠', name: 'Airbnb',            amount: 25_000_000 },
          { id: 'd-direct',  icon: '🧑‍💻', name: 'Khách trực tiếp', amount: 20_000_000 },
          { id: 'd-svc',     icon: '✨', name: 'Dịch vụ thêm',      amount: 15_000_000 },
          { id: 'd-tour',    icon: '🗺️', name: 'Tour / Vé / Trải nghiệm', amount: 5_000_000 },
          { id: 'd-car',     icon: '🚗', name: 'Xe đưa đón',        amount: 3_000_000 },
        ];

  // ── Categorise expenses ────────────────────────────────────
  const getCat = (group: string) => report.expenses.filter(c => c.groupName === group);

  // Vận hành items — merge real categories + always-show items
  const vanHanhCats  = getCat('Vận hành');
  const fixedVH = [
    { icon: '⚡', name: 'Điện',           key: 'vh-dien' },
    { icon: '💧', name: 'Nước',           key: 'vh-nuoc' },
    { icon: '📶', name: 'Internet',       key: 'vh-internet' },
    { icon: '🧹', name: 'Vệ sinh',        key: 'vh-vesinh' },
    { icon: '🔩', name: 'Vật tư tiêu hao', key: 'vh-vattu' },
    { icon: '🔨', name: 'Bảo trì, sửa chữa', key: 'vh-baotri' },
    { icon: '📦', name: 'Khác',           key: 'vh-khac' },
  ];

  const taiChinhItems = [
    { icon: '🏢', name: 'Thuê mặt bằng',  key: 'tc-mb' },
    { icon: '🏦', name: 'Trả ngân hàng',  key: 'tc-nh' },
    { icon: '📋', name: 'Thuế GTGT',      key: 'tc-gtgt' },
    { icon: '📋', name: 'Thuế TNDN',      key: 'tc-tndn' },
    { icon: '📋', name: 'Thuế khác',      key: 'tc-tk' },
  ];

  const khacItems = [
    { icon: '📣', name: 'Marketing',       key: 'kh-mkt' },
    { icon: '📁', name: 'Văn phòng phẩm',  key: 'kh-vpp' },
    { icon: '🛎️', name: 'Phí dịch vụ',    key: 'kh-pdv' },
    { icon: '💳', name: 'Phí ngân hàng',   key: 'kh-pnh' },
    { icon: '➕', name: 'Khác',            key: 'kh-kh' },
  ];

  // amounts for plain (non-category) rows stored in local state
  const [vhAmounts,  setVhAmounts]  = useState<Record<string, number>>({});
  const [tcAmounts,  setTcAmounts]  = useState<Record<string, number>>({});
  const [othAmounts, setOthAmounts] = useState<Record<string, number>>({});

  const setVH  = (k: string, v: number) => setVhAmounts(p  => ({ ...p, [k]: v }));
  const setTC  = (k: string, v: number) => setTcAmounts(p  => ({ ...p, [k]: v }));
  const setOth = (k: string, v: number) => setOthAmounts(p => ({ ...p, [k]: v }));

  // ── Totals ─────────────────────────────────────────────────
  const totalAutoRev = autoRevDisplay.reduce((s, r) =>
    s + (r.isReal ? (amounts[r.id] ?? r.amount) : r.amount), 0);

  const totalManualRev = manualRev.reduce((s, c) => s + (amounts[c.id] ?? 0), 0)
    + extraRows.reduce((s, r) => s + r.amount, 0);

  const totalRevenue = totalAutoRev + totalManualRev;

  const totalVH = Object.values(vhAmounts).reduce((s, v) => s + v, 0)
    + vanHanhCats.reduce((s, c) => s + (amounts[c.id] ?? 0), 0);

  const totalTC = Object.values(tcAmounts).reduce((s, v) => s + v, 0)
    + getCat('Cố định').reduce((s, c) => s + (amounts[c.id] ?? 0), 0);

  const totalOth = Object.values(othAmounts).reduce((s, v) => s + v, 0);

  const totalVillaExp = totalVH + totalTC + totalOth;
  const netProfit     = totalRevenue - totalVillaExp - totalSharedAlloc;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="ef">

      {/* ══════════════════════════════════════════════════════
          BANNER
      ══════════════════════════════════════════════════════ */}
      <div className="ef-banner">
        <div className="ef-banner-l">
          <div className="ef-banner-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-3.26-8.82A4.5 4.5 0 0 0 3 15"/>
            </svg>
          </div>
          <div>
            <div className="ef-banner-title">Dữ liệu tự động lấy từ hệ thống <span className="ef-banner-note">(có thể chỉnh sửa)</span></div>
            <div className="ef-banner-desc">Các khoản dưới đây được đồng bộ tự động. Bạn có thể chỉnh sửa nếu cần.</div>
          </div>
        </div>
        <div className="ef-banner-r">
          <span className="ef-banner-time">Cập nhật lần cuối: {lastSync}</span>
          <button className="ef-refresh-btn" onClick={handleRefresh} title="Làm mới dữ liệu">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
            Làm mới
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — NHẬP DOANH THU
      ══════════════════════════════════════════════════════ */}
      <SectionCard num="1." title="NHẬP DOANH THU" accent="#0A8A55">
        <div className="ef-rev-grid">

          {/* ── AUTO panel ── */}
          <div className="ef-panel">
            <div className="ef-panel-head ef-panel-head--auto">
              <span className="ef-panel-head-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 3v1m0 16v1M4.22 4.22l.7.7m14.14 14.14.7.7M3 12h1m16 0h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
              </span>
              <span>Tự động <em>(có thể chỉnh sửa)</em></span>
              <span className="ef-pill ef-pill--auto">AUTO</span>
            </div>
            <div className="ef-table-head">
              <span>Nguồn doanh thu</span>
              <span>Số tiền (đ)</span>
            </div>
            {autoRevDisplay.map(r => (
              <div key={r.id} className="ef-row ef-row--auto">
                <label className="ef-label" htmlFor={`ar-${r.id}`}>
                  <span className="ef-row-ico">{r.icon}</span>
                  {r.name}
                </label>
                {r.isReal ? (
                  <AmountInput
                    id={`ar-${r.id}`}
                    value={amounts[r.id] ?? r.amount}
                    onChange={v => set(r.id, v)}
                    accentColor="#0A8A55"
                  />
                ) : (
                  <div className="ef-static-amt">{fmtVND(r.amount)}</div>
                )}
              </div>
            ))}
            <div className="ef-panel-total ef-panel-total--green">
              <span>Tổng doanh thu (tự động)</span>
              <span>{fmtVND(totalAutoRev)}</span>
            </div>
          </div>

          {/* ── MANUAL panel ── */}
          <div className="ef-panel">
            <div className="ef-panel-head ef-panel-head--manual">
              <span className="ef-panel-head-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                </svg>
              </span>
              <span>Nhập tay <em>(bổ sung)</em></span>
              <span className="ef-pill ef-pill--manual">MANUAL</span>
            </div>
            <div className="ef-table-head">
              <span>Nguồn doanh thu</span>
              <span>Số tiền (đ)</span>
            </div>
            {manualRev.map(c => (
              <div key={c.id} className="ef-row">
                <label className="ef-label" htmlFor={`mr-${c.id}`}>
                  <span className="ef-row-ico">{c.icon}</span>
                  {c.name}
                </label>
                <AmountInput
                  id={`mr-${c.id}`}
                  value={amounts[c.id] ?? 0}
                  onChange={v => set(c.id, v)}
                  accentColor="#0A8A55"
                />
              </div>
            ))}
            {extraRows.map(r => (
              <div key={r.id} className="ef-row ef-row--extra">
                <input
                  className="ef-label-edit"
                  value={r.label}
                  onChange={e => setExtraLabel(r.id, e.target.value)}
                />
                <AmountInput
                  value={r.amount}
                  onChange={v => setExtra(r.id, v)}
                  accentColor="#0A8A55"
                />
              </div>
            ))}
            <button className="ef-add-row-btn" onClick={addExtraRow}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Thêm dòng
            </button>
            <div className="ef-panel-total ef-panel-total--green">
              <span>Tổng doanh thu (nhập tay)</span>
              <span>{fmtVND(totalManualRev)}</span>
            </div>
          </div>
        </div>

        {/* Grand total revenue */}
        <div className="ef-grand-rev">
          <span>TỔNG DOANH THU (TỰ ĐỘNG + NHẬP TAY)</span>
          <span className="ef-grand-num">{fmtVND(totalRevenue)}</span>
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — CHI PHÍ RIÊNG
      ══════════════════════════════════════════════════════ */}
      <SectionCard num="2." title="NHẬP CHI PHÍ RIÊNG" sub="(THEO VILLA)" accent="#D97706">
        <div className="ef-exp-grid">

          {/* 2.1 Vận hành */}
          <div className="ef-exp-col ef-exp-col--op">
            <div className="ef-exp-col-head">
              <span className="ef-exp-col-ico">🔥</span>
              <span>2.1 CHI PHÍ VẬN HÀNH</span>
            </div>
            <div className="ef-table-head ef-table-head--sm">
              <span>Khoản chi</span>
              <span>Số tiền (đ)</span>
            </div>
            {fixedVH.map(r => (
              <div key={r.key} className="ef-row ef-row--sm">
                <label className="ef-label ef-label--sm" htmlFor={r.key}>
                  <span className="ef-row-ico ef-row-ico--sm">{r.icon}</span>
                  {r.name}
                </label>
                <AmountInput
                  id={r.key}
                  value={vhAmounts[r.key] ?? 0}
                  onChange={v => setVH(r.key, v)}
                  accentColor="#D97706"
                />
              </div>
            ))}
            {/* Also show real categories in this group */}
            {vanHanhCats.filter(c => !fixedVH.some(f => f.name === c.name)).map(c => (
              <div key={c.id} className="ef-row ef-row--sm">
                <label className="ef-label ef-label--sm" htmlFor={`vh-${c.id}`}>
                  <span className="ef-row-ico ef-row-ico--sm">{c.icon}</span>
                  {c.name}
                </label>
                <AmountInput
                  id={`vh-${c.id}`}
                  value={amounts[c.id] ?? 0}
                  onChange={v => set(c.id, v)}
                  accentColor="#D97706"
                />
              </div>
            ))}
            <div className="ef-exp-total ef-exp-total--op">
              <span>Tổng vận hành</span>
              <span>{fmtVND(totalVH)}</span>
            </div>
          </div>

          {/* 2.2 Tài chính */}
          <div className="ef-exp-col ef-exp-col--fin">
            <div className="ef-exp-col-head">
              <span className="ef-exp-col-ico">🏦</span>
              <span>2.2 CHI PHÍ TÀI CHÍNH</span>
            </div>
            <div className="ef-table-head ef-table-head--sm">
              <span>Khoản chi</span>
              <span>Số tiền (đ)</span>
            </div>
            {taiChinhItems.map(r => (
              <div key={r.key} className="ef-row ef-row--sm">
                <label className="ef-label ef-label--sm" htmlFor={r.key}>
                  <span className="ef-row-ico ef-row-ico--sm">{r.icon}</span>
                  {r.name}
                </label>
                <AmountInput
                  id={r.key}
                  value={tcAmounts[r.key] ?? 0}
                  onChange={v => setTC(r.key, v)}
                  accentColor="#7C3AED"
                />
              </div>
            ))}
            <div className="ef-exp-total ef-exp-total--fin">
              <span>Tổng tài chính</span>
              <span>{fmtVND(totalTC)}</span>
            </div>
          </div>

          {/* 2.3 Khác */}
          <div className="ef-exp-col ef-exp-col--oth">
            <div className="ef-exp-col-head">
              <span className="ef-exp-col-ico">📦</span>
              <span>2.3 CHI PHÍ KHÁC</span>
            </div>
            <div className="ef-table-head ef-table-head--sm">
              <span>Khoản chi</span>
              <span>Số tiền (đ)</span>
            </div>
            {khacItems.map(r => (
              <div key={r.key} className="ef-row ef-row--sm">
                <label className="ef-label ef-label--sm" htmlFor={r.key}>
                  <span className="ef-row-ico ef-row-ico--sm">{r.icon}</span>
                  {r.name}
                </label>
                <AmountInput
                  id={r.key}
                  value={othAmounts[r.key] ?? 0}
                  onChange={v => setOth(r.key, v)}
                  accentColor="#0369A1"
                />
              </div>
            ))}
            <div className="ef-exp-total ef-exp-total--oth">
              <span>Tổng khác</span>
              <span>{fmtVND(totalOth)}</span>
            </div>
          </div>
        </div>

        {/* Villa expense grand total */}
        <div className="ef-grand-exp">
          <span>TỔNG CHI PHÍ RIÊNG (THEO VILLA)</span>
          <span className="ef-grand-num">{fmtVND(totalVillaExp)}</span>
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════
          BOTTOM GRID — Section 3 + Summary/Guide
      ══════════════════════════════════════════════════════ */}
      <div className="ef-bottom">

        {/* ── SECTION 3 — CHI PHÍ CHUNG ── */}
        <SectionCard num="3." title="CHI PHÍ CHUNG" sub="(TOÀN HỆ THỐNG)" accent="#0F766E">
          <div className="ef-shared-wrap">
            <div className="ef-shared-main">

              <div className="ef-shared-sub-head">
                <span>👥</span>
                <span>3.1 CHI PHÍ NHÂN SỰ (CHUNG)</span>
              </div>

              {/* Table header */}
              <div className="ef-shared-th">
                <span>Khoản chi</span>
                <span>Tổng hệ thống (đ)</span>
                <span>Phân bổ cho villa (đ)</span>
                <span>Tỷ lệ</span>
              </div>

              {sharedRows.map(r => (
                <div key={r.label} className="ef-shared-row">
                  <span className="ef-shared-name">
                    <span>{r.icon}</span>{r.label}
                  </span>
                  <span className="ef-shared-sys">{fmtVND(r.total)}</span>
                  <span className="ef-shared-alloc">{fmtVND(Math.round(r.total * allocPct / 100))}</span>
                  <span className="ef-shared-pct">{allocPct} %</span>
                </div>
              ))}

              <div className="ef-shared-total">
                <span>Tổng chi phí nhân sự (phân bổ)</span>
                <span />
                <span className="ef-shared-total-num">{fmtVND(totalSharedAlloc)}</span>
                <span />
              </div>

              <button className="ef-link-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
                </svg>
                Xem chi tiết chi phí chung
              </button>
            </div>

            {/* Info sidebar */}
            <div className="ef-shared-info">
              {[
                'Chi phí chung được <strong>phân bổ tự động</strong> theo tỷ lệ cho từng villa.',
                'Khi thay đổi Villa, phần chi phí chung sẽ giữ nguyên.',
                'Bạn có thể xem hoặc đề xuất thay đổi chi phí chung tại mục <strong>Danh mục</strong>.',
              ].map((t, i) => (
                <div key={i} className="ef-info-row">
                  <span className="ef-info-dot">ⓘ</span>
                  <span dangerouslySetInnerHTML={{ __html: t }} />
                </div>
              ))}
            </div>
          </div>

          {/* Fixed badge */}
          <div className="ef-shared-footer">
            <span className="ef-locked-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Cố định — Không đổi theo Villa
            </span>
          </div>
        </SectionCard>

        {/* ── RIGHT COLUMN ── */}
        <div className="ef-right">

          {/* ── TỔNG KẾT ── */}
          <div className="ef-summary">
            <div className="ef-summary-head">
              TỔNG KẾT {MONTHS[report.month]?.toUpperCase()} {report.year}
            </div>
            <div className="ef-formula">
              <div className="ef-formula-block">
                <div className="ef-formula-lbl">Tổng doanh thu</div>
                <div className="ef-formula-val ef-formula-val--rev">{fmtCompact(totalRevenue)}</div>
              </div>
              <div className="ef-formula-op">−</div>
              <div className="ef-formula-block">
                <div className="ef-formula-lbl">Tổng chi phí riêng</div>
                <div className="ef-formula-val ef-formula-val--exp">{fmtCompact(totalVillaExp)}</div>
              </div>
              <div className="ef-formula-op">−</div>
              <div className="ef-formula-block">
                <div className="ef-formula-lbl">Chi phí chung (phân bổ)</div>
                <div className="ef-formula-val ef-formula-val--shr">{fmtCompact(totalSharedAlloc)}</div>
              </div>
              <div className="ef-formula-op ef-formula-op--eq">=</div>
              <div className="ef-formula-block ef-formula-block--result">
                <div className="ef-formula-lbl">LỢI NHUẬN ƯỚC TÍNH</div>
                <div className={`ef-formula-val ef-formula-val--profit${netProfit < 0 ? ' neg' : ''}`}>
                  {fmtCompact(netProfit)}
                </div>
              </div>
            </div>
          </div>

          {/* ── HƯỚNG DẪN NHANH ── */}
          <div className="ef-guide">
            <button
              className="ef-guide-head"
              onClick={() => setShowGuide(v => !v)}
            >
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4m0-4h.01"/>
                </svg>
                Hướng dẫn nhanh
              </span>
              <span className="ef-guide-chevron">{showGuide ? '▾' : '▸'}</span>
            </button>

            {showGuide && (
              <div className="ef-guide-body">
                {[
                  { ico: '🔄', text: 'Dữ liệu ở mục (1) được tự động lấy từ hệ thống, bạn có thể chỉnh sửa nếu cần.' },
                  { ico: '✏️', text: 'Bổ sung doanh thu thủ công ở cột bên phải (nếu có).' },
                  { ico: '📊', text: 'Nhập các khoản chi phí riêng của villa theo 3 nhóm.' },
                  { ico: '🔒', text: 'Chi phí chung là cố định từ toàn hệ thống, được phân bổ tự động cho villa.' },
                  { ico: '💾', text: 'Nhấn "Lưu dữ liệu" để lưu lại toàn bộ thông tin.' },
                ].map((g, i) => (
                  <div key={i} className="ef-guide-item">
                    <span className="ef-guide-num">{i + 1}</span>
                    <span className="ef-guide-ico">{g.ico}</span>
                    <span>{g.text}</span>
                  </div>
                ))}
                <button className="ef-guide-cta">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  Xem hướng dẫn chi tiết
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <div className="ef-footer">
        <button className="ef-btn ef-btn--ghost" onClick={onCopyPrevMonth}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          Sao chép từ tháng trước
        </button>
        <div className="ef-footer-r">
          <button className="ef-btn ef-btn--muted"  onClick={() => {}}>Hủy</button>
          <button className="ef-btn ef-btn--danger" onClick={handleReset}>Reset</button>
          <button
            className={`ef-btn ef-btn--primary${saving ? ' loading' : ''}${saved ? ' saved' : ''}`}
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                </svg>
                Đang lưu...
              </>
            ) : saved ? '✅ Đã lưu!' : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
                Lưu dữ liệu
              </>
            )}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          STYLES
      ══════════════════════════════════════════════════════ */}
      <style>{`
        /* ── Base / Tokens ─────────────────────────────────── */
        .ef {
          --font: 'DM Sans', 'Be Vietnam Pro', 'Inter', system-ui, sans-serif;
          --rev:       #0A8A55;
          --rev-light: #ECFDF5;
          --rev-mid:   #D1FAE5;
          --exp-op:    #D97706;
          --exp-op-l:  #FFFBEB;
          --exp-op-m:  #FDE68A;
          --exp-fin:   #7C3AED;
          --exp-fin-l: #F5F3FF;
          --exp-fin-m: #DDD6FE;
          --exp-oth:   #0369A1;
          --exp-oth-l: #EFF6FF;
          --exp-oth-m: #BFDBFE;
          --shr:       #0F766E;
          --shr-light: #F0FDFA;
          --shr-mid:   #99F6E4;
          --muted:     #6B7280;
          --border:    #E5E7EB;
          --border-md: rgba(0,0,0,.09);
          --text:      #111827;
          --text-2:    #374151;
          --surface:   #FFFFFF;
          --bg:        #F9FAFB;

          font-family:    var(--font);
          font-size:      13.5px;
          color:          var(--text);
          display:        flex;
          flex-direction: column;
          gap:            14px;
          line-height:    1.5;
        }

        /* ── Banner ─────────────────────────────────────────── */
        .ef-banner {
          display:       flex;
          align-items:   center;
          justify-content: space-between;
          flex-wrap:     wrap;
          gap:           10px;
          padding:       13px 18px;
          background:    #EFF6FF;
          border:        1.5px solid #BFDBFE;
          border-radius: 12px;
        }
        .ef-banner-l {
          display:     flex;
          align-items: flex-start;
          gap:         12px;
        }
        .ef-banner-badge {
          width:          34px;
          height:         34px;
          border-radius:  9px;
          background:     #DBEAFE;
          color:          #1D4ED8;
          display:        flex;
          align-items:    center;
          justify-content:center;
          flex-shrink:    0;
        }
        .ef-banner-title {
          font-size:   .82rem;
          font-weight: 700;
          color:       #1E3A8A;
          letter-spacing: .01em;
        }
        .ef-banner-note {
          font-weight: 400;
          font-size:   .75rem;
          color:       #3B82F6;
        }
        .ef-banner-desc {
          font-size:   .74rem;
          color:       #3B82F6;
          margin-top:  2px;
        }
        .ef-banner-r {
          display:     flex;
          align-items: center;
          gap:         8px;
          flex-shrink: 0;
        }
        .ef-banner-time {
          font-size: .72rem;
          color:     #6B7280;
        }
        .ef-refresh-btn {
          display:       flex;
          align-items:   center;
          gap:           5px;
          padding:       5px 11px;
          background:    #DBEAFE;
          border:        1px solid #93C5FD;
          border-radius: 7px;
          color:         #1D4ED8;
          font-size:     .72rem;
          font-weight:   600;
          cursor:        pointer;
          font-family:   var(--font);
          transition:    background .12s;
        }
        .ef-refresh-btn:hover { background: #BFDBFE; }

        /* ── SectionCard ─────────────────────────────────────── */
        .ef-card {
          background:    var(--surface);
          border:        1.5px solid var(--border);
          border-radius: 14px;
          overflow:      hidden;
          border-top:    3px solid var(--card-accent, #E5E7EB);
        }
        .ef-card-header {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          width:           100%;
          padding:         13px 18px;
          background:      none;
          border:          none;
          cursor:          pointer;
          font-family:     var(--font);
          border-bottom:   1px solid var(--border);
          transition:      background .1s;
        }
        .ef-card-header:hover { background: var(--bg); }
        .ef-card-title-row {
          display:     flex;
          align-items: center;
          gap:         8px;
        }
        .ef-card-num {
          font-size:   .85rem;
          font-weight: 900;
          color:       var(--card-accent, #374151);
          opacity:     .6;
        }
        .ef-card-title {
          font-size:      .82rem;
          font-weight:    800;
          letter-spacing: .06em;
          color:          var(--text);
        }
        .ef-card-sub {
          font-size:   .72rem;
          font-weight: 400;
          color:       var(--muted);
          letter-spacing: .02em;
        }
        .ef-card-chevron {
          font-size: .75rem;
          color:     var(--muted);
        }
        .ef-card-body { }

        /* ── Revenue grid ─────────────────────────────────────── */
        .ef-rev-grid {
          display:               grid;
          grid-template-columns: 1fr 1fr;
        }
        .ef-panel {
          display:        flex;
          flex-direction: column;
          border-right:   1px solid var(--border);
        }
        .ef-panel:last-child { border-right: none; }

        .ef-panel-head {
          display:         flex;
          align-items:     center;
          gap:             7px;
          padding:         10px 16px;
          font-size:       .78rem;
          font-weight:     700;
          border-bottom:   1px solid var(--border);
        }
        .ef-panel-head em { font-style: italic; font-weight: 400; color: var(--muted); font-size: .72rem; }
        .ef-panel-head--auto   { background: #F0FDF4; color: var(--rev); }
        .ef-panel-head--manual { background: #FFFBEB; color: #92400E; }
        .ef-panel-head-icon {
          display:         flex;
          align-items:     center;
          justify-content: center;
          width:           22px;
          height:          22px;
          border-radius:   6px;
          background:      rgba(0,0,0,.06);
        }
        .ef-pill {
          margin-left: auto;
          font-size:   .58rem;
          font-weight: 800;
          padding:     2px 8px;
          border-radius: 4px;
          letter-spacing: .06em;
        }
        .ef-pill--auto   { background: rgba(10,138,85,.12); color: var(--rev); }
        .ef-pill--manual { background: rgba(217,119,6,.12); color: #92400E; }

        /* ── Table head ─────────────────────────────────────── */
        .ef-table-head {
          display:         flex;
          justify-content: space-between;
          padding:         7px 16px;
          font-size:       .63rem;
          font-weight:     700;
          text-transform:  uppercase;
          letter-spacing:  .07em;
          color:           #9CA3AF;
          background:      var(--bg);
          border-bottom:   1px solid var(--border);
        }
        .ef-table-head--sm { padding: 6px 14px; }

        /* ── Row ─────────────────────────────────────────────── */
        .ef-row {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         9px 16px;
          gap:             10px;
          border-bottom:   1px solid #F3F4F6;
          transition:      background .08s;
        }
        .ef-row:hover { background: #FAFAFA; }
        .ef-row:last-of-type { border-bottom: none; }
        .ef-row--auto   { background: #FAFFFE; }
        .ef-row--extra  { background: #FFFDF5; }
        .ef-row--sm     { padding: 8px 14px; }

        .ef-label {
          display:     flex;
          align-items: center;
          gap:         7px;
          font-size:   .82rem;
          color:       var(--text-2);
          flex:        1;
          cursor:      default;
          min-width:   0;
        }
        .ef-label--sm { font-size: .78rem; }

        .ef-row-ico    { font-size: .88rem; flex-shrink: 0; }
        .ef-row-ico--sm { font-size: .78rem; }

        .ef-label-edit {
          flex:        1;
          border:      none;
          background:  transparent;
          font-size:   .82rem;
          color:       var(--text-2);
          font-family: var(--font);
          outline:     none;
          min-width:   0;
          border-bottom: 1.5px dashed #FCD34D;
          padding-bottom: 1px;
        }
        .ef-label-edit:focus { border-bottom-color: #D97706; }

        .ef-static-amt {
          font-size:   .85rem;
          font-weight: 600;
          color:       var(--rev);
          white-space: nowrap;
          font-family: 'DM Mono', monospace;
        }

        .ef-add-row-btn {
          display:     flex;
          align-items: center;
          gap:         5px;
          width:       100%;
          padding:     9px 16px;
          border:      none;
          border-top:  1px dashed #E5E7EB;
          background:  transparent;
          color:       #9CA3AF;
          font-size:   .78rem;
          font-family: var(--font);
          cursor:      pointer;
          transition:  color .12s, background .12s;
        }
        .ef-add-row-btn:hover { color: #D97706; background: rgba(217,119,6,.04); }

        .ef-panel-total {
          margin-top:      auto;
          display:         flex;
          justify-content: space-between;
          align-items:     center;
          padding:         10px 16px;
          border-top:      1.5px solid #E5E7EB;
          font-size:       .78rem;
          font-weight:     700;
        }
        .ef-panel-total--green { background: #F0FDF4; color: var(--rev); }
        .ef-panel-total span:last-child {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size:   .88rem;
        }

        /* ── Grand totals ───────────────────────────────────── */
        .ef-grand-rev,
        .ef-grand-exp {
          display:         flex;
          justify-content: space-between;
          align-items:     center;
          padding:         13px 18px;
          font-size:       .78rem;
          font-weight:     800;
          letter-spacing:  .05em;
          border-top:      2px solid transparent;
        }
        .ef-grand-rev {
          background:   #F0FDF4;
          border-color: #6EE7B7;
          color:        #065F46;
        }
        .ef-grand-exp {
          background:   #FFF7ED;
          border-color: #FCD34D;
          color:        #92400E;
        }
        .ef-grand-num {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size:   1.05rem;
          font-weight: 800;
        }

        /* ── Expense columns ─────────────────────────────────── */
        .ef-exp-grid {
          display:               grid;
          grid-template-columns: 1fr 1fr 1fr;
        }
        .ef-exp-col {
          display:      flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
        }
        .ef-exp-col:last-child { border-right: none; }

        .ef-exp-col-head {
          display:     flex;
          align-items: center;
          gap:         7px;
          padding:     10px 14px;
          font-size:   .66rem;
          font-weight: 800;
          letter-spacing: .07em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--border);
        }
        .ef-exp-col--op  .ef-exp-col-head { background: var(--exp-op-l);  color: var(--exp-op);  border-bottom-color: var(--exp-op-m);  }
        .ef-exp-col--fin .ef-exp-col-head { background: var(--exp-fin-l); color: var(--exp-fin); border-bottom-color: var(--exp-fin-m); }
        .ef-exp-col--oth .ef-exp-col-head { background: var(--exp-oth-l); color: var(--exp-oth); border-bottom-color: var(--exp-oth-m); }
        .ef-exp-col-ico { font-size: .95rem; }

        .ef-exp-total {
          margin-top:      auto;
          display:         flex;
          justify-content: space-between;
          align-items:     center;
          padding:         9px 14px;
          border-top:      1.5px solid var(--border);
          font-size:       .76rem;
          font-weight:     800;
          font-family:     'DM Mono', monospace;
        }
        .ef-exp-total--op  { background: var(--exp-op-l);  color: var(--exp-op);  border-top-color: var(--exp-op-m);  }
        .ef-exp-total--fin { background: var(--exp-fin-l); color: var(--exp-fin); border-top-color: var(--exp-fin-m); }
        .ef-exp-total--oth { background: var(--exp-oth-l); color: var(--exp-oth); border-top-color: var(--exp-oth-m); }

        /* ── Amount input ─────────────────────────────────────── */
        .ef-input-cell {
          display:     flex;
          align-items: center;
          gap:         4px;
          border:      1.5px solid #E5E7EB;
          border-radius: 8px;
          padding:     5px 9px;
          background:  var(--bg);
          transition:  border-color .15s, box-shadow .15s, background .1s;
          flex-shrink: 0;
          min-width:   120px;
        }
        .ef-input-cell[data-focused] {
          border-color: var(--acc);
          background:   #fff;
          box-shadow:   0 0 0 3px color-mix(in srgb, var(--acc) 12%, transparent);
        }
        .ef-input-cell[data-has-value]:not([data-focused]) {
          border-color: color-mix(in srgb, var(--acc) 35%, #E5E7EB);
          background:   color-mix(in srgb, var(--acc) 3%, #fff);
        }
        .ef-input-cell input {
          border:     none;
          background: transparent;
          width:      95px;
          text-align: right;
          font-size:  .82rem;
          color:      var(--text);
          font-family: 'DM Mono', 'Courier New', monospace;
          outline:    none;
        }
        .ef-input-cell input::placeholder { color: #D1D5DB; font-style: italic; font-family: var(--font); }
        .ef-unit { font-size: .68rem; color: #9CA3AF; flex-shrink: 0; }

        /* ── Bottom layout ─────────────────────────────────── */
        .ef-bottom {
          display:               grid;
          grid-template-columns: 1fr 360px;
          gap:                   14px;
          align-items:           start;
        }

        /* ── Shared costs ───────────────────────────────────── */
        .ef-shared-wrap { display: flex; }
        .ef-shared-main { flex: 1; padding: 14px 18px; }

        .ef-shared-sub-head {
          display:     flex;
          align-items: center;
          gap:         7px;
          font-size:   .7rem;
          font-weight: 800;
          letter-spacing: .07em;
          text-transform: uppercase;
          color:       var(--shr);
          margin-bottom: 10px;
        }

        .ef-shared-th {
          display:     grid;
          grid-template-columns: 1.8fr 1fr 1fr .6fr;
          gap:         6px;
          padding:     6px 0 6px 2px;
          font-size:   .61rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          color:       #9CA3AF;
          border-bottom: 1px solid var(--border);
        }
        .ef-shared-row {
          display:     grid;
          grid-template-columns: 1.8fr 1fr 1fr .6fr;
          gap:         6px;
          align-items: center;
          padding:     9px 0 9px 2px;
          border-bottom: 1px solid #F3F4F6;
          font-size:   .82rem;
        }
        .ef-shared-name {
          display:     flex;
          align-items: center;
          gap:         6px;
          color:       var(--text-2);
        }
        .ef-shared-sys {
          font-family: 'DM Mono', monospace;
          font-size:   .78rem;
          color:       #4B5563;
        }
        .ef-shared-alloc {
          font-family: 'DM Mono', monospace;
          font-size:   .82rem;
          font-weight: 700;
          color:       var(--shr);
        }
        .ef-shared-pct {
          font-size:  .75rem;
          color:      #6B7280;
          font-weight:500;
        }

        .ef-shared-total {
          display:     grid;
          grid-template-columns: 1.8fr 1fr 1fr .6fr;
          gap:         6px;
          padding:     10px 0 6px 2px;
          border-top:  2px solid #D1FAE5;
          font-size:   .78rem;
          font-weight: 800;
          color:       var(--shr);
          margin-top:  2px;
        }
        .ef-shared-total-num {
          font-family: 'DM Mono', monospace;
          font-size:   .9rem;
        }

        .ef-link-btn {
          display:     inline-flex;
          align-items: center;
          gap:         6px;
          margin-top:  12px;
          padding:     7px 14px;
          border:      1px solid rgba(15,118,110,.2);
          border-radius: 8px;
          background:  rgba(15,118,110,.05);
          color:       var(--shr);
          font-size:   .75rem;
          font-weight: 600;
          font-family: var(--font);
          cursor:      pointer;
          transition:  background .12s;
        }
        .ef-link-btn:hover { background: rgba(15,118,110,.1); }

        .ef-shared-info {
          width:          200px;
          flex-shrink:    0;
          background:     var(--shr-light);
          border-left:    1px solid var(--shr-mid);
          padding:        16px 14px;
          display:        flex;
          flex-direction: column;
          gap:            12px;
        }
        .ef-info-row {
          display:     flex;
          gap:         8px;
          font-size:   .74rem;
          color:       #374151;
          line-height: 1.55;
        }
        .ef-info-dot {
          color:      var(--shr);
          font-size:  .82rem;
          flex-shrink:0;
          margin-top: 1px;
        }
        .ef-info-row strong { color: #0F766E; }

        .ef-shared-footer {
          padding:     10px 18px;
          background:  var(--shr-light);
          border-top:  1px solid var(--shr-mid);
          display:     flex;
          align-items: center;
        }
        .ef-locked-badge {
          display:     inline-flex;
          align-items: center;
          gap:         5px;
          font-size:   .7rem;
          font-weight: 600;
          color:       var(--shr);
          background:  rgba(15,118,110,.08);
          border:      1px solid rgba(15,118,110,.18);
          border-radius: 99px;
          padding:     3px 10px;
        }

        /* ── Right column ───────────────────────────────────── */
        .ef-right {
          display:        flex;
          flex-direction: column;
          gap:            12px;
        }

        /* ── Summary / formula ──────────────────────────────── */
        .ef-summary {
          background:   var(--surface);
          border:       1.5px solid var(--border);
          border-radius: 14px;
          overflow:     hidden;
          border-top:   3px solid #374151;
        }
        .ef-summary-head {
          padding:        11px 16px;
          font-size:      .65rem;
          font-weight:    800;
          letter-spacing: .09em;
          text-transform: uppercase;
          color:          #374151;
          background:     var(--bg);
          border-bottom:  1px solid var(--border);
        }
        .ef-formula {
          display:     flex;
          align-items: center;
          flex-wrap:   wrap;
          gap:         8px;
          padding:     16px;
        }
        .ef-formula-block { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ef-formula-block--result { flex: 1; }
        .ef-formula-lbl {
          font-size:      .57rem;
          font-weight:    700;
          text-transform: uppercase;
          letter-spacing: .07em;
          color:          #9CA3AF;
        }
        .ef-formula-val {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size:   .95rem;
          font-weight: 700;
          color:       var(--text);
        }
        .ef-formula-val--rev  { color: var(--rev); }
        .ef-formula-val--exp  { color: #DC2626; }
        .ef-formula-val--shr  { color: var(--shr); }
        .ef-formula-val--profit { font-size: 1.1rem; color: var(--rev); }
        .ef-formula-val--profit.neg { color: #DC2626; }
        .ef-formula-op {
          font-size:  1.2rem;
          font-weight:700;
          color:      #9CA3AF;
          flex-shrink:0;
        }
        .ef-formula-op--eq { color: #374151; font-size: 1.4rem; }

        /* ── Guide ──────────────────────────────────────────── */
        .ef-guide {
          background:   var(--surface);
          border:       1.5px solid var(--border);
          border-radius: 14px;
          overflow:     hidden;
        }
        .ef-guide-head {
          width:       100%;
          display:     flex;
          align-items: center;
          justify-content: space-between;
          padding:     12px 16px;
          border:      none;
          background:  none;
          cursor:      pointer;
          font-family: var(--font);
          font-size:   .8rem;
          font-weight: 700;
          color:       var(--text-2);
          border-bottom: 1px solid transparent;
          transition:  background .1s;
        }
        .ef-guide-head > span:first-child {
          display:     flex;
          align-items: center;
          gap:         7px;
          color:       #374151;
        }
        .ef-guide-head:hover { background: var(--bg); }
        .ef-guide-chevron { color: var(--muted); font-size: .75rem; }
        .ef-guide-body {
          padding:      2px 16px 14px;
          border-top:   1px solid var(--border);
          display:      flex;
          flex-direction: column;
        }
        .ef-guide-item {
          display:     flex;
          align-items: flex-start;
          gap:         8px;
          padding:     8px 0;
          border-bottom: 1px solid #F3F4F6;
          font-size:   .78rem;
          color:       #4B5563;
          line-height: 1.5;
        }
        .ef-guide-item:last-of-type { border-bottom: none; }
        .ef-guide-num {
          width:       20px;
          height:      20px;
          border-radius: 50%;
          background:  #F3F4F6;
          color:       #374151;
          font-size:   .65rem;
          font-weight: 800;
          display:     flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top:  1px;
        }
        .ef-guide-ico { flex-shrink: 0; font-size: .85rem; }
        .ef-guide-cta {
          margin-top:  10px;
          display:     inline-flex;
          align-items: center;
          gap:         6px;
          align-self:  flex-start;
          padding:     7px 16px;
          border:      1.5px solid var(--border);
          border-radius: 8px;
          background:  none;
          color:       #374151;
          font-size:   .75rem;
          font-weight: 600;
          font-family: var(--font);
          cursor:      pointer;
          transition:  background .12s;
        }
        .ef-guide-cta:hover { background: var(--bg); }

        /* ── Footer ─────────────────────────────────────────── */
        .ef-footer {
          display:         flex;
          justify-content: space-between;
          align-items:     center;
          gap:             10px;
          padding:         13px 18px;
          background:      var(--surface);
          border:          1.5px solid var(--border);
          border-radius:   12px;
          flex-wrap:       wrap;
        }
        .ef-footer-r {
          display:     flex;
          align-items: center;
          gap:         8px;
        }
        .ef-btn {
          display:     inline-flex;
          align-items: center;
          gap:         6px;
          padding:     8px 18px;
          border-radius: 8px;
          font-size:   .82rem;
          font-weight: 600;
          font-family: var(--font);
          cursor:      pointer;
          transition:  all .14s;
        }
        .ef-btn--ghost {
          background: none;
          border:     1.5px solid var(--border);
          color:      var(--text-2);
        }
        .ef-btn--ghost:hover { background: var(--bg); }
        .ef-btn--muted {
          background: none;
          border:     1.5px solid var(--border);
          color:      var(--muted);
        }
        .ef-btn--muted:hover { background: var(--bg); }
        .ef-btn--danger {
          background: rgba(220,38,38,.06);
          border:     1.5px solid rgba(220,38,38,.2);
          color:      #B91C1C;
        }
        .ef-btn--danger:hover { background: rgba(220,38,38,.12); }
        .ef-btn--primary {
          background:  #111827;
          border:      1.5px solid #111827;
          color:       #fff;
          padding:     9px 22px;
          font-size:   .85rem;
        }
        .ef-btn--primary:hover:not(:disabled) { background: #1F2937; }
        .ef-btn--primary:disabled { opacity: .6; cursor: not-allowed; }
        .ef-btn--primary.saved { background: var(--rev); border-color: var(--rev); }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .7s linear infinite; }

        /* ── Responsive ─────────────────────────────────────── */
        @media (max-width: 860px) {
          .ef-rev-grid  { grid-template-columns: 1fr; }
          .ef-panel     { border-right: none; border-bottom: 1px solid var(--border); }
          .ef-exp-grid  { grid-template-columns: 1fr; }
          .ef-exp-col   { border-right: none; border-bottom: 1px solid var(--border); }
          .ef-bottom    { grid-template-columns: 1fr; }
          .ef-shared-wrap { flex-direction: column; }
          .ef-shared-info { width: 100%; border-left: none; border-top: 1px solid var(--shr-mid); }
          .ef-formula   { gap: 5px; }
        }
      `}</style>
    </div>
  );
}
