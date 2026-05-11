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

// ── Mini bar chart ─────────────────────────────────────────────
function Chart6m({ data }: { data: MonthlyReport['monthly6'] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expense]), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120, padding:'0 4px' }}>
      {data.map(d => (
        <div key={d.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, height:'100%' }}>
          <div style={{ flex:1, width:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:2 }}>
            <div style={{ height:`${Math.round(d.revenue/maxVal*100)}%`, background:'#9FE1CB', borderRadius:'3px 3px 0 0', minHeight:3 }} />
          </div>
          <div style={{ flex:1, width:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:2 }}>
            <div style={{ height:`${Math.round(d.expense/maxVal*100)}%`, background:'#F5C4B3', borderRadius:'3px 3px 0 0', minHeight:3 }} />
          </div>
          <div style={{ fontSize:'.6rem', color:'#8A8F9A', whiteSpace:'nowrap' }}>{d.label}</div>
        </div>
      ))}
      <div style={{ position:'absolute', display:'flex', gap:12, fontSize:'.65rem', color:'#8A8F9A', top:0, right:0 }}>
        <span><span style={{display:'inline-block',width:8,height:8,background:'#9FE1CB',borderRadius:2,marginRight:3}} />Doanh thu</span>
        <span><span style={{display:'inline-block',width:8,height:8,background:'#F5C4B3',borderRadius:2,marginRight:3}} />Chi phí</span>
      </div>
    </div>
  );
}
