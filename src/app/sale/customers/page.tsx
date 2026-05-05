// VillaOS — app/sale/customers/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { redirect }         from 'next/navigation';
import { fmtMoney, formatDate, calcNights } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SaleCustomersPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();

  const { data: _bookings } = await sb
    .from('bookings')
    .select('*, villas(name, emoji)')
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false });

  const bookings: any[] = _bookings ?? [];

  // ── Group theo số điện thoại ────────────────────────────────
  const customerMap = new Map<string, {
    name:        string;
    phone:       string;
    email:       string;
    bookings:    any[];
    totalSpent:  number;
    lastCheckin: string;
  }>();

  for (const b of bookings) {
    const key = b.phone ?? b.customer;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name:        b.customer,
        phone:       b.phone  ?? '',
        email:       b.email  ?? '',
        bookings:    [],
        totalSpent:  0,
        lastCheckin: b.checkin,
      });
    }
    const c = customerMap.get(key)!;
    c.bookings.push(b);
    if (b.status === 'confirmed') c.totalSpent += b.total ?? 0;
    if (b.checkin > c.lastCheckin) c.lastCheckin = b.checkin;
  }

  const customers = Array.from(customerMap.values())
    .sort((a, b) => b.lastCheckin.localeCompare(a.lastCheckin));

  const totalCustomers   = customers.length;
  const totalRevenue     = customers.reduce((s, c) => s + c.totalSpent, 0);
  const repeatCustomers  = customers.filter(c => c.bookings.filter((b:any) => b.status !== 'cancelled').length > 1).length;

  return (
    <div className="customers-page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>👥 Danh sách khách hàng</h1>
          <p>{totalCustomers} khách · {repeatCustomers} khách quay lại · Tổng doanh thu {fmtMoney(totalRevenue)}</p>
        </div>
        <Link href="/sale/calendar" className="btn-primary">📅 Tạo booking mới</Link>
      </div>

      {customers.length === 0 ? (
        <div className="card empty-card">
          <span className="empty-icon">👥</span>
          <h3>Chưa có khách hàng nào</h3>
          <p>Khách hàng sẽ xuất hiện sau khi bạn tạo booking đầu tiên</p>
          <Link href="/sale/calendar" className="btn-primary" style={{ marginTop:16, display:'inline-flex' }}>
            📅 Vào lịch villa
          </Link>
        </div>
      ) : (
        <div className="customer-list">
          {customers.map((c, i) => {
            const confirmed  = c.bookings.filter((b:any) => b.status === 'confirmed');
            const holds      = c.bookings.filter((b:any) => b.status === 'hold');
            const cancelled  = c.bookings.filter((b:any) => b.status === 'cancelled');
            const isRepeat   = confirmed.length > 1;
            const totalNights = confirmed.reduce((s:number, b:any) => s + calcNights(b.checkin, b.checkout), 0);
            const lastBooking = c.bookings[0];
            const lastVilla   = lastBooking?.villas;

            return (
              <details key={c.phone || i} className={`customer-card${isRepeat ? ' customer-card--repeat' : ''}`}>
                <summary className="customer-summary">
                  {/* Avatar */}
                  <div className="cust-avatar">
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Tên + liên hệ */}
                  <div className="cust-main">
                    <div className="cust-name">
                      {c.name}
                      {isRepeat && <span className="tag-repeat">⭐ Khách quen</span>}
                    </div>
                    <div className="cust-contact">
                      {c.phone && <a href={`tel:${c.phone}`} className="cust-link">📞 {c.phone}</a>}
                      {c.email && <span className="cust-sep">·</span>}
                      {c.email && <a href={`mailto:${c.email}`} className="cust-link">✉️ {c.email}</a>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="cust-stats">
                    <div className="cust-stat">
                      <span className="cust-stat__val">{confirmed.length + holds.length}</span>
                      <span className="cust-stat__lbl">booking</span>
                    </div>
                    <div className="cust-stat">
                      <span className="cust-stat__val">{totalNights}</span>
                      <span className="cust-stat__lbl">đêm</span>
                    </div>
                    <div className="cust-stat cust-stat--money">
                      <span className="cust-stat__val">{fmtMoney(c.totalSpent)}</span>
                      <span className="cust-stat__lbl">doanh thu</span>
                    </div>
                  </div>

                  {/* Villa gần nhất */}
                  <div className="cust-last">
                    <div className="cust-last__villa">
                      {lastVilla?.emoji} {lastVilla?.name ?? '—'}
                    </div>
                    <div className="cust-last__date">
                      Lần cuối: {formatDate(c.lastCheckin)}
                    </div>
                  </div>

                  <span className="cust-chevron">›</span>
                </summary>

                {/* Chi tiết booking */}
                <div className="cust-detail">
                  <div className="cust-detail__title">Lịch sử đặt phòng</div>
                  <table className="cust-table">
                    <thead>
                      <tr>
                        <th>Villa</th>
                        <th>Check-in / out</th>
                        <th>Đêm</th>
                        <th>Tiền</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.bookings.map((b:any) => (
                        <tr key={b.id} className={b.status === 'cancelled' ? 'row-cancelled' : ''}>
                          <td>{b.villas?.emoji} {b.villas?.name ?? '—'}</td>
                          <td>
                            {formatDate(b.checkin)} → {formatDate(b.checkout)}
                          </td>
                          <td className="cell-center">{calcNights(b.checkin, b.checkout)}</td>
                          <td className="cell-money">{fmtMoney(b.total)}</td>
                          <td>
                            {b.status === 'confirmed' && <span className="tag tag-confirm">✅ Confirmed</span>}
                            {b.status === 'hold'      && <span className="tag tag-hold">⏳ Hold</span>}
                            {b.status === 'cancelled' && <span className="tag tag-cancel">✕ Đã hủy</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {c.phone && (
                    <div className="cust-actions">
                      <a href={`tel:${c.phone}`} className="btn-ghost-sm">📞 Gọi ngay</a>
                      <Link href={`/sale/calendar`} className="btn-ghost-sm">📅 Đặt phòng mới</Link>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <style>{`
        .customers-page { display:flex; flex-direction:column; gap:20px; }

        .page-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .page-header h1 { font-size:1.4rem; font-weight:700; color:var(--forest-deep); margin:0 0 4px; }
        .page-header p  { font-size:0.82rem; color:var(--ink-muted); margin:0; }

        /* Empty */
        .empty-card { text-align:center; padding:48px 24px; }
        .empty-icon { font-size:3.5rem; display:block; margin-bottom:12px; }

        /* Customer list */
        .customer-list { display:flex; flex-direction:column; gap:8px; }

        .customer-card {
          background:var(--white);
          border:1px solid rgba(180,212,195,.3);
          border-radius:14px;
          overflow:hidden;
          transition:box-shadow .15s;
        }
        .customer-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.07); }
        .customer-card--repeat { border-left:3px solid #f59e0b; }

        .customer-summary {
          display:flex; align-items:center; gap:14px;
          padding:14px 16px;
          cursor:pointer;
          list-style:none;
          user-select:none;
        }
        .customer-summary::-webkit-details-marker { display:none; }
        .customer-summary:hover { background:rgba(180,212,195,.06); }

        /* Avatar */
        .cust-avatar {
          width:42px; height:42px; border-radius:50%;
          background:var(--forest);
          color:#fff; font-size:1.1rem; font-weight:700;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
        }

        /* Main info */
        .cust-main  { flex:1; min-width:0; }
        .cust-name  { font-weight:700; font-size:0.9rem; color:var(--forest-deep); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .cust-contact { font-size:0.75rem; color:var(--ink-muted); margin-top:3px; display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
        .cust-link  { color:var(--forest); text-decoration:none; }
        .cust-link:hover { text-decoration:underline; }
        .cust-sep   { color:var(--sage); }

        /* Stats */
        .cust-stats { display:flex; gap:16px; flex-shrink:0; }
        .cust-stat  { display:flex; flex-direction:column; align-items:center; gap:1px; }
        .cust-stat__val { font-size:0.9rem; font-weight:700; color:var(--forest-deep); line-height:1.2; }
        .cust-stat__lbl { font-size:0.65rem; color:var(--ink-muted); white-space:nowrap; }
        .cust-stat--money .cust-stat__val { font-size:0.78rem; color:var(--forest); }

        /* Last villa */
        .cust-last { flex-shrink:0; text-align:right; min-width:110px; }
        .cust-last__villa { font-size:0.78rem; font-weight:600; color:var(--forest-deep); }
        .cust-last__date  { font-size:0.7rem; color:var(--ink-muted); margin-top:2px; }

        /* Chevron */
        .cust-chevron { font-size:1.3rem; color:var(--ink-muted); flex-shrink:0; transition:transform .2s; }
        details[open] .cust-chevron { transform:rotate(90deg); }

        /* Tags */
        .tag-repeat  { background:#fef3c7; color:#92400e; font-size:0.65rem; font-weight:600; padding:2px 7px; border-radius:99px; white-space:nowrap; }
        .tag { display:inline-block; padding:2px 8px; border-radius:99px; font-size:0.68rem; font-weight:700; white-space:nowrap; }
        .tag-confirm { background:#dcfce7; color:#166534; }
        .tag-hold    { background:#fef3c7; color:#92400e; }
        .tag-cancel  { background:#fee2e2; color:#991b1b; }

        /* Detail */
        .cust-detail { padding:0 16px 16px; border-top:1px solid var(--sage-pale); }
        .cust-detail__title { font-size:0.72rem; font-weight:700; color:var(--ink-muted); text-transform:uppercase; letter-spacing:.04em; padding:12px 0 8px; }

        /* Table */
        .cust-table { width:100%; border-collapse:collapse; font-size:0.8rem; }
        .cust-table th { padding:6px 10px; text-align:left; font-size:0.68rem; font-weight:700; color:var(--ink-muted); text-transform:uppercase; letter-spacing:.04em; background:var(--parchment); white-space:nowrap; }
        .cust-table td { padding:9px 10px; border-bottom:1px solid var(--sage-pale); vertical-align:middle; }
        .cust-table tr:last-child td { border-bottom:none; }
        .row-cancelled td { opacity:.5; }
        .cell-center { text-align:center; font-weight:600; }
        .cell-money  { text-align:right; font-weight:700; color:var(--forest); white-space:nowrap; }

        /* Actions */
        .cust-actions { display:flex; gap:8px; margin-top:12px; }
        .btn-ghost-sm {
          font-size:0.78rem; font-weight:600; color:var(--forest);
          text-decoration:none; padding:5px 12px;
          background:var(--parchment); border:1px solid var(--sage-pale);
          border-radius:var(--radius-sm); transition:background .12s; display:inline-block;
        }
        .btn-ghost-sm:hover { background:var(--sage-pale); }
        .btn-primary {
          display:inline-flex; align-items:center; gap:6px;
          padding:9px 16px; background:var(--forest); color:var(--white);
          border-radius:var(--radius-md); font-size:0.875rem; font-weight:600;
          text-decoration:none; transition:background .12s; border:none; cursor:pointer;
        }
        .btn-primary:hover { background:var(--forest-deep); }

        @media(max-width:700px) {
          .customer-summary { flex-wrap:wrap; }
          .cust-stats { gap:10px; }
          .cust-last  { display:none; }
        }
      `}</style>
    </div>
  );
}
