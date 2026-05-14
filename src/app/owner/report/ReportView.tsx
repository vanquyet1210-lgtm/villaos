'use client';
// VillaOS v7 — app/owner/report/ReportView.tsx

import { useState } from 'react';
import type { MonthlyReport, HealthMetric } from '@/types/report';

interface Props { report: MonthlyReport }

// ─── Global color tokens (single source of truth) ────────────
// Every section uses these constants — donut slices, KPI values,
// sparklines, chart areas, and legend bars all pull from here.
const C = {
  revenue:   '#178a5e',   // green  — doanh thu
  expense:   '#A32D2D',   // red    — chi phí
  profit:    '#C9A84C',   // gold   — lợi nhuận
  cashflow:  '#1A73E8',   // blue   — cashflow
  occupancy: '#7C3AED',   // violet — công suất
  navy:      '#1C2B4A',
  muted:     '#8A8F9A',
  border:    'rgba(28,43,74,.08)',
};

// ─── Helpers ──────────────────────────────────────────────────
function fmt(n: number) {
  if (!n) return '0đ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'k';
  return n.toLocaleString('vi-VN') + 'đ';
}
function pctChange(cur: number, prev: number) {
  if (!prev) return null;
  const pct = Math.round((cur - prev) / prev * 100);
  return { pct, up: pct >= 0 };
}

