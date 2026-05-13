'use client';
// VillaOS v7 — app/owner/report/EntryForm.tsx

import { useState } from 'react';
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
}

// ── Number helpers ────────────────────────────────────────────

function fmtDisplay(n: number) {
  return n ? n.toLocaleString('vi-VN') : '';
}

function parseRaw(val: string): number {
  const s = val.trim();
  const tr = s.match(/^([\d.,]+)\s*tr$/i);
  if (tr) return Math.round(parseFloat(tr[1].replace(/\./g, '').replace(',', '.')) * 1_000_000);
  return parseInt(s.replace(/\./g, '').replace(/,/g, '')) || 0;
}

function fmtMoney(n: number) {
  if (!n) return '0 đ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + '.000.000 đ';
  return n.toLocaleString('vi-VN') + ' đ';
}

// ── Smart number input ────────────────────────────────────────

function AmtInput({ id, value, onChange, placeholder = 'Nhập số tiền', readOnly = false }: {
  id?: string; value: number; onChange?: (v: number) => void;
  placeholder?: string; readOnly?: boolean;
}) {
  const [raw, setRaw]     = useState('');
  const [focus, setFocus] = useState(false);

  if (readOnly) {
    return (
      <span className="ef-num ef-num--fixed">{value ? fmtDisplay(value) : '—'}</span>
    );
  }

  return (
    <div className={`ef-input-wrap${focus ? ' focused' : ''}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={focus ? raw : (value ? fmtDisplay(value) : '')}
        placeholder={placeholder}
        onChange={e => { setRaw(e.target.value); onChange?.(parseRaw(e.target.value)); }}
        onFocus={e => { setFocus(true); setRaw(value ? fmtDisplay(value) : ''); e.target.select(); }}
        onBlur={() => { setFocus(false); const v = parseRaw(raw); onChange?.(v); setRaw(''); }}
      />
      <span className="ef-input-unit">đ</span>
    </div>
  );
}

// ── Extra revenue row ─────────────────────────────────────────

interface ExtraRow { label: string; amount: number; }

// ── Main component ────────────────────────────────────────────

export default function EntryForm({ report, onSave, onCopyPrevMonth }: Props) {
  // Revenue
  const autoRevenue   = report.revenue.filter(c => c.isAuto);
  const manualRevenue = report.revenue.filter(c => !c.isAuto);

  // Per-villa expenses grouped by groupName
  const pvExpenses = report.expenses.filter(c => c.scope !== 'shared' && !c.isAuto);
  const pvGroups   = groupBy(pvExpenses, c => c.groupName ?? 'Khác');

  // Shared expenses
  const sharedExpenses = report.sharedExpenses.filter(c => !c.isAuto);
  const sharedAuto     = report.sharedExpenses.filter(c => c.isAuto);

  // State
  const [villaAmts,  setVillaAmts]  = useState<Record<string, number>>(initMap([...manualRevenue, ...pvExpenses]));
  const [sharedAmts, setSharedAmts] = useState<Record<string, number>>(initMap(sharedExpenses));
  const [extraRows,  setExtraRows]  = useState<ExtraRow[]>([{ label: '', amount: 0 }]);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  const setVilla  = (id: string, v: number) => setVillaAmts(p  => ({ ...p,  [id]: v }));
  const setShared = (id: string, v: number) => setSharedAmts(p => ({ ...p, [id]: v }));

  const addExtraRow = () => setExtraRows(r => [...r, { label: '', amount: 0 }]);
  const setExtraLabel  = (i: number, label: string) => setExtraRows(r => r.map((x, j) => j === i ? { ...x, label } : x));
  const setExtraAmount = (i: number, amount: number) => setExtraRows(r => r.map((x, j) => j === i ? { ...x, amount } : x));

  // Totals
  const totalAutoRev  = autoRevenue.reduce((s, c) => s + c.amount, 0);
  const totalManRev   = manualRevenue.reduce((s, c) => s + (villaAmts[c.id] ?? 0), 0);
  const totalExtraRev = extraRows.reduce((s, r) => s + r.amount, 0);
  const totalRev      = totalAutoRev + totalManRev + totalExtraRev;

  const totalPvExp    = pvExpenses.reduce((s, c) => s + (villaAmts[c.id] ?? 0), 0);
  const totalSharedFull = sharedExpenses.reduce((s, c) => s + (sharedAmts[c.id] ?? 0), 0)
                        + sharedAuto.reduce((s, c) => s + c.amount, 0);
  const allocPct      = report.sharedAllocPct;
  const allocatedShared = Math.round(totalSharedFull * allocPct / 100);
  const totalExp      = totalPvExp + allocatedShared;
  const netProfit     = totalRev - totalExp;

  // Group totals
  const groupTotal = (items: ReportCategoryWithEntry[]) =>
    items.reduce((s, c) => s + (villaAmts[c.id] ?? 0), 0);

  const handleSave = async () => {
    setSaving(true);
    const entries: SaveEntry[] = [
      ...manualRevenue.map(c => ({ categoryId: c.id, amount: villaAmts[c.id] ?? 0 })),
      ...pvExpenses.map(c    => ({ categoryId: c.id, amount: villaAmts[c.id] ?? 0 })),
      ...sharedExpenses.map(c => ({ categoryId: c.id, amount: sharedAmts[c.id] ?? 0, isShared: true })),
    ];
    await onSave(entries);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setVillaAmts(initMap([...manualRevenue, ...pvExpenses]));
    setSharedAmts(initMap(sharedExpenses));
    setExtraRows([{ label: '', amount: 0 }]);
  };

  // Month label
  const monthLabel = `Tháng ${report.month}/${report.year}`;
  const pvGroupEntries = Object.entries(pvGroups);

  return (
    <div className="ef">

      {/* ── Auto data banner ── */}
      <div className="ef-banner">
        <span className="ef-banner-icon">☁️</span>
        <div>
          <div className="ef-banner-title">Dữ liệu tự động lấy từ hệ thống (có thể chỉnh sửa)</div>
          <div className="ef-banner-sub">Các khoản dưới đây được đồng bộ tự động. Bạn có thể chỉnh sửa nếu cần.</div>
        </div>
        <span className="ef-banner-hint">Gõ <strong>18tr</strong> = 18.000.000đ</span>
      </div>

      {/* ── Main grid ── */}
      <div className="ef-grid-top">

        {/* ══ SECTION 1: DOANH THU ══ */}
        <div className="ef-card ef-card--rev">
          <div className="ef-card-header ef-card-header--rev">
            <span className="ef-card-num">1</span>
            <span className="ef-card-title">NHẬP DOANH THU</span>
          </div>

          <div className="ef-rev-cols">
            {/* Auto revenue */}
            <div className="ef-rev-col">
              <div className="ef-col-badge ef-col-badge--auto">AUTO</div>
              <div className="ef-col-label-row">
                <span>Nguồn doanh thu</span><span>Số tiền (đ)</span>
              </div>
              {autoRevenue.map(c => (
                <div key={c.id} className="ef-row ef-row--auto">
                  <span className="ef-row-name">{c.icon} {c.name}</span>
                  <span className="ef-num ef-num--auto">{fmtDisplay(c.amount) || '—'}</span>
                </div>
              ))}
              {manualRevenue.map(c => (
                <div key={c.id} className="ef-row ef-row--auto">
                  <span className="ef-row-name">{c.icon} {c.name}</span>
                  <AmtInput value={villaAmts[c.id] ?? 0} onChange={v => setVilla(c.id, v)} />
                </div>
              ))}
              <div className="ef-subtotal">
                <span>Tổng doanh thu (tự động)</span>
                <span className="ef-subtotal-val ef-subtotal-val--rev">{fmtMoney(totalAutoRev + totalManRev)}</span>
              </div>
            </div>

            {/* Manual extra */}
            <div className="ef-rev-col">
              <div className="ef-col-badge ef-col-badge--manual">MANUAL</div>
              <div className="ef-col-label-row">
                <span>Nguồn doanh thu</span><span>Số tiền (đ)</span>
              </div>
              {extraRows.map((row, i) => (
                <div key={i} className="ef-row ef-row--extra">
                  <input
                    className="ef-extra-label"
                    placeholder={`Doanh thu khác ${i + 1}`}
                    value={row.label}
                    onChange={e => setExtraLabel(i, e.target.value)}
                  />
                  <AmtInput value={row.amount} onChange={v => setExtraAmount(i, v)} />
                </div>
              ))}
              <button className="ef-add-row-btn" onClick={addExtraRow}>＋ Thêm dòng</button>
            </div>
          </div>

          <div className="ef-total-bar ef-total-bar--rev">
            <span>TỔNG DOANH THU (TỰ ĐỘNG + NHẬP TAY)</span>
            <span className="ef-total-val">{fmtMoney(totalRev)}</span>
          </div>
        </div>

        {/* ══ SECTION 2: CHI PHÍ RIÊNG ══ */}
        <div className="ef-card ef-card--exp">
          <div className="ef-card-header ef-card-header--exp">
            <span className="ef-card-num">2</span>
            <span className="ef-card-title">NHẬP CHI PHÍ RIÊNG (THEO VILLA)</span>
          </div>

          <div className={`ef-exp-groups ef-exp-groups--${pvGroupEntries.length === 0 ? 1 : Math.min(pvGroupEntries.length, 3)}`}>
            {pvGroupEntries.slice(0, 3).map(([gName, items], gi) => {
              const gTotal = groupTotal(items);
              const colors = GROUP_COLORS[gi] ?? GROUP_COLORS[0];
              return (
                <div key={gName} className="ef-exp-group">
                  <div className="ef-exp-group-header" style={{ background: colors.bg, color: colors.text }}>
                    <span className="ef-exp-group-icon">{GROUP_ICONS[gi] ?? '📦'}</span>
                    <span>{gi + 2}.{gi + 1} {gName.toUpperCase()}</span>
                  </div>
                  <div className="ef-col-label-row ef-col-label-row--exp">
                    <span>Khoản chi</span><span>Số tiền (đ)</span>
                  </div>
                  {items.map(c => (
                    <div key={c.id} className="ef-row">
                      <span className="ef-row-name">{c.icon} {c.name}</span>
                      <AmtInput value={villaAmts[c.id] ?? 0} onChange={v => setVilla(c.id, v)} />
                    </div>
                  ))}
                  <div className="ef-subtotal" style={{ color: colors.text }}>
                    <span>Tổng {gName.toLowerCase()}</span>
                    <span className="ef-subtotal-val" style={{ color: colors.text }}>{fmtMoney(gTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ef-total-bar ef-total-bar--exp">
            <span>TỔNG CHI PHÍ RIÊNG (THEO VILLA)</span>
            <span className="ef-total-val">{fmtMoney(totalPvExp)}</span>
          </div>
        </div>
      </div>

      {/* ── Bottom grid ── */}
      <div className="ef-grid-bottom">

        {/* ══ SECTION 3: CHI PHÍ CHUNG ══ */}
        <div className="ef-card ef-card--shared">
          <div className="ef-card-header ef-card-header--shared">
            <span className="ef-card-num">3</span>
            <span className="ef-card-title">CHI PHÍ CHUNG (TOÀN HỆ THỐNG)</span>
            <span className="ef-shared-badge">🔒 Cố định · Không đổi theo Villa</span>
          </div>

          <div className="ef-shared-body">
            {/* Shared groups */}
            <div className="ef-shared-left">
              {Object.entries(groupBy(sharedExpenses, c => c.groupName ?? 'Chung')).map(([gName, items], gi) => (
                <div key={gName} className="ef-shared-group">
                  <div className="ef-shared-group-title">
                    <span className="ef-shared-group-num">3.{gi + 1}</span> CHI PHÍ {gName.toUpperCase()} (CHUNG)
                  </div>
                  <div className="ef-shared-table">
                    <div className="ef-shared-thead">
                      <span>Khoản chi</span>
                      <span>Tổng hệ thống (đ)</span>
                      <span>Phân bổ cho villa (đ)</span>
                      <span>Tỷ lệ phân bổ</span>
                    </div>
                    {sharedAuto.filter(c => (c.groupName ?? 'Chung') === gName).map(c => (
                      <div key={c.id} className="ef-shared-row ef-shared-row--auto">
                        <span className="ef-row-name">{c.icon} {c.name}</span>
                        <span className="ef-num">{fmtDisplay(c.amount) || '—'}</span>
                        <span className="ef-num ef-num--alloc">{fmtDisplay(Math.round(c.amount * allocPct / 100))}</span>
                        <span className="ef-alloc-pct">{allocPct}%</span>
                      </div>
                    ))}
                    {items.map(c => {
                      const full  = sharedAmts[c.id] ?? 0;
                      const alloc = Math.round(full * allocPct / 100);
                      return (
                        <div key={c.id} className="ef-shared-row">
                          <span className="ef-row-name">{c.icon} {c.name}</span>
                          <AmtInput value={full} onChange={v => setShared(c.id, v)} />
                          <span className="ef-num ef-num--alloc">{fmtDisplay(alloc) || '—'}</span>
                          <span className="ef-alloc-pct">{allocPct}%</span>
                        </div>
                      );
                    })}
                    <div className="ef-shared-subtotal">
                      <span>Tổng chi phí {gName.toLowerCase()} (phân bổ)</span>
                      <span/>
                      <span className="ef-subtotal-val ef-subtotal-val--shared">
                        {fmtMoney(Math.round(
                          [...items.map(c => sharedAmts[c.id] ?? 0),
                           ...sharedAuto.filter(c => (c.groupName ?? 'Chung') === gName).map(c => c.amount)]
                            .reduce((s, v) => s + v, 0) * allocPct / 100,
                        ))}
                      </span>
                      <span/>
                    </div>
                  </div>
                </div>
              ))}

              {sharedExpenses.length === 0 && sharedAuto.length === 0 && (
                <div className="ef-shared-empty">
                  Chưa có danh mục chi phí chung. Vào <strong>⚙️ Danh mục</strong> để thêm.
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="ef-shared-info">
              <div className="ef-info-items">
                <div className="ef-info-item">
                  <span className="ef-info-dot">ℹ️</span>
                  Chi phí chung được <strong>phân bổ tự động</strong> theo tỷ lệ cho từng villa.
                </div>
                <div className="ef-info-item">
                  <span className="ef-info-dot">ℹ️</span>
                  Khi thay đổi Villa, phần chi phí chung sẽ giữ nguyên.
                </div>
                <div className="ef-info-item">
                  <span className="ef-info-dot">ℹ️</span>
                  Bạn có thể thay đổi chi phí chung tại mục <strong>Danh mục</strong>.
                </div>
                {allocPct < 100 && (
                  <div className="ef-info-alloc-badge">
                    Villa này chịu <strong>{allocPct}%</strong> chi phí chung<br/>
                    (theo tỷ lệ doanh thu)
                  </div>
                )}
              </div>
              <button className="ef-info-detail-btn">☰ Xem chi tiết chi phí chung</button>
            </div>
          </div>
        </div>

        {/* ══ SUMMARY + GUIDE ══ */}
        <div className="ef-right-col">

          {/* Summary */}
          <div className="ef-summary-card">
            <div className="ef-summary-title">TỔNG KẾT {monthLabel.toUpperCase()}</div>
            <div className="ef-summary-formula">
              <div className="ef-formula-item">
                <div className="ef-formula-label">Tổng doanh thu</div>
                <div className="ef-formula-val ef-formula-val--rev">{fmtMoney(totalRev)}</div>
              </div>
              <div className="ef-formula-op">−</div>
              <div className="ef-formula-item">
                <div className="ef-formula-label">Tổng chi phí riêng</div>
                <div className="ef-formula-val ef-formula-val--exp">{fmtMoney(totalPvExp)}</div>
              </div>
              <div className="ef-formula-op">−</div>
              <div className="ef-formula-item">
                <div className="ef-formula-label">Chi phí chung (phân bổ)</div>
                <div className="ef-formula-val ef-formula-val--shared">{fmtMoney(allocatedShared)}</div>
              </div>
              <div className="ef-formula-op">=</div>
              <div className="ef-formula-item ef-formula-item--result">
                <div className="ef-formula-label">LỢI NHUẬN ƯỚC TÍNH</div>
                <div className={`ef-formula-val ef-formula-val--profit${netProfit < 0 ? ' negative' : ''}`}>
                  {netProfit >= 0 ? '' : '−'}{fmtMoney(Math.abs(netProfit))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick guide */}
          <div className="ef-guide-card">
            <div className="ef-guide-title">HƯỚNG DẪN NHANH</div>
            {[
              'Dữ liệu ở mục 1 được tự động lấy từ hệ thống, bạn có thể chỉnh sửa nếu cần.',
              'Bổ sung doanh thu thủ công ở cột bên phải (nếu có).',
              'Nhập các khoản chi phí riêng của villa theo 3 nhóm.',
              'Chi phí chung là cố định thu thập hệ thống, được phân bổ tự động cho villa.',
              'Nhấn "Lưu dữ liệu" để lưu lại toàn bộ thông tin.',
            ].map((s, i) => (
              <div key={i} className="ef-guide-item">
                <span className="ef-guide-num">{'①②③④⑤'[i]}</span>
                <span>{s}</span>
              </div>
            ))}
            <button className="ef-guide-detail-btn">📖 Xem hướng dẫn chi tiết</button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="ef-footer">
        <button className="ef-footer-copy" onClick={onCopyPrevMonth}>
          📋 Sao chép từ tháng trước
        </button>
        <div className="ef-footer-right">
          <button className="ef-footer-cancel">Hủy</button>
          <button className="ef-footer-reset" onClick={handleReset}>Reset</button>
          <button className="ef-footer-save" disabled={saving} onClick={handleSave}>
            {saving ? 'Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu dữ liệu'}
          </button>
        </div>
      </div>

      <style>{EF_CSS}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function initMap(items: ReportCategoryWithEntry[]): Record<string, number> {
  const m: Record<string, number> = {};
  items.forEach(c => { m[c.id] = c.amount; });
  return m;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] ?? []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const GROUP_ICONS  = ['🔧', '💼', '📦'];
const GROUP_COLORS = [
  { bg: 'rgba(217,119,6,.1)',  text: '#B45309' },  // amber  - Vận hành
  { bg: 'rgba(124,58,237,.1)', text: '#6D28D9' },  // purple - Tài chính
  { bg: 'rgba(180,83,9,.1)',   text: '#92400E' },  // gold   - Khác
];

// ── CSS ───────────────────────────────────────────────────────

const EF_CSS = `
  /* ── Tokens ── */
  .ef {
    --rev-bg:      #EBF7F2;
    --rev-border:  #9FD9BF;
    --rev-text:    #0A6B44;
    --rev-dark:    #074F32;
    --exp-bg:      #FEF3E2;
    --exp-border:  #F5C97A;
    --exp-text:    #8C4B08;
    --exp-dark:    #5C3005;
    --shared-bg:   #EAF0FB;
    --shared-border:#AABFE8;
    --shared-text: #1A3A6B;
    --shared-dark: #0D2448;
    --danger-text: #B94C2A;
    --muted:       #6B7280;
    --border-light:rgba(0,0,0,.07);
    --border-mid:  rgba(0,0,0,.11);
    --surface:     #fff;
    --surface-dim: #F8F9FA;

    display: flex; flex-direction: column; gap: 14px;
    font-family: 'Be Vietnam Pro', 'Inter', system-ui, sans-serif;
    font-size: .84rem; color: #1A202C;
  }

  /* ── Banner ── */
  .ef-banner {
    display: flex; align-items: flex-start; gap: 12px;
    background: var(--shared-bg); border: 1px solid var(--shared-border);
    border-radius: 12px; padding: 12px 16px;
    font-size: .8rem; color: var(--shared-text);
  }
  .ef-banner-icon { font-size: 1.2rem; line-height: 1; flex-shrink: 0; margin-top: 1px; }
  .ef-banner-title { font-weight: 600; margin-bottom: 2px; }
  .ef-banner-sub   { color: #4A6FA5; font-size: .75rem; }
  .ef-banner-hint  {
    margin-left: auto; white-space: nowrap; align-self: center;
    background: rgba(26,58,107,.12); border-radius: 8px;
    padding: 4px 10px; font-size: .74rem; font-weight: 500; color: var(--shared-text);
  }

  /* ── Grids ── */
  .ef-grid-top    { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .ef-grid-bottom { display: grid; grid-template-columns: 1fr 370px; gap: 14px; align-items: start; }

  /* ── Cards ── */
  .ef-card {
    border-radius: 14px; overflow: hidden;
    border: 1px solid var(--border-light);
    background: var(--surface);
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .ef-card-header {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 16px; font-weight: 700; font-size: .78rem; letter-spacing: .07em;
  }
  .ef-card-num {
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: .72rem; font-weight: 700; flex-shrink: 0;
  }
  .ef-card-header--rev    { background: var(--rev-bg);    color: var(--rev-dark);    border-bottom: 1px solid var(--rev-border); }
  .ef-card-header--rev    .ef-card-num { background: var(--rev-dark);    color: var(--rev-bg);    }
  .ef-card-header--exp    { background: var(--exp-bg);    color: var(--exp-dark);    border-bottom: 1px solid var(--exp-border); }
  .ef-card-header--exp    .ef-card-num { background: var(--exp-dark);    color: var(--exp-bg);    }
  .ef-card-header--shared { background: var(--shared-bg); color: var(--shared-dark); border-bottom: 1px solid var(--shared-border); }
  .ef-card-header--shared .ef-card-num { background: var(--shared-dark); color: var(--shared-bg); }

  /* ── Revenue 2-col ── */
  .ef-rev-cols { display: grid; grid-template-columns: 1fr 1fr; }
  .ef-rev-col  { border-right: 1px solid var(--border-light); }
  .ef-rev-col:last-child { border-right: none; }

  .ef-col-badge {
    font-size: .64rem; font-weight: 700; letter-spacing: .12em;
    padding: 5px 14px; border-bottom: 1px solid var(--border-light);
  }
  .ef-col-badge--auto   { background: var(--rev-bg);    color: var(--rev-text);  border-bottom-color: var(--rev-border); }
  .ef-col-badge--manual { background: var(--exp-bg);    color: var(--exp-text);  border-bottom-color: var(--exp-border); }

  .ef-col-label-row {
    display: flex; justify-content: space-between;
    padding: 5px 14px; font-size: .68rem; font-weight: 600;
    color: var(--muted); border-bottom: 1px solid var(--border-light);
    background: var(--surface-dim);
  }
  .ef-col-label-row--exp { padding: 5px 12px; font-size: .67rem; }

  /* ── Rows ── */
  .ef-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 14px; border-bottom: 1px solid rgba(0,0,0,.04); gap: 8px;
  }
  .ef-row:last-of-type { border-bottom: none; }
  .ef-row--auto  { background: rgba(0,0,0,.012); }
  .ef-row--extra { gap: 6px; }
  .ef-row-name   { flex: 1; font-size: .81rem; color: #2D3748; }

  /* ── Extra row ── */
  .ef-extra-label {
    flex: 1; border: 1px solid var(--border-mid); border-radius: 7px;
    padding: 5px 8px; font-size: .78rem; color: #2D3748;
    background: rgba(0,0,0,.02); outline: none; min-width: 0;
    font-family: inherit;
  }
  .ef-extra-label:focus { border-color: var(--exp-text); background: #fff; }

  .ef-add-row-btn {
    width: 100%; padding: 8px; margin: 4px 0;
    border: 1px dashed var(--exp-border);
    background: transparent; font-size: .76rem; font-family: inherit;
    color: var(--exp-text); cursor: pointer; border-radius: 8px; transition: all .15s;
  }
  .ef-add-row-btn:hover { background: var(--exp-bg); }

  /* ── Smart input ── */
  .ef-input-wrap {
    display: flex; align-items: center; gap: 3px;
    border: 1px solid var(--border-mid); border-radius: 8px;
    padding: 4px 8px; background: rgba(0,0,0,.022);
    transition: all .15s; min-width: 0;
  }
  .ef-input-wrap.focused { border-color: var(--rev-text); background: #fff; box-shadow: 0 0 0 3px rgba(10,124,80,.1); }
  .ef-input-wrap input {
    border: none; background: transparent; font-size: .81rem; font-family: inherit;
    color: #1A202C; width: 100px; text-align: right; outline: none; min-width: 0;
  }
  .ef-input-unit { font-size: .68rem; color: #A0AEC0; flex-shrink: 0; }

  .ef-num            { font-variant-numeric: tabular-nums; font-size: .82rem; }
  .ef-num--fixed     { color: #1A202C; }
  .ef-num--auto      { color: #374151; }
  .ef-num--alloc     { color: var(--rev-text); font-weight: 600; }

  /* ── Subtotals ── */
  .ef-subtotal {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 14px; background: var(--surface-dim);
    border-top: 1px solid var(--border-light);
    font-size: .75rem; font-weight: 600; color: #4A5568;
  }
  .ef-subtotal-val              { font-variant-numeric: tabular-nums; font-size: .84rem; font-weight: 700; }
  .ef-subtotal-val--rev         { color: var(--rev-text); }
  .ef-subtotal-val--exp         { color: var(--danger-text); }
  .ef-subtotal-val--shared      { color: var(--shared-text); }

  /* ── Total bar ── */
  .ef-total-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 11px 16px; font-size: .76rem; font-weight: 700; letter-spacing: .04em;
  }
  .ef-total-bar--rev { background: var(--rev-bg); color: var(--rev-dark); border-top: 1px solid var(--rev-border); }
  .ef-total-bar--exp { background: var(--exp-bg); color: var(--exp-dark); border-top: 1px solid var(--exp-border); }
  .ef-total-val      { font-variant-numeric: tabular-nums; font-size: .98rem; font-weight: 700; }

  /* ── Expense groups ── */
  .ef-exp-groups     { display: grid; gap: 0; }
  .ef-exp-groups--1  { grid-template-columns: 1fr; }
  .ef-exp-groups--2  { grid-template-columns: 1fr 1fr; }
  .ef-exp-groups--3  { grid-template-columns: 1fr 1fr 1fr; }
  .ef-exp-group      { border-right: 1px solid var(--border-light); }
  .ef-exp-group:last-child { border-right: none; }
  .ef-exp-group-header {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 12px; font-size: .68rem; font-weight: 700;
    letter-spacing: .06em; border-bottom: 1px solid rgba(0,0,0,.07);
  }
  .ef-exp-group-icon { font-size: .85rem; }

  /* ── Shared section ── */
  .ef-shared-badge {
    margin-left: auto; font-size: .68rem; font-weight: 600;
    background: rgba(26,58,107,.12); border: 1px solid rgba(26,58,107,.18);
    border-radius: 99px; padding: 3px 10px; color: var(--shared-text); letter-spacing: 0;
  }
  .ef-shared-body  { display: grid; grid-template-columns: 1fr 220px; }
  .ef-shared-left  { border-right: 1px solid var(--border-light); }
  .ef-shared-group { border-bottom: 1px solid rgba(0,0,0,.05); }
  .ef-shared-group:last-child { border-bottom: none; }
  .ef-shared-group-title {
    font-size: .68rem; font-weight: 700; letter-spacing: .07em;
    color: var(--shared-text); padding: 8px 16px 5px;
    background: rgba(26,58,107,.04);
    border-bottom: 1px solid rgba(0,0,0,.05);
  }
  .ef-shared-group-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 17px; height: 17px; border-radius: 50%;
    background: var(--shared-dark); color: #fff; font-size: .62rem;
    margin-right: 5px;
  }
  .ef-shared-table { width: 100%; }
  .ef-shared-thead {
    display: grid; grid-template-columns: 1.5fr 1fr 1fr .7fr;
    padding: 5px 16px; font-size: .67rem; font-weight: 600;
    color: var(--muted); background: rgba(0,0,0,.02);
    border-bottom: 1px solid var(--border-light);
  }
  .ef-shared-thead span              { text-align: right; }
  .ef-shared-thead span:first-child  { text-align: left;  }
  .ef-shared-row {
    display: grid; grid-template-columns: 1.5fr 1fr 1fr .7fr;
    padding: 7px 16px; border-bottom: 1px solid rgba(0,0,0,.04);
    align-items: center; gap: 6px;
  }
  .ef-shared-row--auto { background: rgba(0,0,0,.01); opacity: .85; }
  .ef-shared-row .ef-num,
  .ef-shared-row .ef-alloc-pct,
  .ef-shared-row .ef-input-wrap { justify-self: end; }
  .ef-alloc-pct {
    font-size: .73rem; font-weight: 600; color: var(--muted);
    background: rgba(0,0,0,.05); border-radius: 5px;
    padding: 2px 6px; text-align: right;
  }
  .ef-shared-subtotal {
    display: grid; grid-template-columns: 1.5fr 1fr 1fr .7fr;
    padding: 8px 16px; background: rgba(26,58,107,.04);
    border-top: 1px solid rgba(0,0,0,.07);
    font-size: .75rem; font-weight: 700; color: var(--shared-text);
    align-items: center;
  }
  .ef-shared-subtotal .ef-subtotal-val { justify-self: end; }
  .ef-shared-empty {
    padding: 24px 16px; text-align: center; font-size: .82rem; color: var(--muted);
  }

  /* ── Info panel ── */
  .ef-shared-info {
    padding: 14px; display: flex; flex-direction: column;
    gap: 10px; justify-content: space-between;
    background: rgba(26,58,107,.03);
  }
  .ef-info-items { display: flex; flex-direction: column; gap: 8px; }
  .ef-info-item  { display: flex; gap: 8px; font-size: .75rem; color: #4A5568; line-height: 1.55; }
  .ef-info-dot   { flex-shrink: 0; }
  .ef-info-alloc-badge {
    background: var(--rev-bg); color: var(--rev-text);
    border: 1px solid var(--rev-border);
    border-radius: 10px; padding: 8px 10px;
    font-size: .75rem; font-weight: 500; line-height: 1.6;
  }
  .ef-info-detail-btn {
    width: 100%; padding: 8px; border: 1px solid rgba(26,58,107,.22);
    border-radius: 8px; background: #fff; color: var(--shared-text);
    font-size: .75rem; font-family: inherit; cursor: pointer; transition: all .15s;
  }
  .ef-info-detail-btn:hover { background: var(--shared-bg); }

  /* ── Right col ── */
  .ef-right-col { display: flex; flex-direction: column; gap: 14px; }

  /* ── Summary ── */
  .ef-summary-card {
    background: var(--surface); border: 1px solid var(--border-light);
    border-radius: 14px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .ef-summary-title {
    padding: 11px 16px; font-size: .72rem; font-weight: 700;
    letter-spacing: .07em; color: #1A202C;
    background: var(--surface-dim); border-bottom: 1px solid var(--border-light);
  }
  .ef-summary-formula {
    display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
    align-items: center; gap: 3px; padding: 12px 8px;
  }
  .ef-formula-item { text-align: center; padding: 6px 4px; }
  .ef-formula-item--result {
    background: var(--rev-bg); border: 1px solid var(--rev-border);
    border-radius: 10px; padding: 7px 4px;
  }
  .ef-formula-label {
    font-size: .63rem; font-weight: 600; color: var(--muted);
    letter-spacing: .04em; margin-bottom: 5px; text-transform: uppercase;
  }
  .ef-formula-val {
    font-variant-numeric: tabular-nums; font-size: .87rem; font-weight: 700;
  }
  .ef-formula-val--rev    { color: var(--rev-text); }
  .ef-formula-val--exp    { color: var(--danger-text); }
  .ef-formula-val--shared { color: var(--shared-text); }
  .ef-formula-val--profit { color: var(--rev-text); font-size: .95rem; }
  .ef-formula-val--profit.negative { color: var(--danger-text); }
  .ef-formula-op { font-size: 1.1rem; font-weight: 300; color: var(--muted); text-align: center; padding: 0 1px; }

  /* ── Guide ── */
  .ef-guide-card {
    background: var(--surface-dim); border: 1px solid var(--border-light);
    border-radius: 14px; padding: 14px 16px;
  }
  .ef-guide-title {
    font-size: .7rem; font-weight: 700; letter-spacing: .07em;
    color: #4A5568; margin-bottom: 10px;
  }
  .ef-guide-item {
    display: flex; gap: 8px; font-size: .77rem; color: #4A5568;
    line-height: 1.55; padding: 5px 0;
    border-bottom: 1px solid rgba(0,0,0,.05);
  }
  .ef-guide-item:last-of-type { border-bottom: none; }
  .ef-guide-num { font-size: .85rem; flex-shrink: 0; line-height: 1.4; }
  .ef-guide-detail-btn {
    width: 100%; margin-top: 10px; padding: 7px;
    border: 1px solid var(--border-mid); border-radius: 8px;
    background: transparent; font-size: .75rem; font-family: inherit;
    color: #4A5568; cursor: pointer; transition: background .15s;
  }
  .ef-guide-detail-btn:hover { background: rgba(0,0,0,.04); }

  /* ── Footer ── */
  .ef-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 0 4px; border-top: 1px solid rgba(0,0,0,.09);
    flex-wrap: wrap; gap: 8px;
  }
  .ef-footer-right  { display: flex; gap: 8px; align-items: center; }
  .ef-footer-copy   {
    font-size: .79rem; font-family: inherit; color: #4A5568;
    border: 1px solid var(--border-mid); background: #fff;
    border-radius: 8px; padding: 8px 14px; cursor: pointer; transition: all .15s;
  }
  .ef-footer-copy:hover { background: var(--surface-dim); }
  .ef-footer-cancel {
    font-size: .81rem; font-family: inherit; color: var(--muted);
    border: none; background: transparent; padding: 8px 14px; cursor: pointer;
  }
  .ef-footer-reset  {
    font-size: .81rem; font-family: inherit; color: var(--danger-text);
    border: 1px solid rgba(185,76,42,.25); background: rgba(185,76,42,.04);
    border-radius: 8px; padding: 8px 14px; cursor: pointer; transition: all .15s;
  }
  .ef-footer-reset:hover { background: rgba(185,76,42,.1); }
  .ef-footer-save   {
    font-size: .84rem; font-weight: 700; font-family: inherit;
    color: #fff; background: #0A6B44; border: none;
    border-radius: 99px; padding: 9px 26px; cursor: pointer; transition: opacity .15s;
    letter-spacing: .02em;
  }
  .ef-footer-save:hover:not(:disabled) { opacity: .87; }
  .ef-footer-save:disabled { opacity: .55; cursor: not-allowed; }

  @media (max-width: 768px) {
    .ef-grid-top    { grid-template-columns: 1fr; }
    .ef-grid-bottom { grid-template-columns: 1fr; }
    .ef-rev-cols    { grid-template-columns: 1fr; }
    .ef-exp-groups  { grid-template-columns: 1fr !important; }
    .ef-shared-body { grid-template-columns: 1fr; }
    .ef-shared-thead,
    .ef-shared-row,
    .ef-shared-subtotal { grid-template-columns: 1.5fr 1fr 1fr; }
    .ef-shared-thead span:last-child,
    .ef-shared-row span:last-child,
    .ef-shared-subtotal span:last-child { display: none; }
    .ef-summary-formula { grid-template-columns: 1fr 1fr; gap: 8px; }
    .ef-formula-op { display: none; }
  }
`;
