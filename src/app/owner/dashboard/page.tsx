// VillaOS — app/owner/dashboard/page.tsx
import { getServerSession }  from '@/lib/supabase/server';
import { getVillas }         from '@/lib/services/villa.service';
import { redirect }          from 'next/navigation';
import Link                  from 'next/link';
import { fmtMoney, formatDate, calcNights, todayISO } from '@/lib/utils';
import type { Villa } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function OwnerDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();

  const { data: _villas } = await getVillas();
  const villas: Villa[] = _villas ?? [];

  // Tất cả bookings không cancelled, bao gồm cả hold hết hạn để hiển thị lịch sử
  const { data: _all } = await sb
    .from('bookings')
    .select('*')
    .neq('status', 'cancelled')
    .order('checkin', { ascending: false });
  const allBookings: any[] = _all ?? [];

  // Lịch sử (bao gồm cancelled) — 30 bản ghi gần nhất
  const { data: _history } = await sb
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const historyBookings: any[] = _history ?? [];

  const today      = todayISO();
  const thisMonth  = today.slice(0, 7);
  const lastMonth  = (() => {
    const d = new Date(today);
    d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  const thisYear   = today.slice(0, 4);

  const confirmedB = allBookings.filter(b => b.status === 'confirmed');
  const holdB      = allBookings.filter(b => {
    if (b.status !== 'hold') return false;
    if (!b.hold_expires_at) return true;
    return new Date(b.hold_expires_at) > new Date();
  });

  // ── Check-in sắp tới (14 ngày) ──────────────────────────────
  const in14 = new Date(today);
  in14.setDate(in14.getDate() + 14);
  const in14Str  = in14.toISOString().slice(0, 10);
  const upcoming = confirmedB
    .filter(b => b.checkin >= today && b.checkin <= in14Str)
    .sort((a, b) => a.checkin.localeCompare(b.checkin));

  // ── Doanh thu ────────────────────────────────────────────────
  const revThisMonth = confirmedB
    .filter(b => b.checkin.startsWith(thisMonth))
    .reduce((s: number, b: any) => s + (b.total ?? 0), 0);

  const revLastMonth = confirmedB
    .filter(b => b.checkin.startsWith(lastMonth))
    .reduce((s: number, b: any) => s + (b.total ?? 0), 0);

  const revThisYear = confirmedB
    .filter(b => b.checkin.startsWith(thisYear))
    .reduce((s: number, b: any) => s + (b.total ?? 0), 0);

  const revByVilla = villas.map(v => ({
    villa: v,
    thisMonth: confirmedB
      .filter(b => b.villa_id === v.id && b.checkin.startsWith(thisMonth))
      .reduce((s: number, b: any) => s + (b.total ?? 0), 0),
    lastMonth: confirmedB
      .filter(b => b.villa_id === v.id && b.checkin.startsWith(lastMonth))
      .reduce((s: number, b: any) => s + (b.total ?? 0), 0),
    total: confirmedB
      .filter(b => b.villa_id === v.id)
      .reduce((s: number, b: any) => s + (b.total ?? 0), 0),
    nights: confirmedB
      .filter(b => b.villa_id === v.id && b.checkin.startsWith(thisMonth))
      .reduce((s: number, b: any) => s + calcNights(b.checkin, b.checkout), 0),
    bookingCount: confirmedB.filter(b => b.villa_id === v.id && b.checkin.startsWith(thisMonth)).length,
  })).sort((a, b) => b.thisMonth - a.thisMonth);

  // Doanh thu theo tháng (6 tháng gần nhất)
  const monthlyRev: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(1); d.setMonth(d.getMonth() - i);
    const key   = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
    const value = confirmedB
      .filter(b => b.checkin.startsWith(key))
      .reduce((s: number, b: any) => s + (b.total ?? 0), 0);
    monthlyRev.push({ label, value });
  }
  const maxRev = Math.max(...monthlyRev.map(m => m.value), 1);

  return (
    <div className="dashboard">

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Xin chào, {profile.name} 👋</h1>
          <p className="dash-sub">
            {new Date().toLocaleDateString('vi-VN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <Link href="/owner/calendar" className="btn-primary">📅 Lịch đặt phòng</Link>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* 1. CHECK-IN SẮP TỚI                                  */}
      {/* ══════════════════════════════════════════════════════ */}
      <section className="dash-section">
        <div className="section-header">
          <h2>📆 Check-in sắp tới <span className="sub-label">14 ngày tới</span></h2>
          <span className="badge-pill">{upcoming.length} lịch</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="empty-text">Không có check-in nào trong 14 ngày tới.</p>
        ) : (
          <div className="upcoming-list">
            {upcoming.map(b => {
              const v = villas.find(x => x.id === b.villa_id);
              const nights = calcNights(b.checkin, b.checkout);
              const isToday = b.checkin === today;
              const isTomorrow = b.checkin === (() => { const d = new Date(today); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
              return (
                <div key={b.id} className={`upcoming-row${isToday ? ' upcoming-today' : ''}`}>
                  <div className="upcoming-left">
                    <div className="upcoming-emoji">{v?.emoji ?? '🏡'}</div>
                    <div>
                      <div className="upcoming-customer">{b.customer}</div>
                      <div className="upcoming-meta">
                        {v?.name} · 📞 {b.phone}
                      </div>
                    </div>
                  </div>
                  <div className="upcoming-mid">
                    <div className="upcoming-dates">
                      {formatDate(b.checkin)} → {formatDate(b.checkout)}
                    </div>
                    <div className="upcoming-nights">{nights} đêm</div>
                  </div>
                  <div className="upcoming-right">
                    <div className="upcoming-total">{fmtMoney(b.total)}</div>
                    {isToday && <span className="tag tag-today">Hôm nay</span>}
                    {isTomorrow && !isToday && <span className="tag tag-tomorrow">Ngày mai</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════ */}

      {/* 3. DOANH THU CHI TIẾT                                */}
      {/* ══════════════════════════════════════════════════════ */}
      <section className="dash-section">
        <div className="section-header">
          <h2>💰 Doanh thu</h2>
        </div>

        {/* Tổng quan 3 con số */}
        <div className="rev-summary">
          <div className="rev-card rev-card--month">
            <div className="rev-card__label">Tháng này</div>
            <div className="rev-card__value">{fmtMoney(revThisMonth)}</div>
            {revLastMonth > 0 && (
              <div className={`rev-card__delta ${revThisMonth >= revLastMonth ? 'delta-up' : 'delta-down'}`}>
                {revThisMonth >= revLastMonth ? '▲' : '▼'}&nbsp;
                {revLastMonth > 0
                  ? `${Math.abs(Math.round((revThisMonth - revLastMonth) / revLastMonth * 100))}% so tháng trước`
                  : 'Tháng trước chưa có dữ liệu'
                }
              </div>
            )}
          </div>
          <div className="rev-card">
            <div className="rev-card__label">Tháng trước</div>
            <div className="rev-card__value">{fmtMoney(revLastMonth)}</div>
          </div>
          <div className="rev-card">
            <div className="rev-card__label">Năm {thisYear}</div>
            <div className="rev-card__value">{fmtMoney(revThisYear)}</div>
          </div>
        </div>

        {/* Biểu đồ cột 6 tháng */}
        <div className="rev-chart-wrap">
          <div className="rev-chart__title">Doanh thu 6 tháng gần nhất</div>
          <div className="rev-chart">
            {monthlyRev.map((m, i) => (
              <div key={i} className="rev-bar-col">
                <div className="rev-bar-amount">{m.value > 0 ? fmtMoney(m.value) : ''}</div>
                <div className="rev-bar-track">
                  <div
                    className={`rev-bar${m.label === monthlyRev[5].label ? ' rev-bar--current' : ''}`}
                    style={{ height: `${Math.round((m.value / maxRev) * 100)}%` }}
                  />
                </div>
                <div className="rev-bar-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Doanh thu theo từng villa */}
        <div className="rev-villa-title">Chi tiết theo villa — tháng {thisMonth.slice(5)}/{thisMonth.slice(0,4)}</div>
        <div className="rev-villa-list">
          {revByVilla.map(({ villa: v, thisMonth: tm, lastMonth: lm, total, nights, bookingCount }) => (
            <div key={v.id} className="rev-villa-row">
              <div className="rev-villa-left">
                <span className="rev-villa-emoji">{v.emoji}</span>
                <div>
                  <div className="rev-villa-name">{v.name}</div>
                  <div className="rev-villa-meta">
                    {bookingCount} booking · {nights} đêm tháng này
                  </div>
                </div>
              </div>
              <div className="rev-villa-right">
                <div className="rev-villa-month">{fmtMoney(tm)}</div>
                <div className="rev-villa-sub">
                  {lm > 0 && (
                    <span className={tm >= lm ? 'delta-up' : 'delta-down'}>
                      {tm >= lm ? '▲' : '▼'} {lm > 0 ? `${Math.abs(Math.round((tm-lm)/lm*100))}%` : ''}
                    </span>
                  )}
                  &nbsp;Cộng dồn: {fmtMoney(total)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. LỊCH SỬ HOLD & BOOKING                            */}
      {/* ══════════════════════════════════════════════════════ */}
      <section className="dash-section">
        <div className="section-header">
          <h2>📋 Lịch sử Hold & Booking</h2>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {holdB.length > 0 && (
              <span className="badge-pill badge-amber">⏳ {holdB.length} hold đang chờ</span>
            )}
          </div>
        </div>
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Khách</th>
                <th>Villa</th>
                <th>Check-in / out</th>
                <th>Đêm</th>
                <th>Tổng</th>
                <th>Trạng thái</th>
                <th>Tạo bởi</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {historyBookings.map(b => {
                const v       = villas.find(x => x.id === b.villa_id);
                const nights  = calcNights(b.checkin, b.checkout);
                const isExpiredHold = b.status === 'hold' && b.hold_expires_at && new Date(b.hold_expires_at) < new Date();
                return (
                  <tr key={b.id} className={b.status === 'cancelled' ? 'row-cancelled' : ''}>
                    <td>
                      <div className="cell-name">{b.customer}</div>
                      <div className="cell-sub">📞 {b.phone}</div>
                    </td>
                    <td>
                      <div className="cell-name">{v?.emoji} {v?.name ?? '—'}</div>
                    </td>
                    <td>
                      <div className="cell-name">{formatDate(b.checkin)}</div>
                      <div className="cell-sub">→ {formatDate(b.checkout)}</div>
                    </td>
                    <td className="cell-center">{nights}</td>
                    <td className="cell-money">{fmtMoney(b.total)}</td>
                    <td>
                      {b.status === 'confirmed' && <span className="tag tag-confirm">✅ Confirmed</span>}
                      {b.status === 'hold' && !isExpiredHold && <span className="tag tag-hold">⏳ Hold</span>}
                      {b.status === 'hold' && isExpiredHold && <span className="tag tag-expired">⌛ Hết hạn</span>}
                      {b.status === 'cancelled' && <span className="tag tag-cancel">✕ Đã hủy</span>}
                    </td>
                    <td>
                      <div className="cell-name">{b.created_by_name ?? '—'}</div>
                      <div className="cell-sub">{b.created_by_role}</div>
                    </td>
                    <td className="cell-sub">
                      {new Date(b.created_at).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .dashboard { display:flex; flex-direction:column; gap:24px; }

        /* Header */
        .dash-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .dash-title  { font-size:1.5rem; font-weight:700; color:var(--forest-deep); margin:0; }
        .dash-sub    { font-size:0.85rem; color:var(--ink-muted); margin:2px 0 0; text-transform:capitalize; }

        /* Section */
        .dash-section {
          background:var(--white);
          border-radius:var(--radius-lg);
          border:1px solid rgba(180,212,195,.25);
          padding:20px;
        }
        .section-header {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:16px;
        }
        .section-header h2 { font-size:1rem; font-weight:700; color:var(--forest-deep); margin:0; }
        .sub-label { font-size:0.75rem; font-weight:400; color:var(--ink-muted); margin-left:6px; }

        /* Pills / badges */
        .badge-pill {
          display:inline-block; padding:3px 10px; border-radius:99px;
          font-size:0.72rem; font-weight:600;
          background:var(--sage-pale); color:var(--forest);
        }
        .badge-amber { background:var(--amber-light); color:#92400e; }

        /* ── 1. UPCOMING ── */
        .upcoming-list { display:flex; flex-direction:column; gap:0; }
        .upcoming-row {
          display:flex; align-items:center; gap:14px;
          padding:11px 0;
          border-bottom:1px solid var(--sage-pale);
        }
        .upcoming-row:last-child { border-bottom:none; }
        .upcoming-today { background:rgba(180,212,195,.12); border-radius:10px; padding:11px 10px; margin:0 -10px; }
        .upcoming-left  { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .upcoming-emoji { font-size:1.5rem; flex-shrink:0; }
        .upcoming-customer { font-weight:600; font-size:0.88rem; color:var(--forest-deep); }
        .upcoming-meta     { font-size:0.75rem; color:var(--ink-muted); margin-top:1px; }
        .upcoming-mid      { flex:0 0 auto; text-align:center; }
        .upcoming-dates    { font-size:0.8rem; font-weight:500; color:var(--forest-deep); white-space:nowrap; }
        .upcoming-nights   { font-size:0.72rem; color:var(--ink-muted); }
        .upcoming-right    { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
        .upcoming-total    { font-weight:700; font-size:0.9rem; color:var(--forest); }

        /* tags */
        .tag { display:inline-block; padding:2px 8px; border-radius:99px; font-size:0.68rem; font-weight:700; white-space:nowrap; }
        .tag-today    { background:#dcfce7; color:#166534; }
        .tag-tomorrow { background:#fef9c3; color:#854d0e; }
        .tag-confirm  { background:#dcfce7; color:#166534; }
        .tag-hold     { background:#fef3c7; color:#92400e; }
        .tag-expired  { background:#f3f4f6; color:#6b7280; }
        .tag-cancel   { background:#fee2e2; color:#991b1b; }

        /* ── 2. HISTORY TABLE ── */
        .history-table-wrap { overflow-x:auto; }
        .history-table {
          width:100%; border-collapse:collapse;
          font-size:0.82rem; min-width:700px;
        }
        .history-table thead tr {
          background:var(--parchment);
          border-bottom:2px solid var(--sage-pale);
        }
        .history-table th {
          padding:8px 12px; text-align:left;
          font-size:0.72rem; font-weight:700;
          color:var(--ink-muted); text-transform:uppercase; letter-spacing:.04em;
          white-space:nowrap;
        }
        .history-table td { padding:10px 12px; border-bottom:1px solid var(--sage-pale); vertical-align:middle; }
        .history-table tr:last-child td { border-bottom:none; }
        .history-table tr:hover td { background:rgba(180,212,195,.07); }
        .row-cancelled td { opacity:.5; }
        .cell-name   { font-weight:600; color:var(--forest-deep); line-height:1.4; }
        .cell-sub    { font-size:0.72rem; color:var(--ink-muted); margin-top:1px; }
        .cell-center { text-align:center; font-weight:600; }
        .cell-money  { text-align:right; font-weight:700; color:var(--forest); white-space:nowrap; }

        /* ── 3. REVENUE ── */
        .rev-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px; }
        @media(max-width:600px){ .rev-summary{ grid-template-columns:1fr; } }
        .rev-card {
          border:1px solid var(--sage-pale); border-radius:var(--radius-md);
          padding:16px 18px; display:flex; flex-direction:column; gap:4px;
        }
        .rev-card--month { border-color:var(--forest); background:rgba(180,212,195,.08); }
        .rev-card__label { font-size:0.75rem; font-weight:600; color:var(--ink-muted); text-transform:uppercase; letter-spacing:.04em; }
        .rev-card__value { font-size:1.5rem; font-weight:800; color:var(--forest-deep); line-height:1.2; }
        .rev-card__delta { font-size:0.75rem; font-weight:600; }
        .delta-up   { color:#16a34a; }
        .delta-down { color:#dc2626; }

        /* Bar chart */
        .rev-chart-wrap { margin-bottom:24px; }
        .rev-chart__title { font-size:0.78rem; font-weight:600; color:var(--ink-muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:.04em; }
        .rev-chart { display:flex; gap:12px; align-items:flex-end; height:140px; padding-bottom:0; }
        .rev-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; }
        .rev-bar-amount { font-size:0.62rem; color:var(--ink-muted); text-align:center; line-height:1.2; min-height:16px; }
        .rev-bar-track { flex:1; width:100%; display:flex; align-items:flex-end; }
        .rev-bar {
          width:100%; border-radius:6px 6px 0 0;
          background:var(--sage); min-height:4px;
          transition:height .3s;
        }
        .rev-bar--current { background:var(--forest); }
        .rev-bar-label { font-size:0.72rem; color:var(--ink-muted); white-space:nowrap; }

        /* Villa breakdown */
        .rev-villa-title { font-size:0.78rem; font-weight:700; color:var(--ink-muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:12px; }
        .rev-villa-list  { display:flex; flex-direction:column; gap:0; }
        .rev-villa-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 0; border-bottom:1px solid var(--sage-pale);
        }
        .rev-villa-row:last-child { border-bottom:none; }
        .rev-villa-left  { display:flex; align-items:center; gap:12px; flex:1; }
        .rev-villa-emoji { font-size:1.6rem; }
        .rev-villa-name  { font-weight:600; font-size:0.88rem; color:var(--forest-deep); }
        .rev-villa-meta  { font-size:0.73rem; color:var(--ink-muted); margin-top:2px; }
        .rev-villa-right { text-align:right; flex-shrink:0; }
        .rev-villa-month { font-weight:800; font-size:1rem; color:var(--forest-deep); }
        .rev-villa-sub   { font-size:0.72rem; color:var(--ink-muted); margin-top:2px; }

        /* Buttons */
        .btn-primary {
          display:inline-flex; align-items:center; gap:6px;
          padding:10px 18px; background:var(--forest); color:var(--white);
          border-radius:var(--radius-md); font-size:0.875rem; font-weight:600;
          text-decoration:none; transition:background .12s, transform .1s;
          border:none; cursor:pointer;
        }
        .btn-primary:hover { background:var(--forest-deep); transform:translateY(-1px); }
        .empty-text { font-size:0.82rem; color:var(--ink-muted); margin:0; }
      `}</style>
    </div>
  );
}