// ─── Sparkline ────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 100, H = 34;
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const r   = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / r) * (H - 4) - 2,
  ] as [number, number]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i][0] + pts[i + 1][0]) / 2;
    d += ` C ${cx},${pts[i][1]} ${cx},${pts[i + 1][1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  const uid = color.replace('#', '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d + ` L ${pts[pts.length - 1][0]},${H} L 0,${H} Z`} fill={`url(#sp-${uid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Donut chart ──────────────────────────────────────────────
interface Slice { label: string; value: number; color: string }

function Donut({ slices, label, sub }: { slices: Slice[]; label?: string; sub?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const R = 68, ri = 44, CX = 88, CY = 88;
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  let angle = -Math.PI / 2;

  const paths = slices.map((sl, idx) => {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const a1 = angle, a2 = angle + sweep;
    angle = a2;
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    const x2 = CX + R * Math.cos(a2), y2 = CY + R * Math.sin(a2);
    const xi1 = CX + ri * Math.cos(a1), yi1 = CY + ri * Math.sin(a1);
    const xi2 = CX + ri * Math.cos(a2), yi2 = CY + ri * Math.sin(a2);
    const large = sweep > Math.PI ? 1 : 0;
    return { ...sl, idx, large,
      d: `M ${x1},${y1} A ${R},${R} 0 ${large},1 ${x2},${y2} L ${xi2},${yi2} A ${ri},${ri} 0 ${large},0 ${xi1},${yi1} Z`,
    };
  });

  const hov = hovered !== null ? slices[hovered] : null;

  return (
    <svg viewBox="0 0 176 176" style={{ width: '100%', maxWidth: 176, height: 'auto' }}>
      {paths.map(p => (
        <path key={p.idx} d={p.d} fill={p.color}
          opacity={hovered === null || hovered === p.idx ? 0.93 : 0.45}
          style={{ cursor: 'pointer', transition: 'opacity .15s' }}
          onMouseEnter={() => setHovered(p.idx)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}
      {hov ? (
        <>
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize="11" fontWeight="700"
            fontFamily="Georgia,serif" fontStyle="italic" fill={hov.color}>{fmt(hov.value)}</text>
          <text x={CX} y={CY + 7}  textAnchor="middle" fontSize="7.5" fill={C.muted}>{hov.label}</text>
          <text x={CX} y={CY + 19} textAnchor="middle" fontSize="9" fontWeight="700" fill={hov.color}>
            {Math.round(hov.value / total * 100)}%
          </text>
        </>
      ) : (
        <>
          {label && (
            <text x={CX} y={CY - 6} textAnchor="middle" fontSize="12.5" fontWeight="700"
              fontFamily="Georgia,serif" fontStyle="italic" fill={C.navy}>{label}</text>
          )}
          {sub && (
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill={C.muted}>{sub}</text>
          )}
        </>
      )}
    </svg>
  );
}

// ─── Legend row with color-synced bar ────────────────────────
function LegendRow({ color, name, value, total }: {
  color: string; name: string; value: number; total: number;
}) {
  const pct = Math.round(value / (total || 1) * 100);
  return (
    <div className="leg-row">
      <span className="leg-dot"  style={{ background: color }} />
      <span className="leg-name">{name}</span>
      <div  className="leg-bar-bg">
        <div className="leg-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="leg-val" style={{ color }}>{fmt(value)}</span>
      <span className="leg-pct">({pct}%)</span>
    </div>
  );
}

// ─── Health gauge (semicircle) ────────────────────────────────
function HealthGauge({ score }: { score: number }) {
  const R = 58, CX = 78, CY = 78;
  const color = score >= 80 ? C.revenue : score >= 60 ? C.profit : C.expense;
  const arc = (a1: number, a2: number, col: string, sw: number) => {
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    const x2 = CX + R * Math.cos(a2), y2 = CY + R * Math.sin(a2);
    const lg = a2 - a1 > Math.PI ? 1 : 0;
    return <path d={`M ${x1},${y1} A ${R},${R} 0 ${lg},1 ${x2},${y2}`}
      fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" />;
  };
  return (
    <svg viewBox="0 0 156 96" style={{ width: 156, height: 96 }}>
      {arc(Math.PI, 2 * Math.PI, 'rgba(28,43,74,.1)', 12)}
      {arc(Math.PI, Math.PI + (score / 100) * Math.PI, color, 12)}
      <text x={CX} y={CY - 2} textAnchor="middle" fontSize="26"
        fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fill={color}>{score}</text>
      <text x={CX} y={CY + 13} textAnchor="middle" fontSize="9" fill={C.muted}>/100</text>
    </svg>
  );
}

// ─── 6-month area chart ───────────────────────────────────────
function Chart6m({ data }: { data: MonthlyReport['monthly6'] }) {
  const W = 560, H = 188, P = { t: 30, r: 18, b: 30, l: 48 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b, n = data.length;
  const maxV = Math.max(...data.flatMap(d => [d.revenue, d.expense, d.profit]), 1) * 1.12;
  const xp = (i: number) => P.l + (i / (n - 1)) * cW;
  const yp = (v: number) => P.t + cH - Math.max(0, v / maxV) * cH;

  const smooth = (vals: number[], close = true) => {
    const pts = vals.map((v, i) => [xp(i), yp(v)] as [number, number]);
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i][0] + pts[i + 1][0]) / 2;
      d += ` C ${cx},${pts[i][1]} ${cx},${pts[i + 1][1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
    }
    if (close) d += ` L ${pts[n - 1][0]},${P.t + cH} L ${pts[0][0]},${P.t + cH} Z`;
    return d;
  };

  const ticks = [0, .25, .5, .75, 1].map(t => ({
    y: P.t + cH * (1 - t),
    label: t === 0 ? '0' : fmt(Math.round(maxV * t)),
  }));

  // Use C color tokens so chart is synced with KPI cards
  const lines = [
    { vals: data.map(d => d.expense), color: C.expense, w: 1.5, dash: '5 3', opacity: .25 },
    { vals: data.map(d => d.profit),  color: C.profit,  w: 2,   dash: '',    opacity: .45 },
    { vals: data.map(d => d.revenue), color: C.revenue, w: 2.5, dash: '',    opacity: .48 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        {lines.map(l => {
          const id = l.color.replace('#', '');
          return (
            <linearGradient key={id} id={`gc-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={l.color} stopOpacity={l.opacity} />
              <stop offset="100%" stopColor={l.color} stopOpacity=".02" />
            </linearGradient>
          );
        })}
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={P.l} y1={t.y} x2={W - P.r} y2={t.y}
            stroke="rgba(28,43,74,.07)" strokeWidth="1" strokeDasharray="4 3" />
          <text x={P.l - 5} y={t.y + 4} textAnchor="end" fontSize="9" fill={C.muted}>{t.label}</text>
        </g>
      ))}

      {lines.map(l => (
        <path key={l.color} d={smooth(l.vals)} fill={`url(#gc-${l.color.replace('#', '')})`} />
      ))}
      {lines.map(l => (
        <path key={l.color + 'line'} d={smooth(l.vals, false)} fill="none"
          stroke={l.color} strokeWidth={l.w}
          strokeDasharray={l.dash || undefined} strokeLinejoin="round" />
      ))}

      {data.map((d, i) => {
        const x = xp(i), yr = yp(d.revenue);
        return (
          <g key={d.label}>
            <circle cx={x} cy={yr} r="4" fill="white" stroke={C.revenue} strokeWidth="2" />
            <rect x={x - 22} y={yr - 25} width="44" height="16" rx="5"
              fill="white" stroke="rgba(28,43,74,.12)" strokeWidth="1" />
            <text x={x} y={yr - 12} textAnchor="middle" fontSize="8.5" fill={C.navy} fontWeight="500">
              {fmt(d.revenue)}
            </text>
            <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill={C.muted}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── KPI card ─────────────────────────────────────────────────
function KpiCard({
  label, value, prev, accentColor, tag, sub, sparkValues, positiveIsUp = true,
}: {
  label: string; value: number | string; prev?: number;
  accentColor: string; tag: string;
  sub?: string; sparkValues?: number[]; positiveIsUp?: boolean;
}) {
  const num = typeof value === 'number' ? value : 0;
  const d   = typeof prev === 'number' && prev > 0 ? pctChange(num, prev) : null;
  const good = d ? (positiveIsUp ? d.up : !d.up) : true;

  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-tag" style={{ background: accentColor + '1c', color: accentColor }}>{tag}</span>
      </div>
      {/* Value is colored with accentColor for visual sync with donut/bars */}
      <div className="kpi-val" style={{ color: accentColor }}>
        {typeof value === 'number' ? fmt(value) : value}
      </div>
      {d && (
        <div className="kpi-delta" style={{ color: good ? C.revenue : C.expense }}>
          {d.up ? '↑' : '↓'} {Math.abs(d.pct)}% so với tháng trước
        </div>
      )}
      {sub && <div className="kpi-sub">{sub}</div>}
      {sparkValues && (
        <div className="kpi-spark">
          <Sparkline values={sparkValues} color={accentColor} />
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function ReportView({ report }: Props) {
  const [chartPeriod, setChartPeriod] = useState<'6' | '12' | 'ytd'>('6');

  // ── Revenue donut: use revenueBySource (colors from category defs) ──
  const revSlices: Slice[] = (report.revenueBySource ?? [])
    .filter(s => s.amount > 0)
    .map(s => ({ label: s.source, value: s.amount, color: s.color }));

  // ── Expense donut: group by groupName, first category color per group ──
  const expSlices: Slice[] = (() => {
    const groups = new Map<string, { value: number; color: string }>();
    report.expenses.forEach(c => {
      const g = c.groupName ?? 'Khác';
      const ex = groups.get(g);
      if (ex) ex.value += c.amount;
      else groups.set(g, { value: c.amount, color: c.color });
    });
    return Array.from(groups.entries())
      .filter(([, { value }]) => value > 0)
      .map(([label, { value, color }]) => ({ label, value, color }));
  })();

  const channels = report.channelStats ?? [];
  const payouts  = report.upcomingPayouts ?? [];
  const services = report.topServices ?? [];
  const alerts   = report.costAlerts ?? [];

  const totalPayout = payouts.reduce((s, p) => s + p.amount, 0);

  const healthMetrics: HealthMetric[] = report.healthMetrics ?? [];
  const levelColor: Record<string, string> = {
    'Xuất sắc': C.revenue, 'Tốt': C.revenue, 'Trung bình': C.profit, 'Kém': C.expense,
  };

  // Sparkline series derived from monthly6
  const sp = {
    rev:  report.monthly6.map(m => m.revenue),
    exp:  report.monthly6.map(m => m.expense),
    prof: report.monthly6.map(m => m.profit),
    cf:   report.monthly6.map(m => Math.round(m.revenue * 0.87)),
    occ:  report.monthly6.map((_, i) => {
      const o = report.occupancyRate ?? 68;
      return Math.max(20, Math.min(100, o - (5 - i) * 4));
    }),
  };

  const chartData = chartPeriod === '12'
    ? report.monthly6


  return (
    <div className="rv">

      {/* ══ 5 KPI cards ══════════════════════════════════════ */}
      <div className="rv-kpi">
        <KpiCard label="DOANH THU"          tag="💵" accentColor={C.revenue}
          value={report.totalRevenue}      prev={report.prevMonthRevenue}
          sparkValues={sp.rev} />

        <KpiCard label="LỢI NHUẬN RÒNG"     tag="📈" accentColor={C.profit}
          value={report.netProfit}         prev={report.prevMonthProfit}
          sparkValues={sp.prof} />

        {/* NEW: Tổng chi phí — red accent, same row as profit */}
        <KpiCard label="TỔNG CHI PHÍ"        tag="📊" accentColor={C.expense}
          value={report.totalExpense}      prev={report.prevMonthExpense}
          sparkValues={sp.exp}             positiveIsUp={false} />

        <KpiCard label="CASHFLOW THỰC NHẬN"  tag="🏦" accentColor={C.cashflow}
          value={report.cashflowReceived ?? Math.round(report.totalRevenue * .86)}
          prev={Math.round((report.prevMonthRevenue ?? 0) * .86)}
          sparkValues={sp.cf}
          sub={`Chưa nhận: ${fmt(report.cashflowPending ?? 0)}`} />

        <KpiCard label="CÔNG SUẤT PHÒNG"     tag="🏡" accentColor={C.occupancy}
          value={`${report.occupancyRate ?? 68}%`}
          prev={Math.round((report.occupancyRate ?? 68) * 0.88)}
          sparkValues={sp.occ} />
      </div>

      {/* ══ Revenue: donut + chart ════════════════════════════ */}
      <div className="rv-mid">

        {/* Donut — colors sync with revenueBySource category colors */}
        <div className="rv-card">
          <div className="rv-title">DOANH THU THEO NGUỒN</div>
          <div className="rv-donut-row">
            <Donut slices={revSlices} label={fmt(report.totalRevenue)} sub="Tổng doanh thu" />
            <div className="rv-legend">
              {revSlices.map(sl => (
                <LegendRow key={sl.label} color={sl.color}
                  name={sl.label} value={sl.value} total={report.totalRevenue} />
              ))}
            </div>
          </div>
          {revSlices.length > 0 && (
            <div className="rv-hint"
              style={{ color: revSlices[0].color, background: revSlices[0].color + '0e', borderColor: revSlices[0].color + '35' }}>
              {revSlices[0].label} là nguồn doanh thu lớn nhất tháng này.
            </div>
          )}
        </div>

        {/* Area chart — uses C.revenue / C.profit / C.expense (same tokens as KPI) */}
        <div className="rv-card rv-chart-card">
          <div className="rv-chart-hdr">
            <span className="rv-title" style={{ marginBottom: 0 }}>DOANH THU &amp; LỢI NHUẬN</span>
            <div className="rv-chart-legend">
              {[
                { color: C.revenue, label: 'Doanh thu', dash: false },
                { color: C.profit,  label: 'Lợi nhuận', dash: false },
                { color: C.expense, label: 'Chi phí',   dash: true  },
              ].map(l => (
                <span key={l.label} className="rv-leg-item">
                  <svg width="18" height="8">
                    {l.dash
                      ? <line x1="0" y1="4" x2="18" y2="4" stroke={l.color} strokeWidth="2" strokeDasharray="4 2" />
                      : <path d="M0,7 Q9,1 18,7" fill={l.color} fillOpacity=".3" stroke={l.color} strokeWidth="1.5" />}
                  </svg>
                  {l.label}
                </span>
              ))}
            </div>
            <div className="rv-period-tabs">
              {(['6', '12', 'ytd'] as const).map(p => (
                <button key={p} className={`rv-period-btn${chartPeriod === p ? ' active' : ''}`}
                  onClick={() => setChartPeriod(p)}>
                  {p === '6' ? '6 tháng' : p === '12' ? '12 tháng' : 'Năm nay'}
                </button>
              ))}
            </div>
          </div>
          <Chart6m data={chartData} />
        </div>
      </div>

      {/* ══ Chi phí section ═══════════════════════════════════ */}
      <div className="rv-card rv-exp-card">
        <div className="rv-exp-grid">

          {/* Left: summary — red accent matching KPI */}
          <div className="rv-exp-col rv-exp-col--first">
            <div className="rv-title">CHI PHÍ</div>
            <div className="rv-exp-sub">Tổng chi phí tháng {report.month}</div>
            <div className="rv-exp-total" style={{ color: C.expense }}>
              {fmt(report.totalExpense)}
            </div>
            {(() => {
              const d = pctChange(report.totalExpense, report.prevMonthExpense);
              return d ? (
                <div className="kpi-delta" style={{ color: d.up ? C.expense : C.revenue }}>
                  {d.up ? '↑' : '↓'} {Math.abs(d.pct)}% so với tháng trước
                </div>
              ) : null;
            })()}
          </div>

          {/* Middle: donut — colors from expense category groupName */}
          <div className="rv-exp-col rv-exp-col--mid">
            <div className="rv-title">CHI PHÍ THEO DANH MỤC</div>
            <div className="rv-donut-row rv-donut-row--sm">
              <Donut slices={expSlices} />
              <div className="rv-legend">
                {expSlices.map(sl => (
                  <LegendRow key={sl.label} color={sl.color}
                    name={sl.label} value={sl.value} total={report.totalExpense} />
                ))}
              </div>
            </div>
          </div>

          {/* Right: alerts — border-left color from category */}
          <div className="rv-exp-col">
            <div className="rv-title">CẢNH BÁO CHI PHÍ</div>
            <div className="rv-alerts">
              {alerts.length === 0
                ? <div style={{ fontSize: '.78rem', color: C.muted, padding: '8px 0' }}>Không có cảnh báo.</div>
                : alerts.map((al, i) => (
                    <div key={i} className={`rv-alert${al.pctChange > 30 ? ' rv-alert--warn' : ''}`}
                      style={{ borderLeftColor: al.color }}>
                      <span className="rv-alert-icon">{al.icon}</span>
                      <div className="rv-alert-body">
                        <div className="rv-alert-name">{al.name}</div>
                        <div className="rv-alert-reason">{al.reason}</div>
                      </div>
                      <div className="rv-alert-amt"
                        style={{ color: al.pctChange > 0 ? C.expense : C.revenue }}>
                        {fmt(al.amount)}{al.pctChange > 0 ? ' ↑' : ' ↓'}
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* ══ Sức khỏe tài chính ════════════════════════════════ */}
      <div className="rv-card">
        <div className="rv-title">SỨC KHỎE TÀI CHÍNH VILLA</div>
        <div className="rv-health-grid">

          <div className="rv-health-left">
            <HealthGauge score={report.healthScore ?? 82} />
            <div className="rv-health-badge"
              style={{ color: (report.healthScore ?? 82) >= 80 ? C.revenue : (report.healthScore ?? 82) >= 60 ? C.profit : C.expense }}>
              😊 {report.healthLabel ?? 'Tốt'}
            </div>
            <div className="rv-health-tagline">
              {(report.healthScore ?? 82) >= 80
                ? 'Villa của bạn đang hoạt động rất hiệu quả!'
                : 'Có thể cải thiện thêm.'}
            </div>
            <div className="rv-health-hint">
              {report.healthTip ?? 'Duy trì các chỉ số hiện tại để tối ưu lợi nhuận.'}
            </div>
          </div>

          <div className="rv-health-metrics">
            {healthMetrics.map((m, i) => (
              <div key={i} className="rv-hm-row">
                <span className="rv-hm-icon">{m.icon}</span>
                <span className="rv-hm-label">{m.label}</span>
                <span className="rv-hm-val"
                  style={{ color: levelColor[m.value] ?? C.muted }}>{m.value}</span>
              </div>
            ))}
          </div>

          <div className="rv-health-tip">
            <div className="rv-tip-icon">💡</div>
            <div className="rv-tip-title">GỢI Ý TỐI ƯU</div>
            <div className="rv-tip-body">
              {report.healthTip ?? 'Bạn có thể tăng doanh thu bằng cách tăng giá phòng vào cuối tuần.'}
            </div>
            <button className="rv-tip-btn">Xem chi tiết →</button>
          </div>
        </div>
      </div>

      {/* ══ Bottom row ════════════════════════════════════════ */}
      <div className="rv-bottom">

        {/* Payouts */}
        <div className="rv-card">
          <div className="rv-title">PAYOUT SẮP TỚI</div>
          <div className="rv-payout-sub">Tổng sắp nhận</div>
          <div className="rv-payout-total" style={{ color: C.cashflow }}>{fmt(totalPayout)}</div>
          {payouts.map((p, i) => {
            const ch  = channels.find(c => c.source === p.source);
            const col = ch?.color ?? C.cashflow;
            return (
              <div key={i} className="rv-payout-row">
                <span className="rv-payout-icon" style={{ background: col + '1a', color: col }}>💳</span>
                <div className="rv-payout-info">
                  <span className="rv-payout-ch">{p.source}</span>
                  <span className="rv-payout-date">{p.expectedDate}</span>
                </div>
                <span className="rv-payout-amt" style={{ color: C.cashflow }}>{fmt(p.amount)}</span>
              </div>
            );
          })}
          <button className="rv-see-all">Xem tất cả</button>
        </div>

        {/* Channel performance */}
        <div className="rv-card">
          <div className="rv-title">HIỆU SUẤT KÊNH BÁN</div>
          <table className="rv-ch-tbl">
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
              {channels.map((ch, i) => (
                <tr key={i}>
                  <td>
                    <span className="rv-ch-dot" style={{ background: ch.color }} />
                    {ch.source}
                  </td>
                  <td>
                    <span style={{ color: C.revenue, fontFamily: 'Georgia,serif', fontStyle: 'italic', fontWeight: 600 }}>
                      {fmt(ch.revenue)}
                    </span>
                  </td>
                  <td>{ch.pct}%</td>
                  <td>{fmt(ch.adr)}</td>
                  <td>
                    <div className="rv-occ-track">
                      <div className="rv-occ-fill" style={{ width: `${ch.occupancy}%`, background: ch.color }} />
                    </div>
                    <span className="rv-occ-pct">{ch.occupancy}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="rv-see-all">Xem chi tiết hiệu suất</button>
        </div>

        {/* Top services */}
        <div className="rv-card">
          <div className="rv-title">TOP DỊCH VỤ THÊM</div>
          {services.map((s, i) => (
            <div key={i} className="rv-svc-row">
              <span className="rv-svc-icon">{s.icon}</span>
              <span className="rv-svc-name">{s.name}</span>
              <span className="rv-svc-amt" style={{ color: C.revenue }}>{fmt(s.amount)}</span>
            </div>
          ))}
          <button className="rv-see-all" style={{ marginTop: 8 }}>Xem tất cả</button>
        </div>
      </div>

      {/* ════════════════ STYLES ════════════════ */}
      <style>{`
        .rv { display:flex; flex-direction:column; gap:14px; }

        /* Card base */
        .rv-card {
          background:#fff; border:1px solid ${C.border};
          border-radius:16px; padding:18px 20px;
        }
        .rv-title {
          font-size:.62rem; font-weight:700; letter-spacing:.1em;
          text-transform:uppercase; color:${C.muted}; margin-bottom:12px;
        }

        /* ── 5 KPI cards ── */
        .rv-kpi { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
        .kpi-card {
          background:#fff; border:1px solid ${C.border};
          border-radius:16px; padding:14px 16px;
          display:flex; flex-direction:column; gap:2px;
        }
        .kpi-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:3px; }
        .kpi-label {
          font-size:.57rem; font-weight:700; letter-spacing:.07em;
          color:${C.muted}; text-transform:uppercase; line-height:1.4; flex:1;
        }
        .kpi-tag {
          padding:3px 7px; border-radius:20px; font-size:.8rem;
          line-height:1; flex-shrink:0; margin-left:4px;
        }
        /* kpi-val color is set inline (accentColor) for full sync */
        .kpi-val {
          font-family:Georgia,serif; font-style:italic;
          font-size:1.5rem; font-weight:700; line-height:1.1;
        }
        .kpi-delta { font-size:.68rem; margin-top:2px; }
        .kpi-sub   { font-size:.65rem; color:${C.muted}; margin-top:2px; }
        .kpi-spark { margin-top:6px; }

        /* ── Mid: donut + chart ── */
        .rv-mid { display:grid; grid-template-columns:290px 1fr; gap:12px; }
        .rv-donut-row { display:flex; align-items:center; gap:10px; }
        .rv-donut-row--sm { gap:8px; }
        .rv-hint { margin-top:10px; padding:7px 11px; border-radius:8px; border:1px solid; font-size:.73rem; font-weight:500; }

        /* Legend — bar color injected inline */
        .rv-legend { display:flex; flex-direction:column; gap:7px; flex:1; min-width:0; }
        .leg-row { display:flex; align-items:center; gap:5px; }
        .leg-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .leg-name { font-size:.73rem; color:${C.navy}; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .leg-bar-bg { width:36px; height:4px; background:rgba(28,43,74,.09); border-radius:2px; flex-shrink:0; }
        .leg-bar-fill { height:4px; border-radius:2px; }
        .leg-val { font-family:Georgia,serif; font-style:italic; font-size:.73rem; color:${C.navy}; flex-shrink:0; }
        .leg-pct { font-size:.63rem; color:${C.muted}; min-width:30px; flex-shrink:0; }

        /* Chart */
        .rv-chart-card { display:flex; flex-direction:column; }
        .rv-chart-hdr { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
        .rv-chart-hdr .rv-title { margin-bottom:0; }
        .rv-chart-legend { display:flex; gap:10px; flex-wrap:wrap; }
        .rv-leg-item { display:flex; align-items:center; gap:4px; font-size:.67rem; color:${C.muted}; }
        .rv-period-tabs { display:flex; gap:2px; background:rgba(28,43,74,.06); border-radius:6px; padding:2px; margin-left:auto; }
        .rv-period-btn {
          padding:4px 10px; border-radius:4px; border:none;
          background:transparent; font-size:.7rem; color:${C.muted}; cursor:pointer; transition:all .12s;
        }
        .rv-period-btn.active {
          background:#fff; color:${C.navy}; font-weight:500;
          box-shadow:0 1px 3px rgba(28,43,74,.1);
        }

        /* ── Expense card ── */
        .rv-exp-card { padding:0; overflow:hidden; }
        .rv-exp-grid { display:grid; grid-template-columns:168px 1fr 1fr; }
        .rv-exp-col { padding:18px 20px; }
        .rv-exp-col--first { border-right:0.5px solid ${C.border}; }
        .rv-exp-col--mid   { border-right:0.5px solid ${C.border}; }
        .rv-exp-sub   { font-size:.7rem; color:${C.muted}; margin-bottom:5px; }
        .rv-exp-total { font-family:Georgia,serif; font-style:italic; font-size:1.4rem; font-weight:700; }

        /* Alerts */
        .rv-alerts { display:flex; flex-direction:column; gap:7px; }
        .rv-alert {
          display:flex; align-items:center; gap:9px;
          padding:9px 11px; border-radius:9px;
          background:rgba(28,43,74,.03); border-left:3px solid transparent;
        }
        .rv-alert--warn { background:rgba(254,243,199,.55); }
        .rv-alert-icon   { font-size:.95rem; flex-shrink:0; }
        .rv-alert-body   { flex:1; }
        .rv-alert-name   { font-size:.79rem; font-weight:500; color:${C.navy}; }
        .rv-alert-reason { font-size:.65rem; color:${C.muted}; margin-top:1px; }
        .rv-alert-amt    { font-family:Georgia,serif; font-style:italic; font-size:.85rem; font-weight:700; flex-shrink:0; }

        /* ── Health ── */
        .rv-health-grid { display:grid; grid-template-columns:195px 1fr 210px; gap:18px; }
        .rv-health-left { display:flex; flex-direction:column; align-items:center; gap:5px; text-align:center; }
        .rv-health-badge   { font-size:.78rem; font-weight:700; }
        .rv-health-tagline { font-size:.82rem; font-weight:600; color:${C.navy}; line-height:1.4; margin-top:2px; }
        .rv-health-hint    { font-size:.72rem; color:${C.muted}; line-height:1.5; }
        .rv-health-metrics { display:flex; flex-direction:column; justify-content:center; }
        .rv-hm-row {
          display:flex; align-items:center; gap:9px;
          padding:9px 0; border-bottom:0.5px solid ${C.border};
        }
        .rv-hm-row:last-child { border-bottom:none; }
        .rv-hm-icon  { font-size:.95rem; width:18px; text-align:center; }
        .rv-hm-label { font-size:.79rem; color:#4A5568; flex:1; }
        .rv-hm-val   { font-size:.78rem; font-weight:700; }
        .rv-health-tip {
          background:rgba(201,168,76,.06); border:1px solid rgba(201,168,76,.22);
          border-radius:12px; padding:15px; display:flex; flex-direction:column; gap:7px;
        }
        .rv-tip-icon  { font-size:1.2rem; }
        .rv-tip-title {
          font-size:.62rem; font-weight:700; letter-spacing:.08em;
          color:${C.profit}; text-transform:uppercase;
        }
        .rv-tip-body  { font-size:.78rem; color:#4A5568; line-height:1.6; flex:1; }
        .rv-tip-btn {
          padding:7px 14px; border-radius:7px; background:${C.navy}; color:#fff;
          border:none; font-size:.75rem; cursor:pointer; align-self:flex-start; transition:opacity .15s;
        }
        .rv-tip-btn:hover { opacity:.82; }

        /* ── Bottom row ── */
        .rv-bottom { display:grid; grid-template-columns:1fr 1.7fr 1fr; gap:12px; }

        .rv-payout-sub   { font-size:.7rem; color:${C.muted}; }
        .rv-payout-total { font-family:Georgia,serif; font-style:italic; font-size:1.3rem; font-weight:700; margin-bottom:10px; }
        .rv-payout-row   { display:flex; align-items:center; gap:9px; margin-bottom:8px; }
        .rv-payout-icon  {
          width:28px; height:28px; border-radius:7px;
          display:flex; align-items:center; justify-content:center; font-size:.85rem; flex-shrink:0;
        }
        .rv-payout-info  { flex:1; display:flex; flex-direction:column; gap:1px; }
        .rv-payout-ch    { font-size:.78rem; font-weight:500; color:${C.navy}; }
        .rv-payout-date  { font-size:.65rem; color:${C.muted}; }
        .rv-payout-amt   { font-family:Georgia,serif; font-style:italic; font-size:.85rem; font-weight:600; }

        .rv-ch-tbl { width:100%; border-collapse:collapse; margin-bottom:10px; }
        .rv-ch-tbl th {
          font-size:.61rem; font-weight:700; color:${C.muted}; text-align:left;
          padding:5px 7px; border-bottom:1px solid ${C.border};
          text-transform:uppercase; letter-spacing:.05em;
        }
        .rv-ch-tbl td {
          font-size:.78rem; color:${C.navy};
          padding:7px 7px; border-bottom:0.5px solid rgba(28,43,74,.04);
        }
        .rv-ch-tbl tr:last-child td { border-bottom:none; }
        .rv-ch-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align:middle; }
        .rv-occ-track { display:inline-block; width:44px; height:4px; background:rgba(28,43,74,.08); border-radius:2px; margin-right:4px; vertical-align:middle; }
        .rv-occ-fill  { height:4px; border-radius:2px; }
        .rv-occ-pct   { font-size:.7rem; color:#4A5568; vertical-align:middle; }

        .rv-svc-row  {
          display:flex; align-items:center; gap:7px;
          padding:7px 0; border-bottom:0.5px solid ${C.border};
        }
        .rv-svc-row:last-of-type { border-bottom:none; }
        .rv-svc-icon { font-size:.95rem; width:18px; }
        .rv-svc-name { font-size:.8rem; color:${C.navy}; flex:1; }
        .rv-svc-amt  { font-family:Georgia,serif; font-style:italic; font-size:.8rem; font-weight:700; }

        .rv-see-all {
          width:100%; padding:8px; border-radius:7px; margin-top:4px;
          border:1px solid ${C.border}; background:none;
          font-size:.75rem; color:${C.muted}; cursor:pointer; transition:background .12s;
        }
        .rv-see-all:hover { background:rgba(28,43,74,.04); color:${C.navy}; }

        /* ── Responsive ── */
        @media (max-width:960px) {
          .rv-kpi { grid-template-columns:repeat(3,1fr); }
          .rv-mid { grid-template-columns:1fr; }
          .rv-exp-grid { grid-template-columns:1fr; }
          .rv-exp-col--first { border-right:none; border-bottom:0.5px solid ${C.border}; }
          .rv-exp-col--mid   { border-right:none; border-bottom:0.5px solid ${C.border}; }
          .rv-health-grid { grid-template-columns:1fr; }
          .rv-bottom { grid-template-columns:1fr; }
        }
        @media (max-width:560px) {
          .rv-kpi { grid-template-columns:repeat(2,1fr); }
          .kpi-val { font-size:1.25rem; }
        }
        @media (max-width:360px) {
          .rv-kpi { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}

