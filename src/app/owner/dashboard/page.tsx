// VillaOS v7 — app/owner/dashboard/page.tsx
// Dashboard tổng quan: tất cả villa + booking + doanh thu trên 1 màn hình

import { getServerSession }  from '@/lib/supabase/server';
import { getVillas }         from '@/lib/services/villa.service';
import { redirect }          from 'next/navigation';
import Link                  from 'next/link';
import { fmtMoney, formatDate, calcNights, todayISO } from '@/lib/utils';
import type { Villa, Booking } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function OwnerDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();

  // Load tất cả villas
  const { data: _villas } = await getVillas();
  const villas: Villa[] = _villas ?? [];

  // Load tất cả bookings (không cancelled)
  const { data: _bookings } = await sb
    .from('bookings')
    .select('*')
    .neq('status', 'cancelled')
    .order('checkin', { ascending: true });

  const allBookings: any[] = _bookings ?? [];

  const today = todayISO();
  const thisMonth = today.slice(0, 7); // YYYY-MM

  // ── Tính toán tổng quan ───────────────────────────────────────
  const confirmedB = allBookings.filter(b => b.status === 'confirmed');
  const holdB      = allBookings.filter(b => b.status === 'hold');
  const monthB     = confirmedB.filter(b => b.checkin.startsWith(thisMonth));
  const revenue    = monthB.reduce((s, b) => s + (b.total ?? 0), 0);

  // Upcoming check-ins (hôm nay hoặc trong 7 ngày tới)
  const in7days = new Date(today);
  in7days.setDate(in7days.getDate() + 7);
  const in7Str  = in7days.toISOString().slice(0, 10);
  const upcoming = confirmedB.filter(b => b.checkin >= today && b.checkin <= in7Str);

  // Villas đang có khách (hôm nay nằm trong khoảng checkin-checkout)
  const occupiedVillaIds = new Set(
    confirmedB
      .filter(b => b.checkin <= today && b.checkout > today)
      .map(b => b.villa_id)
  );

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Xin chào, {profile.name} 👋</h1>
          <p className="dash-sub">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/owner/calendar" className="btn-primary">
          📅 Lịch đặt phòng
        </Link>
      </div>

      {/* ── Stat cards ── */}
      <div className="stat-grid">
        {[
          { icon: '🏡', value: villas.length,       label: 'Villa hoạt động',      accent: 'forest' },
          { icon: '✅', value: confirmedB.length,    label: 'Booking tháng này',    accent: 'green'  },
          { icon: '⏳', value: holdB.length,         label: 'Đang Hold',            accent: 'amber'  },
          { icon: '💰', value: fmtMoney(revenue),    label: 'Doanh thu tháng này',  accent: 'gold', big: true },
        ].map((s) => (
          <div key={s.label} className={`stat-card stat-${s.accent}`}>
            <span className="stat-icon">{s.icon}</span>
            <div className={`stat-value${s.big ? ' stat-value-big' : ''}`}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid: Villas + Upcoming ── */}
      <div className="dash-main">

        {/* ── All Villas ── */}
        <section className="dash-section">
          <div className="section-header">
            <h2>🏠 Tất cả villa</h2>
            <Link href="/owner/villas" className="btn-ghost">Quản lý →</Link>
          </div>
          <div className="villa-grid">
            {villas.length === 0 ? (
              <div className="empty-state">
                <p>Chưa có villa nào.</p>
                <Link href="/owner/villas/new" className="btn-primary" style={{marginTop:12,fontSize:'0.85rem'}}>+ Thêm villa</Link>
              </div>
            ) : villas.map(v => {
              const vBookings  = confirmedB.filter(b => b.villa_id === v.id);
              const vHolds     = holdB.filter(b => b.villa_id === v.id);
              const isOccupied = occupiedVillaIds.has(v.id);
              const vMonthRev  = vBookings
                .filter(b => b.checkin.startsWith(thisMonth))
                .reduce((s, b) => s + (b.total ?? 0), 0);

              // Booking tiếp theo
              const nextBk = vBookings
                .filter(b => b.checkin >= today)
                .sort((a, b) => a.checkin.localeCompare(b.checkin))[0];

              return (
                <div key={v.id} className={`villa-card${isOccupied ? ' villa-occupied' : ''}`}>
                  <div className="villa-card-top">
                    <div className="villa-emoji-wrap">
                      <span className="villa-emoji">{v.emoji}</span>
                      <div className={`villa-status-dot ${isOccupied ? 'dot-occupied' : 'dot-free'}`} />
                    </div>
                    <div className="villa-card-info">
                      <div className="villa-card-name">{v.name}</div>
                      <div className="villa-card-meta">
                        🛏 {v.bedrooms} phòng · 👥 {v.adults} người · {fmtMoney(v.price)}/đêm
                      </div>
                    </div>
                    <div className="villa-card-status">
                      {isOccupied
                        ? <span className="badge badge-occupied">Có khách</span>
                        : <span className="badge badge-free">Trống</span>
                      }
                      {vHolds.length > 0 &&
                        <span className="badge badge-hold">⏳ {vHolds.length} hold</span>
                      }
                    </div>
                  </div>

                  <div className="villa-card-stats">
                    <div className="vstat">
                      <span className="vstat-val">{vBookings.length}</span>
                      <span className="vstat-lbl">Booking</span>
                    </div>
                    <div className="vstat">
                      <span className="vstat-val">{fmtMoney(vMonthRev)}</span>
                      <span className="vstat-lbl">Tháng này</span>
                    </div>
                    <div className="vstat">
                      {nextBk
                        ? <><span className="vstat-val">{formatDate(nextBk.checkin)}</span><span className="vstat-lbl">Check-in kế</span></>
                        : <><span className="vstat-val" style={{color:'var(--ink-muted)'}}>—</span><span className="vstat-lbl">Chưa có lịch</span></>
                      }
                    </div>
                  </div>

                  <div className="villa-card-actions">
                    <Link href={`/owner/calendar?villa=${v.id}`} className="btn-ghost-sm">📅 Xem lịch</Link>
                    <Link href={`/owner/villas/${v.id}/edit`}    className="btn-ghost-sm">✏️ Sửa</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Right column ── */}
        <aside className="dash-aside">

          {/* Upcoming check-ins */}
          <section className="dash-section">
            <div className="section-header">
              <h2>📆 Check-in sắp tới</h2>
              <span className="badge badge-count">{upcoming.length}</span>
            </div>
            {upcoming.length === 0 ? (
              <p className="empty-text">Không có check-in nào trong 7 ngày tới.</p>
            ) : upcoming.map(b => {
              const villa = villas.find(v => v.id === b.villa_id);
              return (
                <div key={b.id} className="upcoming-item">
                  <div className="upcoming-emoji">{villa?.emoji ?? '🏡'}</div>
                  <div className="upcoming-info">
                    <div className="upcoming-name">{b.customer}</div>
                    <div className="upcoming-meta">
                      {villa?.name} · {formatDate(b.checkin)} → {formatDate(b.checkout)}
                      · {calcNights(b.checkin, b.checkout)} đêm
                    </div>
                  </div>
                  <div className="upcoming-total">{fmtMoney(b.total)}</div>
                </div>
              );
            })}
          </section>

          {/* Holds cần xác nhận */}
          {holdB.length > 0 && (
            <section className="dash-section dash-section-hold">
              <div className="section-header">
                <h2>⏳ Hold chờ xác nhận</h2>
                <span className="badge badge-amber">{holdB.length}</span>
              </div>
              {holdB.slice(0, 5).map(b => {
                const villa = villas.find(v => v.id === b.villa_id);
                const expiresAt = b.hold_expires_at ? new Date(b.hold_expires_at) : null;
                const isExpired = expiresAt ? expiresAt < new Date() : false;
                return (
                  <div key={b.id} className={`hold-item${isExpired ? ' hold-expired' : ''}`}>
                    <div className="hold-info">
                      <div className="hold-name">{b.customer}</div>
                      <div className="hold-meta">{villa?.name} · {formatDate(b.checkin)} → {formatDate(b.checkout)}</div>
                    </div>
                    <div className="hold-right">
                      <div className="hold-total">{fmtMoney(b.total)}</div>
                      {isExpired
                        ? <span className="badge badge-expired">Hết hạn</span>
                        : <Link href={`/owner/calendar?villa=${b.villa_id}`} className="badge badge-confirm">Xác nhận</Link>
                      }
                    </div>
                  </div>
                );
              })}
              {holdB.length > 5 && (
                <Link href="/owner/calendar" className="btn-ghost-sm" style={{marginTop:8}}>
                  Xem thêm {holdB.length - 5} hold...
                </Link>
              )}
            </section>
          )}

          {/* Quick actions */}
          <section className="dash-section">
            <h2 style={{marginBottom:12}}>⚡ Thao tác nhanh</h2>
            <div className="quick-actions">
              <Link href="/owner/calendar"   className="quick-btn">📅 Lịch tổng</Link>
              <Link href="/owner/villas/new" className="quick-btn">➕ Thêm villa</Link>
              <Link href="/owner/villas"     className="quick-btn">🏠 Quản lý villa</Link>
            </div>
          </section>

        </aside>
      </div>

      <style>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Header */
        .dash-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .dash-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--forest-deep);
          margin: 0;
        }
        .dash-sub {
          font-size: 0.85rem;
          color: var(--ink-muted);
          margin: 2px 0 0;
          text-transform: capitalize;
        }

        /* Stat grid */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 500px) { .stat-grid { grid-template-columns: 1fr; } }

        .stat-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid rgba(180,212,195,.25);
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: box-shadow .15s;
        }
        .stat-card:hover { box-shadow: var(--shadow-md); }
        .stat-forest { border-top: 3px solid var(--forest); }
        .stat-green  { border-top: 3px solid #4caf50; }
        .stat-amber  { border-top: 3px solid var(--amber); }
        .stat-gold   { border-top: 3px solid #d4a017; background: linear-gradient(135deg, var(--white) 80%, #fffbe6); }

        .stat-icon  { font-size: 1.4rem; }
        .stat-value { font-size: 1.6rem; font-weight: 700; color: var(--forest-deep); line-height: 1.1; }
        .stat-value-big { font-size: 1.35rem; }
        .stat-label { font-size: 0.78rem; color: var(--ink-muted); font-weight: 500; }

        /* Main layout */
        .dash-main {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1100px) { .dash-main { grid-template-columns: 1fr; } }

        /* Section */
        .dash-section {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid rgba(180,212,195,.25);
          padding: 20px;
          margin-bottom: 16px;
        }
        .dash-section:last-child { margin-bottom: 0; }
        .dash-section-hold { border-left: 3px solid var(--amber); }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .section-header h2 {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--forest-deep);
          margin: 0;
        }

        /* Villa grid */
        /* ── Villa grid: horizontal scroll ── */
        .villa-grid {
          display: flex;
          flex-direction: row;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none;
        }
        .villa-grid::-webkit-scrollbar { display: none; }

        .villa-card {
          flex: 0 0 280px;
          min-width: 280px;
          border: 1.5px solid rgba(180,212,195,.35);
          border-radius: 16px;
          padding: 16px;
          transition: box-shadow .15s, border-color .15s, transform .12s;
          background: var(--white);
          box-shadow: 0 2px 8px rgba(0,0,0,.04);
        }
        .villa-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.09); border-color: var(--sage); transform: translateY(-2px); }
        .villa-occupied {
          border-color: var(--forest);
          background: linear-gradient(135deg, rgba(180,212,195,.12) 0%, var(--white) 60%);
        }

        .villa-card-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }
        .villa-emoji-wrap { position: relative; flex-shrink: 0; }
        .villa-emoji {
          font-size: 2.2rem;
          display: block;
          width: 48px; height: 48px;
          background: rgba(180,212,195,.15);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .villa-status-dot {
          position: absolute;
          top: -2px; right: -2px;
          width: 12px; height: 12px;
          border-radius: 50%;
          border: 2px solid var(--white);
          box-shadow: 0 1px 3px rgba(0,0,0,.2);
        }
        .dot-occupied { background: #22c55e; }
        .dot-free     { background: #94a3b8; }

        .villa-card-info { flex: 1; min-width: 0; }
        .villa-card-name {
          font-weight: 700;
          font-size: 1rem;
          color: var(--forest-deep);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.3;
        }
        .villa-card-meta { font-size: 0.76rem; color: var(--ink-muted); margin-top: 3px; line-height: 1.5; }

        .villa-card-status { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; align-items: flex-end; }

        /* Stats row */
        .villa-card-stats {
          display: flex;
          gap: 0;
          padding: 10px 0;
          border-top: 1px solid rgba(180,212,195,.25);
          border-bottom: 1px solid rgba(180,212,195,.25);
          margin-bottom: 12px;
        }
        .vstat { flex: 1; text-align: center; }
        .vstat + .vstat { border-left: 1px solid rgba(180,212,195,.25); }
        .vstat-val { display: block; font-weight: 700; font-size: 0.88rem; color: var(--forest-deep); line-height: 1.4; }
        .vstat-lbl { font-size: 0.68rem; color: var(--ink-muted); }

        .villa-card-actions { display: flex; gap: 8px; }

        /* Upcoming */
        .upcoming-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid var(--sage-pale);
        }
        .upcoming-item:last-child { border-bottom: none; }
        .upcoming-emoji { font-size: 1.4rem; flex-shrink: 0; }
        .upcoming-info  { flex: 1; min-width: 0; }
        .upcoming-name  { font-weight: 600; font-size: 0.88rem; color: var(--forest-deep); }
        .upcoming-meta  { font-size: 0.75rem; color: var(--ink-muted); margin-top: 2px; }
        .upcoming-total { font-weight: 700; font-size: 0.88rem; color: var(--forest); flex-shrink: 0; }

        /* Hold items */
        .hold-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid var(--sage-pale);
        }
        .hold-item:last-child { border-bottom: none; }
        .hold-expired { opacity: .55; }
        .hold-info { flex: 1; min-width: 0; }
        .hold-name { font-weight: 600; font-size: 0.85rem; color: var(--forest-deep); }
        .hold-meta { font-size: 0.73rem; color: var(--ink-muted); }
        .hold-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .hold-total { font-weight: 700; font-size: 0.85rem; color: var(--forest); }

        /* Quick actions */
        .quick-actions { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
        .quick-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 14px 8px;
          background: var(--parchment);
          border: 1px solid var(--sage-pale);
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--forest);
          text-decoration: none;
          text-align: center;
          cursor: pointer;
          transition: background .12s, border-color .12s, box-shadow .12s;
        }
        .quick-btn:hover { background: var(--sage-pale); border-color: var(--sage); box-shadow: var(--shadow-sm); }

        /* Badges */
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 0.7rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .badge-occupied { background: rgba(29,80,58,.1); color: var(--forest); }
        .badge-free     { background: var(--sage-pale); color: var(--ink-muted); }
        .badge-hold     { background: var(--amber-light); color: var(--amber); }
        .badge-count    { background: var(--sage-pale); color: var(--forest); }
        .badge-amber    { background: var(--amber-light); color: var(--amber); }
        .badge-expired  { background: var(--red-light); color: var(--red); }
        .badge-confirm  {
          background: var(--forest);
          color: var(--white);
          text-decoration: none;
          cursor: pointer;
          transition: background .12s;
        }
        .badge-confirm:hover { background: var(--forest-deep); }

        /* Buttons */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          background: var(--forest);
          color: var(--white);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          transition: background .12s, transform .1s;
          border: none;
          cursor: pointer;
        }
        .btn-primary:hover { background: var(--forest-deep); transform: translateY(-1px); }

        .btn-ghost {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--forest);
          text-decoration: none;
          padding: 4px 0;
          transition: opacity .12s;
        }
        .btn-ghost:hover { opacity: .7; }

        .btn-ghost-sm {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--forest);
          text-decoration: none;
          padding: 5px 10px;
          background: var(--parchment);
          border: 1px solid var(--sage-pale);
          border-radius: var(--radius-sm);
          transition: background .12s;
          display: inline-block;
        }
        .btn-ghost-sm:hover { background: var(--sage-pale); }

        .empty-state {
          text-align: center;
          padding: 32px;
          color: var(--ink-muted);
          font-size: 0.875rem;
        }
        .empty-text {
          font-size: 0.82rem;
          color: var(--ink-muted);
          padding: 8px 0;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
