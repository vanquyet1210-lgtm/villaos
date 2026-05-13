'use client';
// VillaOS v7 — app/owner/report/ReportView.tsx

import { useState } from 'react';
import type {
  MonthlyReport,
  ReportCategoryWithEntry,
  CostAlert,
  ChannelStat,
  HealthMetric,
  HealthLevel,
} from '@/types/report';

// ── Helpers ───────────────────────────────────────────────────

function fmtShort(n: number) {
  if (!n) return '0đ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'k';
  return n.toLocaleString('vi-VN') + 'đ';
}

function delta(cur: number, prev: number) {
  if (!prev) return null;
  const pct = Math.round((cur - prev) / prev * 100);
  return { pct, up: pct >= 0 };
}

const HEALTH_COLOR: Record<HealthLevel, string> = {
  'Xuất sắc': '#178a5e',
  'Tốt':      '#178a5e',
  'Trung bình':'#C9A84C',
  'Kém':       '#A32D2D',
};

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  label, value, prev, accent, sub, subLabel,
}: {
  label: string; value: number; prev: number;
  accent?: boolean; sub?: number; subLabel?: string;
}) {
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
      {sub !== undefined && subLabel && (
        <div className="kpi-sub">Chưa thanh toán: {fmtShort(sub)}</div>
      )}
    </div>
  );
}

function OccupancyCard({ rate, prev }: { rate: number; prev: number }) {
  const d = delta(rate, prev);
  return (
    <div className="kpi-card">
      <div className="kpi-label">Công suất phòng</div>
      <div className="kpi-value">{rate}%</div>
      {d && (
        <div className={`kpi-delta${d.up ? ' up' : ' down'}`}>
          {d.up ? '↑' : '↓'} {Math.abs(d.pct)}% so với tháng trước
        </div>
      )}
    </div>
  );
}

// ── Category row with bar ─────────────────────────────────────

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
            <div className="rpt-bar-fill" style={{ width:`${pct}%`, background:c.color }} />
          </div>
        </div>
        <span className="rpt-amount">{fmtShort(c.amount)}</span>
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────

