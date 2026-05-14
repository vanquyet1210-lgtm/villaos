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
export default function EntryForm({ report, onSave, onCopyPrevMonth }: Props) {
  const now = new Date().toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });

  // Revenue
  const autoRev   = report.revenue.filter(c => c.isAuto);
  const manualRev = report.revenue.filter(c => !c.isAuto);

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

  const va = (id: string, v: number) => setVA(p => ({ ...p, [id]: v }));
  const sa = (id: string, v: number) => setSA(p => ({ ...p, [id]: v }));

  // Totals
  const totalAutoRev  = autoRev.reduce((s,c) => s + c.amount, 0);
  const totalManRev   = manualRev.reduce((s,c) => s + (villaAmts[c.id]??0), 0);
  const totalExtraRev = extraRows.reduce((s,r) => s + r.amount, 0);
  const totalRev      = totalAutoRev + totalManRev + totalExtraRev;
  const totalPvExp    = pvExp.reduce((s,c) => s + (villaAmts[c.id]??0), 0);
  const totalSharedFull = [...sharedExp.map(c => sharedAmts[c.id]??0), ...sharedAuto.map(c=>c.amount)].reduce((a,b)=>a+b,0);
  const allocPct      = report.sharedAllocPct ?? 100;
  const allocShared   = Math.round(totalSharedFull * allocPct / 100);
  const totalExp      = totalPvExp + allocShared;
  const netProfit     = totalRev - totalExp;

  const handleSave = async () => {
    setSaving(true);
    await onSave([
      ...manualRev.map(c => ({ categoryId:c.id, amount:villaAmts[c.id]??0 })),
      ...pvExp.map(c     => ({ categoryId:c.id, amount:villaAmts[c.id]??0 })),
      ...sharedExp.map(c => ({ categoryId:c.id, amount:sharedAmts[c.id]??0, isShared:true })),
    ]);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleRefresh = () => {
    setRefresh(true);
    setTimeout(() => setRefresh(false), 800);
  };

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

      {/* ══ TOP GRID ══ */}
      <div className="ef-top-grid">

        {/* ── SECTION 1: DOANH THU ── */}
        <div className="ef-card">
          <div className="ef-card-hd ef-card-hd--rev">
            <span className="ef-card-num ef-card-num--rev">1</span>
            <span>NHẬP DOANH THU</span>
          </div>

          <div className="ef-rev-grid">
            {/* AUTO column */}
            <div className="ef-rev-col">
              <div className="ef-col-tag ef-col-tag--auto">
                <span className="ef-col-tag-dot"/>AUTO
              </div>
              <div className="ef-tbl-head">
                <span>Nguồn doanh thu</span><span>Số tiền (đ)</span>
              </div>
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
              {manualRev.map(c => (
                <div key={c.id} className="ef-tbl-row">
                  <div className="ef-tbl-name">
                    <BrandIcon name={c.name} icon={c.icon}/>
                    <span>{c.name}</span>
                  </div>
                  <AmtInput value={villaAmts[c.id]??0} onChange={v=>va(c.id,v)} placeholder="Nhập số tiền"/>
                </div>
              ))}
              <div className="ef-col-subtotal ef-col-subtotal--rev">
                <span>Tổng doanh thu tự động</span>
                <span>{money(totalAutoRev + totalManRev)}</span>
              </div>
            </div>

            {/* MANUAL column */}
            <div className="ef-rev-col ef-rev-col--manual">
              <div className="ef-col-tag ef-col-tag--manual">
                <span className="ef-col-tag-dot"/>MANUAL
              </div>
              <div className="ef-tbl-head">
                <span>Nguồn doanh thu bổ sung</span><span>Số tiền (đ)</span>
              </div>
              {extraRows.map((row, i) => (
                <div key={i} className="ef-tbl-row ef-tbl-row--extra">
                  <input
                    className="ef-extra-lbl"
                    value={row.label}
                    placeholder={`Doanh thu khác ${i + 1}`}
                    onChange={e => setER(r => r.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                  />
                  <AmtInput
                    value={row.amount}
                    onChange={v => setER(r => r.map((x,j) => j===i ? {...x,amount:v} : x))}
                  />
                </div>
              ))}
              <button className="ef-add-btn" onClick={() => setER(r => [...r,{label:'',amount:0}])}>
                ＋ Thêm dòng
              </button>
              <div className="ef-col-subtotal ef-col-subtotal--manual">
                <span>Tổng nhập tay bổ sung</span>
                <span>{money(totalExtraRev)}</span>
              </div>
            </div>
          </div>

          {/* Revenue total */}
          <div className="ef-big-total ef-big-total--rev">
            <span>TỔNG DOANH THU (TỰ ĐỘNG + NHẬP TAY)</span>
            <span className="ef-big-total-val">{money(totalRev)}</span>
          </div>
        </div>

        {/* ── SECTION 2: CHI PHÍ RIÊNG ── */}
        <div className="ef-card">
          <div className="ef-card-hd ef-card-hd--exp">
            <span className="ef-card-num ef-card-num--exp">2</span>
            <span>NHẬP CHI PHÍ RIÊNG (THEO VILLA)</span>
          </div>

          <div className={`ef-exp-grid ef-exp-grid--${Math.max(1, Math.min(pvEntries.length, 3))}`}>
            {pvEntries.slice(0, 3).map(([gName, items], gi) => {
              const meta  = getGroupMeta(gName, gi);
              const gSum  = sumMap(items.map(c=>c.id), villaAmts);
              return (
                <div key={gName} className="ef-exp-col">
                  <div className="ef-exp-col-hd" style={{ background:meta.light, borderBottom:`2px solid ${meta.border}` }}>
                    <span style={{ color:meta.accent }}>{meta.icon}</span>
                    <span style={{ color:meta.accent }}>
                      2.{gi+1} {meta.label}
                    </span>
                  </div>
                  <div className="ef-tbl-head">
                    <span>Khoản chi</span><span>Số tiền (đ)</span>
                  </div>
                  {items.map(c => (
                    <div key={c.id} className="ef-tbl-row">
                      <div className="ef-tbl-name">
                        <span className="ef-icon">{c.icon}</span>
                        <span>{c.name.replace(' (chung)','')}</span>
                      </div>
                      <AmtInput value={villaAmts[c.id]??0} onChange={v=>va(c.id,v)}/>
                    </div>
                  ))}
                  <div className="ef-col-subtotal" style={{ color:meta.accent }}>
                    <span>Tổng {gName.toLowerCase()}</span>
                    <span style={{ fontFamily:'Georgia,serif', fontStyle:'italic' }}>{money(gSum)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {pvEntries.length === 0 && (
            <div className="ef-empty-hint">
              Chưa có danh mục chi phí riêng. Vào <strong>⚙️ Danh mục</strong> để thêm.
            </div>
          )}

          <div className="ef-big-total ef-big-total--exp">
            <span>TỔNG CHI PHÍ RIÊNG (THEO VILLA)</span>
            <span className="ef-big-total-val">{money(totalPvExp)}</span>
          </div>
        </div>
      </div>

      {/* ══ BOTTOM GRID ══ */}
      <div className="ef-bot-grid">

        {/* ── SECTION 3: CHI PHÍ CHUNG ── */}
        <div className="ef-card">
          <div className="ef-card-hd ef-card-hd--shared">
            <span className="ef-card-num ef-card-num--shared">3</span>
            <span>CHI PHÍ CHUNG (TOÀN HỆ THỐNG)</span>
            <span className="ef-shared-lock">🔒 Cố định · Không đổi theo Villa</span>
          </div>

          <div className="ef-shared-body">
            <div className="ef-shared-main">
              {Object.entries(sharedGrps).map(([gName, items], gi) => (
                <div key={gName} className="ef-shared-grp">
                  <div className="ef-shared-grp-hd">
                    <span className="ef-shared-grp-num">{gi+1}</span>
                    CHI PHÍ {gName.toUpperCase()} (CHUNG)
                  </div>
                  <div className="ef-shared-thead">
                    <span>Khoản chi</span>
                    <span>Tổng hệ thống (đ)</span>
                    <span>Phân bổ cho villa (đ)</span>
                    <span>Tỷ lệ</span>
                  </div>
                  {sharedAuto.filter(c=>(c.groupName??'Nhân sự')===gName).map(c => (
                    <div key={c.id} className="ef-shared-row ef-shared-row--auto">
                      <div className="ef-tbl-name"><span>{c.icon}</span><span>{c.name}</span><span className="ef-auto-badge">auto</span></div>
                      <span className="ef-num-cell">{c.amount ? fmt(c.amount) : '—'}</span>
                      <span className="ef-num-cell ef-num-cell--alloc">{fmt(Math.round(c.amount*allocPct/100)) || '—'}</span>
                      <span className="ef-pct-cell">{allocPct}%</span>
                    </div>
                  ))}
                  {items.map(c => {
                    const full  = sharedAmts[c.id]??0;
                    const alloc = Math.round(full*allocPct/100);
                    return (
                      <div key={c.id} className="ef-shared-row">
                        <div className="ef-tbl-name"><span>{c.icon}</span><span>{c.name}</span></div>
                        <AmtInput value={full} onChange={v=>sa(c.id,v)}/>
                        <span className="ef-num-cell ef-num-cell--alloc">{fmt(alloc)||'—'}</span>
                        <span className="ef-pct-cell">{allocPct}%</span>
                      </div>
                    );
                  })}
                  <div className="ef-shared-subtotal">
                    <span>Tổng chi phí {gName.toLowerCase()} (phân bổ)</span>
                    <span/>
                    <span className="ef-num-cell ef-num-cell--total">
                      {money(Math.round(
                        [...items.map(c=>sharedAmts[c.id]??0),
                         ...sharedAuto.filter(c=>(c.groupName??'Nhân sự')===gName).map(c=>c.amount)]
                          .reduce((a,b)=>a+b,0) * allocPct / 100
                      ))}
                    </span>
                    <span/>
                  </div>
                </div>
              ))}
              {sharedExp.length === 0 && sharedAuto.length === 0 && (
                <div className="ef-empty-hint">Chưa có danh mục chi phí chung.</div>
              )}
            </div>

            {/* Info panel */}
            <div className="ef-shared-info">
              <div className="ef-info-list">
                {[
                  'Chi phí chung được phân bổ tự động theo tỷ lệ doanh thu cho từng villa.',
                  'Khi thay đổi villa, phần chi phí chung sẽ giữ nguyên.',
                  'Thay đổi danh mục tại ⚙️ Danh mục.',
                ].map((s, i) => (
                  <div key={i} className="ef-info-item">
                    <span className="ef-info-i">ℹ</span><span>{s}</span>
                  </div>
                ))}
                {allocPct < 100 && (
                  <div className="ef-alloc-pill">
                    Villa này chịu <strong>{allocPct}%</strong> chi phí chung
                  </div>
                )}
              </div>
              <button className="ef-detail-btn">☰ Xem chi tiết chi phí chung</button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="ef-right">

          {/* Summary formula */}
          <div className="ef-summary">
            <div className="ef-summary-hd">
              TỔNG KẾT THÁNG {report.month}/{report.year}
            </div>
            <div className="ef-formula">
              <div className="ef-formula-item">
                <div className="ef-formula-lbl">Tổng doanh thu</div>
                <div className="ef-formula-val ef-formula-val--rev">{money(totalRev)}</div>
              </div>
              <div className="ef-formula-op">−</div>
              <div className="ef-formula-item">
                <div className="ef-formula-lbl">Tổng chi phí riêng</div>
                <div className="ef-formula-val ef-formula-val--exp">{money(totalPvExp)}</div>
              </div>
              <div className="ef-formula-op">−</div>
              <div className="ef-formula-item">
                <div className="ef-formula-lbl">Chi phí chung (phân bổ)</div>
                <div className="ef-formula-val ef-formula-val--shared">{money(allocShared)}</div>
              </div>
              <div className="ef-formula-op">=</div>
              <div className={`ef-formula-result${netProfit < 0 ? ' negative' : ''}`}>
                <div className="ef-formula-lbl">LỢI NHUẬN ƯỚC TÍNH</div>
                <div className="ef-formula-big">{money(Math.abs(netProfit))}</div>
              </div>
            </div>
          </div>

          {/* Quick guide */}
          <div className="ef-guide">
            <div className="ef-guide-hd">📋 HƯỚNG DẪN NHANH</div>
            {[
              { icon:'☁️', text:'Dữ liệu mục 1 tự động lấy từ hệ thống, có thể chỉnh sửa.' },
              { icon:'✏️', text:'Bổ sung doanh thu thủ công ở cột bên phải.' },
              { icon:'🏠', text:'Nhập chi phí riêng của villa theo 3 nhóm.' },
              { icon:'🔗', text:'Chi phí chung được phân bổ tự động theo tỷ lệ doanh thu.' },
              { icon:'💾', text:'Nhấn "Lưu dữ liệu" để lưu lại toàn bộ thông tin.' },
            ].map((s, i) => (
              <div key={i} className="ef-guide-item">
                <span className="ef-guide-icon">{s.icon}</span>
                <span className="ef-guide-text"><strong>{'①②③④⑤'[i]}</strong> {s.text}</span>
              </div>
            ))}
            <button className="ef-guide-cta">📖 Xem hướng dẫn chi tiết →</button>
          </div>
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

/* ── Grids ── */
.ef-top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ef-bot-grid { display: grid; grid-template-columns: 1fr 360px; gap: 14px; align-items: start; }

/* ── Cards ── */
.ef-card {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden;
}
.ef-card-hd {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; font-size: .72rem; font-weight: 800;
  letter-spacing: .09em; border-bottom: 1px solid var(--border);
}
.ef-card-num {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: .72rem; font-weight: 800;
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
  padding: 6px 14px; font-size: .68rem; font-weight: 600;
  color: var(--muted); background: rgba(0,0,0,.02);
  border-bottom: 1px solid var(--border);
}
.ef-tbl-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; border-bottom: 1px solid rgba(0,0,0,.04); gap: 8px;
}
.ef-tbl-row:last-of-type { border-bottom: none; }
.ef-tbl-row--auto   { background: rgba(0,0,0,.01); }
.ef-tbl-row--extra  { gap: 6px; }
.ef-tbl-name { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; font-size: .82rem; }
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
  display: flex; align-items: center; gap: 4px;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 4px 8px; background: rgba(0,0,0,.025);
  transition: all .15s; min-width: 0;
}
.ef-inp--focus { border-color: #3B82F6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.ef-inp input {
  border: none; background: transparent; font-size: .82rem;
  color: var(--text); width: 100px; text-align: right; outline: none; min-width: 0;
  font-family: inherit;
}
.ef-inp-unit { font-size: .68rem; color: #94A3B8; flex-shrink: 0; }

/* ── Shared section ── */
.ef-shared-body { display: grid; grid-template-columns: 1fr 200px; }
.ef-shared-main { border-right: 1px solid var(--border); }
.ef-shared-grp { border-bottom: 1px solid rgba(0,0,0,.05); }
.ef-shared-grp:last-child { border-bottom: none; }
.ef-shared-grp-hd {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 16px; font-size: .68rem; font-weight: 800;
  letter-spacing: .07em; color: var(--shared);
  background: rgba(26,58,107,.04); border-bottom: 1px solid rgba(0,0,0,.05);
}
.ef-shared-grp-num {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--shared); color: #fff; font-size: .62rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.ef-shared-thead {
  display: grid; grid-template-columns: 1.6fr 1fr 1fr .65fr;
  padding: 6px 16px; font-size: .67rem; font-weight: 600; color: var(--muted);
  background: rgba(0,0,0,.02); border-bottom: 1px solid var(--border);
  text-align: right;
}
.ef-shared-thead span:first-child { text-align: left; }
.ef-shared-row {
  display: grid; grid-template-columns: 1.6fr 1fr 1fr .65fr;
  padding: 8px 16px; align-items: center; gap: 6px;
  border-bottom: 1px solid rgba(0,0,0,.04);
}
.ef-shared-row--auto { background: rgba(0,0,0,.01); }
.ef-shared-row .ef-inp { justify-self: end; }
.ef-num-cell {
  font-family: Georgia,serif; font-style: italic; font-size: .82rem;
  text-align: right; color: var(--text);
}
.ef-num-cell--alloc { color: var(--rev); }
.ef-num-cell--total { color: var(--shared); font-weight: 700; }
.ef-pct-cell {
  text-align: right; font-size: .74rem; font-weight: 700;
  color: var(--shared); background: var(--shared-lt);
  border-radius: 5px; padding: 2px 6px; justify-self: end;
}
.ef-shared-subtotal {
  display: grid; grid-template-columns: 1.6fr 1fr 1fr .65fr;
  padding: 10px 16px; background: rgba(26,58,107,.04);
  border-top: 1px solid rgba(0,0,0,.06); font-size: .76rem; font-weight: 700;
  color: var(--shared); align-items: center;
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
.ef-detail-btn {
  width: 100%; padding: 8px; border: 1px solid rgba(26,58,107,.2);
  border-radius: 8px; background: #fff; color: var(--shared);
  font-size: .74rem; font-family: inherit; cursor: pointer;
  transition: all .15s;
}
.ef-detail-btn:hover { background: var(--shared-lt); }

/* ── Right panel ── */
.ef-right { display: flex; flex-direction: column; gap: 14px; }

/* Summary */
.ef-summary {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden;
}
.ef-summary-hd {
  padding: 12px 16px; font-size: .72rem; font-weight: 800;
  letter-spacing: .08em; color: var(--text);
  background: rgba(0,0,0,.03); border-bottom: 1px solid var(--border);
}
.ef-formula {
  display: flex; flex-direction: column; gap: 0;
  padding: 6px 0;
}
.ef-formula-item { padding: 10px 16px; border-bottom: 1px solid rgba(0,0,0,.04); }
.ef-formula-item:last-child { border-bottom: none; }
.ef-formula-lbl { font-size: .67rem; font-weight: 600; color: var(--muted); letter-spacing: .05em; margin-bottom: 3px; text-transform: uppercase; }
.ef-formula-val { font-family: Georgia,serif; font-style: italic; font-size: .92rem; font-weight: 600; }
.ef-formula-val--rev    { color: var(--rev); }
.ef-formula-val--exp    { color: var(--exp); }
.ef-formula-val--shared { color: var(--shared); }
.ef-formula-op {
  padding: 0 16px; font-size: 1.1rem; font-weight: 300; color: #CBD5E0;
  line-height: .8; text-align: right;
}
.ef-formula-result {
  padding: 12px 16px; margin: 6px 10px; border-radius: 10px;
  background: rgba(10,107,68,.07); border: 2px solid var(--rev-bd);
}
.ef-formula-result.negative { background: rgba(185,76,42,.07); border-color: #FCA5A5; }
.ef-formula-big {
  font-family: Georgia,serif; font-style: italic; font-size: 1.15rem;
  font-weight: 700; color: var(--rev); margin-top: 4px;
}
.ef-formula-result.negative .ef-formula-big { color: var(--danger); }

/* Guide */
.ef-guide {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 14px 16px;
}
.ef-guide-hd {
  font-size: .72rem; font-weight: 800; letter-spacing: .07em;
  color: #475569; margin-bottom: 12px;
}
.ef-guide-item {
  display: flex; gap: 10px; padding: 7px 0;
  border-bottom: 1px solid rgba(0,0,0,.04); font-size: .78rem; line-height: 1.5;
}
.ef-guide-item:last-of-type { border-bottom: none; }
.ef-guide-icon { font-size: .9rem; flex-shrink: 0; line-height: 1.5; }
.ef-guide-text { color: #475569; }
.ef-guide-cta {
  width: 100%; margin-top: 12px; padding: 9px;
  background: var(--shared-lt); border: 1px solid var(--shared-bd);
  border-radius: 8px; color: var(--shared); font-size: .78rem;
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
  .ef-top-grid  { grid-template-columns: 1fr; }
  .ef-bot-grid  { grid-template-columns: 1fr; }
  .ef-rev-grid  { grid-template-columns: 1fr; }
  .ef-exp-grid  { grid-template-columns: 1fr !important; }
  .ef-shared-body { grid-template-columns: 1fr; }
  .ef-shared-thead,
  .ef-shared-row,
  .ef-shared-subtotal { grid-template-columns: 1.6fr 1fr 1fr; }
  .ef-shared-thead span:last-child,
  .ef-shared-row   > :last-child,
  .ef-shared-subtotal > :last-child { display: none; }
}
`;
