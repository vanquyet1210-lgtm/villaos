'use client';
// VillaOS v7 — app/owner/report/ReportView.tsx

import { useState } from 'react';
import type { MonthlyReport, ReportCategoryWithEntry } from '@/types/report';

interface Props { report: MonthlyReport; }

function fmtShort(n: number) {
  if (!n) return '0đ';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'') + ' tr';
  if (n >= 1_000)     return (n/1_000).toFixed(0) + 'k';
  return n.toLocaleString('vi-VN') + 'đ';
}
function delta(cur: number, prev: number) {
  if (!prev) return null;
  const pct = Math.round((cur - prev) / prev * 100);
  return { pct, up: pct >= 0 };
}

function KpiCard({ label, value, prev, accent }: { label:string; value:number; prev:number; accent?:boolean }) {
  const d = delta(value, prev);
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${accent ? ' kpi-value--accent' : ''}`}>{fmtShort(value)}</div>
      {d && (
        <div className={`kpi-delta${d.up ? ' up' : ' down'}`}>
          {d.up ? '↑' : '↓'} {Math.abs(d.pct)}% so với tháng trước
        </div>
      )}
    </div>
  );
}

function CategoryRow({ c, maxAmount }: { c: ReportCategoryWithEntry; maxAmount: number }) {
  const pct = maxAmount ? Math.max(3, Math.round(c.amount / maxAmount * 100)) : 0;
  return (
    <div className="rpt-row">
      <div className="rpt-row-left">
        <span className="rpt-dot" style={{ background: c.color }} />
        <span className="rpt-name">{c.icon} {c.name}</span>
        <span className={`rpt-badge rpt-badge--${c.isAuto ? 'auto' : c.fixedAmount ? 'fixed' : 'manual'}`}>
          {c.isAuto ? 'tự động' : c.fixedAmount ? 'cố định' : 'thủ công'}
        </span>
      </div>
      <div className="rpt-row-right">
        <div className="rpt-bar-wrap">
          <div className="rpt-bar-bg">
            <div className="rpt-bar-fill" style={{ width: `${pct}%`, background: c.color }} />
          </div>
        </div>
        <span className="rpt-amount">{fmtShort(c.amount)}</span>
      </div>
    </div>
  );
}

function Section({ title, items, total, accentColor }: {
  title: string; items: ReportCategoryWithEntry[]; total: number; accentColor: string;
}) {
  const [open, setOpen] = useState(true);
  const maxAmt = Math.max(...items.map(c => c.amount), 1);

  // Group by groupName
  const groups = new Map<string, ReportCategoryWithEntry[]>();
  items.forEach(c => {
    const g = c.groupName ?? 'Khác';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  });

  return (
    <div className="rpt-section">
      <button className="rpt-section-header" onClick={() => setOpen(o => !o)}>
        <span className="rpt-section-title">{title}</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span className="rpt-section-total" style={{ color: accentColor }}>{fmtShort(total)}</span>
          <span style={{ fontSize:14, color:'#8A8F9A', transform: open?'rotate(0)':'rotate(-90deg)', transition:'transform .2s' }}>▾</span>
        </div>
      </button>

      {open && (
        <div className="rpt-section-body">
          {Array.from(groups.entries()).map(([g, cats]) => (
            <div key={g}>
              <div className="rpt-group-label">{g}</div>
              {cats.map(c => <CategoryRow key={c.id} c={c} maxAmount={maxAmt} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportView({ report }: Props) {
  return (
    <div className="report-view">
      {/* KPI row */}
      <div className="kpi-grid">
        <KpiCard label="Tổng doanh thu" value={report.totalRevenue} prev={report.prevMonthRevenue} />
        <KpiCard label="Tổng chi phí"   value={report.totalExpense}  prev={report.prevMonthExpense} />
        <KpiCard label="Lợi nhuận ròng" value={report.netProfit}     prev={report.prevMonthProfit} accent />
      </div>

      {/* Revenue section */}
      <Section title="💚 Doanh thu" items={report.revenue}  total={report.totalRevenue} accentColor="#178a5e" />

      {/* Expense section */}
      <Section title="🔴 Chi phí"   items={report.expenses} total={report.totalExpense} accentColor="#A32D2D" />

      {/* 6-month chart */}
      <div className="rpt-section" style={{ marginTop:16 }}>
        <div className="rpt-section-header" style={{ cursor:'default' }}>
          <span className="rpt-section-title">📈 Biểu đồ 6 tháng</span>
        </div>
        <div className="rpt-chart-wrap">
          <Chart6m data={report.monthly6} />
        </div>
      </div>

      <style>{`
        .report-view { display:flex; flex-direction:column; gap:12px; }
        .kpi-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap:12px;
          margin-bottom: 4px;
        }
        .kpi-card {
          background:    var(--white,#fff);
          border:        1px solid rgba(28,43,74,.08);
          border-radius: 14px;
          padding:       14px 16px;
        }
        .kpi-label  { font-size:.72rem; color:#8A8F9A; margin-bottom:4px; text-transform:uppercase; letter-spacing:.06em; }
        .kpi-value  { font-family:Georgia,serif; font-style:italic; font-size:1.3rem; color:#1C2B4A; }
        .kpi-value--accent { color:#178a5e; }
        .kpi-delta  { font-size:.72rem; margin-top:4px; }
        .kpi-delta.up   { color:#178a5e; } .kpi-delta.down { color:#A32D2D; }

        .rpt-section {
          background:    var(--white,#fff);
          border:        1px solid rgba(28,43,74,.08);
          border-radius: 14px;
          overflow:      hidden;
        }
        .rpt-section-header {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         13px 16px;
          border-bottom:   0.5px solid rgba(28,43,74,.06);
          background:      none;
          border:          none;
          width:           100%;
          cursor:          pointer;
          text-align:      left;
        }
        .rpt-section-title { font-size:.9rem; font-weight:500; color:#1C2B4A; }
        .rpt-section-total { font-family:Georgia,serif; font-style:italic; font-size:1rem; }

        .rpt-section-body  { padding:4px 0; }
        .rpt-group-label {
          font-size:.65rem; font-weight:600; color:#C9A84C;
          letter-spacing:.1em; text-transform:uppercase;
          padding:8px 16px 4px;
        }
        .rpt-row {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         8px 16px;
          border-bottom:   0.5px solid rgba(28,43,74,.04);
        }
        .rpt-row:last-child { border-bottom:none; }
        .rpt-row-left  { display:flex; align-items:center; gap:7px; flex:1; min-width:0; }
        .rpt-row-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .rpt-dot    { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
        .rpt-name   { font-size:.83rem; color:#1C2B4A; }
        .rpt-badge  { font-size:.6rem; padding:2px 6px; border-radius:4px; }
        .rpt-badge--auto   { background:rgba(23,138,94,.1);  color:#178a5e; }
        .rpt-badge--manual { background:rgba(133,79,11,.1);  color:#854F0B; }
        .rpt-badge--fixed  { background:rgba(24,95,165,.1);  color:#185FA5; }
        .rpt-bar-wrap { width:80px; }
        .rpt-bar-bg   { width:100%; height:4px; background:rgba(28,43,74,.08); border-radius:2px; }
        .rpt-bar-fill { height:4px; border-radius:2px; transition:width .3s; }
        .rpt-amount   { font-family:Georgia,serif; font-style:italic; font-size:.88rem; color:#1C2B4A; min-width:48px; text-align:right; }

        .rpt-chart-wrap { padding:16px; }

        @media(max-width:600px) {
          .kpi-grid { grid-template-columns:1fr 1fr; }
          .kpi-grid .kpi-card:last-child { grid-column:span 2; }
          .rpt-bar-wrap { display:none; }
        }
      `}</style>
    </div>
  );
}

// ── Smooth Area Chart 6 tháng ─────────────────────────────────
function Chart6m({ data }: { data: MonthlyReport['monthly6'] }) {
  const W = 600, H = 200, PAD = { t: 40, r: 20, b: 36, l: 52 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const n = data.length;

  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expense, d.profit]), 1) * 1.1;

  const xPos = (i: number) => PAD.l + (i / (n - 1)) * chartW;
  const yPos = (v: number) => PAD.t + chartH - Math.max(0, v / maxVal) * chartH;

  // Smooth bezier path using cardinal spline
  const smoothPath = (values: number[], close = true): string => {
    if (n < 2) return '';
    const pts = values.map((v, i) => [xPos(i), yPos(v)] as [number, number]);
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * 0.4;
      const cp1y = pts[i][1];
      const cp2x = pts[i + 1][0] - (pts[i + 1][0] - pts[i][0]) * 0.4;
      const cp2y = pts[i + 1][1];
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pts[i+1][0]},${pts[i+1][1]}`;
    }
    if (close) {
      d += ` L ${pts[n-1][0]},${PAD.t + chartH} L ${pts[0][0]},${PAD.t + chartH} Z`;
    }
    return d;
  };

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y:     PAD.t + chartH * (1 - t),
    label: t === 0 ? '0' : fmtShort(Math.round(maxVal * t)),
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', overflow:'visible' }}
        aria-label="Biểu đồ miền doanh thu chi phí lợi nhuận">
        <defs>
          <linearGradient id="ag-rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#178a5e" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#178a5e" stopOpacity="0.04"/>
          </linearGradient>
          <linearGradient id="ag-pnl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#C9A84C" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.06"/>
          </linearGradient>
          <linearGradient id="ag-exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#A32D2D" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#A32D2D" stopOpacity="0.03"/>
          </linearGradient>
        </defs>

        {/* Grid */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y}
              stroke="rgba(28,43,74,.07)" strokeWidth="1" strokeDasharray="4 3"/>
            <text x={PAD.l - 7} y={t.y + 4} textAnchor="end" fontSize="9" fill="#8A8F9A">{t.label}</text>
          </g>
        ))}

        {/* Areas (bottom-up: expense, profit, revenue) */}
        <path d={smoothPath(data.map(d => d.expense))} fill="url(#ag-exp)"/>
        <path d={smoothPath(data.map(d => d.profit))}  fill="url(#ag-pnl)"/>
        <path d={smoothPath(data.map(d => d.revenue))} fill="url(#ag-rev)"/>

        {/* Lines */}
        <path d={smoothPath(data.map(d => d.expense), false)} fill="none" stroke="#A32D2D" strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round"/>
        <path d={smoothPath(data.map(d => d.profit),  false)} fill="none" stroke="#C9A84C" strokeWidth="2"   strokeLinejoin="round"/>
        <path d={smoothPath(data.map(d => d.revenue), false)} fill="none" stroke="#178a5e" strokeWidth="2.5" strokeLinejoin="round"/>

        {/* Dots + value labels */}
        {data.map((d, i) => {
          const x  = xPos(i);
          const yr = yPos(d.revenue);
          const yp = yPos(d.profit);
          const above = i < n - 1;
          return (
            <g key={d.label}>
              {/* Revenue dot + label */}
              <circle cx={x} cy={yr} r="4" fill="white" stroke="#178a5e" strokeWidth="2"/>
              <rect x={x - 22} y={yr - 26} width="44" height="18" rx="5"
                fill="white" stroke="rgba(28,43,74,.12)" strokeWidth="1"/>
              <text x={x} y={yr - 13} textAnchor="middle" fontSize="9" fill="#1C2B4A" fontWeight="500">
                {fmtShort(d.revenue)}
              </text>

              {/* Profit dot */}
              <circle cx={x} cy={yp} r="3" fill="white" stroke="#C9A84C" strokeWidth="1.5"/>

              {/* X label */}
              <text x={x} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#8A8F9A">{d.label}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, fontSize:'.7rem', color:'#8A8F9A', marginTop:6, paddingLeft:PAD.l }}>
        {[
          { color:'#178a5e', label:'Doanh thu' },
          { color:'#C9A84C', label:'Lợi nhuận' },
          { color:'#A32D2D', label:'Chi phí', dash:true },
        ].map(l => (
          <span key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <svg width="18" height="8">
              {l.dash
                ? <line x1="0" y1="4" x2="18" y2="4" stroke={l.color} strokeWidth="2" strokeDasharray="4 2"/>
                : <path d="M0,7 Q9,1 18,7" fill={l.color} fillOpacity=".3" stroke={l.color} strokeWidth="1.5"/>
              }
            </svg>
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