function Section({ title, items, total, accentColor }: {
  title: string; items: ReportCategoryWithEntry[]; total: number; accentColor: string;
}) {
  const [open, setOpen] = useState(true);
  const maxAmt = Math.max(...items.map(c => c.amount), 1);

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
          <span style={{ fontSize:14, color:'#8A8F9A', transform:open?'rotate(0)':'rotate(-90deg)', transition:'transform .2s' }}>▾</span>
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

// ── Priority 4: Revenue donut chart ──────────────────────────

function DonutChart({ data }: { data: { source: string; amount: number; pct: number; color: string }[] }) {
  const total  = data.reduce((s, d) => s + d.amount, 0);
  const R = 60; const CX = 80; const CY = 80;
  let angle = -Math.PI / 2;

  const slices = data.map(d => {
    const sweep   = (d.amount / total) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle  += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { ...d, path: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z` };
  });

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 160 160" width="140" height="140">
        {/* Hole */}
        <circle cx={CX} cy={CY} r={R * 0.56} fill="white"/>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5"/>
        ))}
        {/* Center label */}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1C2B4A">
          {fmtShort(total)}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#8A8F9A">Tổng DT</text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={i} className="donut-legend-row">
            <span className="donut-dot" style={{ background: d.color }}/>
            <span className="donut-lbl">{d.source}</span>
            <span className="donut-pct">{fmtShort(d.amount)}</span>
            <span className="donut-pct-num">({d.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Priority 4: Expense donut chart ──────────────────────────

function CostDonutChart({ expenses }: { expenses: ReportCategoryWithEntry[] }) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  if (!total) return null;

  // Top 4 + Khác
  const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
  const top4   = sorted.slice(0, 4);
  const rest   = sorted.slice(4);
  const restAmt = rest.reduce((s, e) => s + e.amount, 0);
  const data = [
    ...top4.map(e => ({ source: e.name, amount: e.amount, pct: Math.round(e.amount / total * 100), color: e.color })),
    ...(restAmt > 0 ? [{ source: 'Khác', amount: restAmt, pct: Math.round(restAmt / total * 100), color: '#8A8F9A' }] : []),
  ];

  const R = 60; const CX = 80; const CY = 80;
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.amount / total) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { ...d, path: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z` };
  });

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 160 160" width="140" height="140">
        <circle cx={CX} cy={CY} r={R * 0.56} fill="white"/>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5"/>
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1C2B4A">
          {fmtShort(total)}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#8A8F9A">Tổng CP</text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={i} className="donut-legend-row">
            <span className="donut-dot" style={{ background: d.color }}/>
            <span className="donut-lbl">{d.source}</span>
            <span className="donut-pct">{fmtShort(d.amount)}</span>
            <span className="donut-pct-num">({d.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Priority 4: Cost alerts ───────────────────────────────────

function CostAlerts({ alerts }: { alerts: CostAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="rpt-section">
      <div className="rpt-section-header" style={{ cursor:'default' }}>
        <span className="rpt-section-title">⚠️ Cảnh báo chi phí</span>
      </div>
      <div className="rpt-section-body">
        {alerts.map(a => (
          <div key={a.categoryId} className="alert-row">
            <div className="alert-row-left">
              <span className="alert-icon" style={{ background: `${a.color}18` }}>{a.icon}</span>
              <div>
                <div className="alert-name">{a.name}</div>
                <div className="alert-reason">{a.reason}</div>
              </div>
            </div>
            <div className="alert-amount">
              <span className="alert-val">{fmtShort(a.amount)}</span>
              <span className="alert-badge">↑{a.pctChange}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Priority 4: Health score ──────────────────────────────────

function HealthScore({
  score, label, metrics, tip,
}: {
  score: number; label: HealthLevel; metrics: HealthMetric[]; tip: string;
}) {
  const color = HEALTH_COLOR[label];
  const circ  = 2 * Math.PI * 40;
  const dash  = (score / 100) * circ;

  return (
    <div className="rpt-section">
      <div className="rpt-section-header" style={{ cursor:'default' }}>
        <span className="rpt-section-title">🏥 Sức khoẻ tài chính villa</span>
      </div>
      <div className="health-body">
        {/* Score gauge */}
        <div className="health-gauge">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(28,43,74,.06)" strokeWidth="8"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition:'stroke-dasharray .6s ease' }}
            />
            <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}</text>
            <text x="50" y="58" textAnchor="middle" fontSize="8" fill="#8A8F9A">/100</text>
          </svg>
          <div className="health-label" style={{ color }}>{label}</div>
        </div>
        {/* Metrics */}
        <div className="health-metrics">
          {metrics.map((m, i) => (
            <div key={i} className="health-metric-row">
              <span className="health-metric-icon">{m.icon}</span>
              <span className="health-metric-label">{m.label}</span>
              <span className="health-metric-val" style={{ color: HEALTH_COLOR[m.value] }}>{m.value}</span>
            </div>
          ))}
        </div>
        {/* Tip */}
        <div className="health-tip">
          <span className="health-tip-icon">💡</span>
          <span>{tip}</span>
          <button className="health-tip-btn">Xem chi tiết ›</button>
        </div>
      </div>
    </div>
  );
}

// ── Priority 4: Channel performance table ────────────────────

function ChannelTable({ stats }: { stats: ChannelStat[] }) {
  if (!stats.length) return null;
  return (
    <div className="rpt-section">
      <div className="rpt-section-header" style={{ cursor:'default' }}>
        <span className="rpt-section-title">📡 Hiệu suất kênh bán</span>
      </div>
      <div className="ch-table-wrap">
        <table className="ch-table">
          <thead>
            <tr>
              <th>Kênh</th>
              <th>Doanh thu</th>
              <th>Tỷ lệ</th>
              <th>ADR</th>
              <th>Công suất</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={i}>
                <td>
                  <span className="ch-dot" style={{ background: s.color }}/>
                  {s.source}
                </td>
                <td>{fmtShort(s.revenue)}</td>
                <td>{s.pct}%</td>
                <td>{fmtShort(s.adr)}</td>
                <td>
                  <div className="ch-bar-bg">
                    <div className="ch-bar-fill" style={{ width:`${s.occupancy || s.pct}%`, background: s.color }}/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Priority 4: Upcoming payouts ─────────────────────────────

function UpcomingPayouts({ payouts }: { payouts: MonthlyReport['upcomingPayouts'] }) {
  if (!payouts.length) return null;
  const total = payouts.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="rpt-section">
      <div className="rpt-section-header" style={{ cursor:'default' }}>
        <span className="rpt-section-title">💳 Payout sắp tới</span>
        <span className="rpt-section-total" style={{ color:'#178a5e' }}>
          Tổng sắp nhận: {fmtShort(total)}
        </span>
      </div>
      <div className="rpt-section-body">
        {payouts.map((p, i) => (
          <div key={i} className="payout-row">
            <div className="payout-source">
              <span className="payout-dot" style={{
                background: p.source === 'Agoda' ? '#3266ad' : p.source === 'Booking.com' ? '#d65a1e' : '#178a5e',
              }}/>
              {p.source}
            </div>
            <div className="payout-date">
              {new Date(p.expectedDate).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}
            </div>
            <div className="payout-amount">{fmtShort(p.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 6-month area chart (unchanged from original) ─────────────

function Chart6m({ data }: { data: MonthlyReport['monthly6'] }) {
  const W = 600, H = 200;
  const PAD = { t:40, r:20, b:36, l:52 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const n = data.length;
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expense, d.profit]), 1) * 1.1;

  const xPos = (i: number) => PAD.l + (i / (n - 1)) * chartW;
  const yPos = (v: number) => PAD.t + chartH - Math.max(0, v / maxVal) * chartH;

  const smoothPath = (values: number[], close = true): string => {
    if (n < 2) return '';
    const pts = values.map((v, i) => [xPos(i), yPos(v)] as [number, number]);
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * 0.4;
      const cp2x = pts[i + 1][0] - (pts[i + 1][0] - pts[i][0]) * 0.4;
      d += ` C ${cp1x},${pts[i][1]} ${cp2x},${pts[i + 1][1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
    }
    if (close) d += ` L ${pts[n-1][0]},${PAD.t + chartH} L ${pts[0][0]},${PAD.t + chartH} Z`;
    return d;
  };

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y:     PAD.t + chartH * (1 - t),
    label: t === 0 ? '0' : fmtShort(Math.round(maxVal * t)),
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', overflow:'visible' }}
        aria-label="Biểu đồ doanh thu chi phí lợi nhuận 6 tháng">
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
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y}
              stroke="rgba(28,43,74,.07)" strokeWidth="1" strokeDasharray="4 3"/>
            <text x={PAD.l - 7} y={t.y + 4} textAnchor="end" fontSize="9" fill="#8A8F9A">{t.label}</text>
          </g>
        ))}
        <path d={smoothPath(data.map(d => d.expense))} fill="url(#ag-exp)"/>
        <path d={smoothPath(data.map(d => d.profit))}  fill="url(#ag-pnl)"/>
        <path d={smoothPath(data.map(d => d.revenue))} fill="url(#ag-rev)"/>
        <path d={smoothPath(data.map(d => d.expense), false)} fill="none" stroke="#A32D2D" strokeWidth="1.5" strokeDasharray="5 3"/>
        <path d={smoothPath(data.map(d => d.profit),  false)} fill="none" stroke="#C9A84C" strokeWidth="2"/>
        <path d={smoothPath(data.map(d => d.revenue), false)} fill="none" stroke="#178a5e" strokeWidth="2.5"/>
        {data.map((d, i) => {
          const x = xPos(i); const yr = yPos(d.revenue); const yp = yPos(d.profit);
          return (
            <g key={d.label}>
              <circle cx={x} cy={yr} r="4" fill="white" stroke="#178a5e" strokeWidth="2"/>
              <rect x={x - 22} y={yr - 26} width="44" height="18" rx="5"
                fill="white" stroke="rgba(28,43,74,.12)" strokeWidth="1"/>
              <text x={x} y={yr - 13} textAnchor="middle" fontSize="9" fill="#1C2B4A" fontWeight="500">
                {fmtShort(d.revenue)}
              </text>
              <circle cx={x} cy={yp} r="3" fill="white" stroke="#C9A84C" strokeWidth="1.5"/>
              <text x={x} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#8A8F9A">{d.label}</text>
            </g>
          );
        })}
      </svg>
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

// ── Main ReportView ───────────────────────────────────────────

export default function ReportView({ report }: { report: MonthlyReport }) {
  return (
    <div className="report-view">

      {/* ── Row 1: 4 KPI cards ── */}
      <div className="kpi-grid">
        <KpiCard label="Doanh thu"     value={report.totalRevenue}    prev={report.prevMonthRevenue} />
        <KpiCard label="Lợi nhuận ròng" value={report.netProfit}       prev={report.prevMonthProfit} accent />
        <KpiCard
          label="Cashflow thực nhận"
          value={report.cashflowReceived}
          prev={0}
          sub={report.cashflowPending}
          subLabel="Chưa thanh toán"
        />
        <OccupancyCard rate={report.occupancyRate} prev={0} />
      </div>

      {/* ── Row 2: Donut + 6-month chart ── */}
      <div className="rpt-row2">
        {report.revenueBySource.length > 0 && (
          <div className="rpt-section rpt-section--donut">
            <div className="rpt-section-header" style={{ cursor:'default' }}>
              <span className="rpt-section-title">📊 Doanh thu theo nguồn</span>
            </div>
            <div style={{ padding:'16px' }}>
              <DonutChart data={report.revenueBySource} />
            </div>
          </div>
        )}
        {report.expenses.some(e => e.amount > 0) && (
          <div className="rpt-section rpt-section--donut">
            <div className="rpt-section-header" style={{ cursor:'default' }}>
              <span className="rpt-section-title">🔴 Chi phí theo danh mục</span>
            </div>
            <div style={{ padding:'16px' }}>
              <CostDonutChart expenses={report.expenses.filter(e => e.amount > 0)} />
            </div>
          </div>
        )}
        <div className="rpt-section" style={{ flex:1 }}>
          <div className="rpt-section-header" style={{ cursor:'default' }}>
            <span className="rpt-section-title">📈 Doanh thu & Lợi nhuận (6 tháng)</span>
          </div>
          <div style={{ padding:'16px' }}>
            <Chart6m data={report.monthly6} />
          </div>
        </div>
      </div>

      {/* ── Cost alerts ── */}
      <CostAlerts alerts={report.costAlerts} />

      {/* ── Revenue & Expense sections ── */}
      <Section title="💚 Doanh thu" items={report.revenue}  total={report.totalRevenue} accentColor="#178a5e" />
      <Section title="🔴 Chi phí"   items={report.expenses} total={report.totalExpense} accentColor="#A32D2D" />

      {/* ── Health score ── */}
      <HealthScore
        score={report.healthScore}
        label={report.healthLabel}
        metrics={report.healthMetrics}
        tip={report.healthTip}
      />

      {/* ── Bottom row: payouts + channel table ── */}
      <div className="rpt-bottom-row">
        <UpcomingPayouts payouts={report.upcomingPayouts} />
        <ChannelTable    stats={report.channelStats} />
      </div>

      <style>{`
        .report-view { display:flex; flex-direction:column; gap:12px; }

        /* KPI Grid — 4 cols on desktop, 2 on mobile */
        .kpi-grid {
          display:grid; grid-template-columns:repeat(4,1fr); gap:12px;
        }
        .kpi-card {
          background:var(--white,#fff);
          border:1px solid rgba(28,43,74,.08);
          border-radius:14px; padding:14px 16px;
        }
        .kpi-label  { font-size:.72rem; color:#8A8F9A; margin-bottom:4px; text-transform:uppercase; letter-spacing:.06em; }
        .kpi-value  { font-family:Georgia,serif; font-style:italic; font-size:1.3rem; color:#1C2B4A; }
        .kpi-value--accent { color:#178a5e; }
        .kpi-delta  { font-size:.72rem; margin-top:4px; }
        .kpi-delta.up   { color:#178a5e; }
        .kpi-delta.down { color:#A32D2D; }
        .kpi-sub    { font-size:.7rem; color:#A32D2D; margin-top:3px; }

        /* Row 2: donut + chart */
        .rpt-row2 { display:flex; gap:12px; }
        .rpt-section--donut { width:260px; flex-shrink:0; }

        /* Sections */
        .rpt-section {
          background:var(--white,#fff);
          border:1px solid rgba(28,43,74,.08);
          border-radius:14px; overflow:hidden;
        }
        .rpt-section-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:13px 16px;
          border-bottom:0.5px solid rgba(28,43,74,.06);
          background:none; border-top:none; border-left:none; border-right:none;
          width:100%; cursor:pointer; text-align:left;
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
          display:flex; align-items:center; justify-content:space-between;
          padding:8px 16px; border-bottom:0.5px solid rgba(28,43,74,.04);
        }
        .rpt-row:last-child { border-bottom:none; }
        .rpt-row-left  { display:flex; align-items:center; gap:7px; flex:1; min-width:0; }
        .rpt-row-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .rpt-dot    { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .rpt-name   { font-size:.83rem; color:#1C2B4A; }
        .rpt-badge  { font-size:.6rem; padding:2px 6px; border-radius:4px; }
        .rpt-badge--auto   { background:rgba(23,138,94,.1);  color:#178a5e; }
        .rpt-badge--manual { background:rgba(133,79,11,.1);  color:#854F0B; }
        .rpt-badge--fixed  { background:rgba(24,95,165,.1);  color:#185FA5; }
        .rpt-bar-wrap { width:80px; }
        .rpt-bar-bg   { width:100%; height:4px; background:rgba(28,43,74,.08); border-radius:2px; }
        .rpt-bar-fill { height:4px; border-radius:2px; transition:width .3s; }
        .rpt-amount   { font-family:Georgia,serif; font-style:italic; font-size:.88rem; color:#1C2B4A; min-width:48px; text-align:right; }

        /* Donut */
        .donut-wrap { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .donut-legend { display:flex; flex-direction:column; gap:6px; }
        .donut-legend-row { display:flex; align-items:center; gap:5px; font-size:.75rem; color:#1C2B4A; }
        .donut-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .donut-lbl { flex:1; }
        .donut-pct { font-family:Georgia,serif; font-style:italic; }
        .donut-pct-num { color:#8A8F9A; font-size:.68rem; }

        /* Cost alerts */
        .alert-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 16px; border-bottom:0.5px solid rgba(28,43,74,.04);
          gap:12px;
        }
        .alert-row:last-child { border-bottom:none; }
        .alert-row-left { display:flex; align-items:center; gap:10px; }
        .alert-icon {
          width:34px; height:34px; border-radius:8px;
          display:flex; align-items:center; justify-content:center; font-size:1rem;
          flex-shrink:0;
        }
        .alert-name   { font-size:.85rem; font-weight:500; color:#1C2B4A; }
        .alert-reason { font-size:.72rem; color:#A32D2D; margin-top:2px; }
        .alert-amount { display:flex; align-items:center; gap:6px; }
        .alert-val    { font-family:Georgia,serif; font-style:italic; font-size:.9rem; color:#1C2B4A; }
        .alert-badge  { font-size:.65rem; padding:2px 7px; border-radius:99px; background:rgba(163,45,45,.1); color:#A32D2D; font-weight:600; }

        /* Health */
        .health-body {
          display:flex; gap:16px; padding:16px; flex-wrap:wrap;
        }
        .health-gauge { display:flex; flex-direction:column; align-items:center; gap:4px; }
        .health-label { font-size:.85rem; font-weight:600; }
        .health-metrics { flex:1; display:flex; flex-direction:column; gap:8px; min-width:160px; }
        .health-metric-row {
          display:flex; align-items:center; gap:8px;
          padding:6px 10px; background:rgba(28,43,74,.03); border-radius:8px;
        }
        .health-metric-icon  { font-size:.9rem; }
        .health-metric-label { font-size:.8rem; color:#4A5568; flex:1; }
        .health-metric-val   { font-size:.8rem; font-weight:600; }
        .health-tip {
          flex:1; display:flex; flex-direction:column; gap:8px; min-width:160px;
          background:rgba(201,168,76,.06); border:1px solid rgba(201,168,76,.2);
          border-radius:10px; padding:12px; font-size:.8rem; color:#4A5568; line-height:1.5;
        }
        .health-tip-icon { font-size:1rem; }
        .health-tip-btn {
          margin-top:4px; align-self:flex-start;
          padding:5px 12px; border-radius:99px;
          border:1px solid rgba(201,168,76,.4); background:none;
          color:#8B6914; font-size:.75rem; cursor:pointer;
        }

        /* Channel table */
        .ch-table-wrap { overflow-x:auto; }
        .ch-table {
          width:100%; border-collapse:collapse; font-size:.82rem; color:#1C2B4A;
        }
        .ch-table th {
          padding:8px 16px; text-align:left;
          font-size:.68rem; font-weight:600; color:#8A8F9A;
          text-transform:uppercase; letter-spacing:.06em;
          border-bottom:0.5px solid rgba(28,43,74,.07);
        }
        .ch-table td {
          padding:10px 16px; border-bottom:0.5px solid rgba(28,43,74,.04);
        }
        .ch-table tr:last-child td { border-bottom:none; }
        .ch-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
        .ch-bar-bg   { width:80px; height:5px; background:rgba(28,43,74,.08); border-radius:2px; }
        .ch-bar-fill { height:5px; border-radius:2px; transition:width .3s; }

        /* Payouts */
        .payout-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 16px; border-bottom:0.5px solid rgba(28,43,74,.04);
          font-size:.83rem; color:#1C2B4A;
        }
        .payout-row:last-child { border-bottom:none; }
        .payout-source { display:flex; align-items:center; gap:6px; font-weight:500; flex:1; }
        .payout-dot    { width:8px; height:8px; border-radius:50%; }
        .payout-date   { color:#8A8F9A; font-size:.78rem; }
        .payout-amount { font-family:Georgia,serif; font-style:italic; min-width:64px; text-align:right; }

        /* Bottom row */
        .rpt-bottom-row { display:flex; gap:12px; }
        .rpt-bottom-row > * { flex:1; }

        /* Responsive */
        @media (max-width:700px) {
          .kpi-grid { grid-template-columns:1fr 1fr; }
          .kpi-grid .kpi-card:nth-child(3),
          .kpi-grid .kpi-card:nth-child(4) { grid-column:span 1; }
          .rpt-row2 { flex-direction:column; }
          .rpt-section--donut { width:100%; }
          .rpt-bottom-row { flex-direction:column; }
          .rpt-bar-wrap { display:none; }
        }
      `}</style>
    </div>
  );
}
