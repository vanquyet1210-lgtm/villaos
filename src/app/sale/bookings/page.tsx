// VillaOS v7 — app/sale/bookings/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { redirect }         from 'next/navigation';
import { fmtMoney, formatDate, calcNights } from '@/lib/utils';
import Link                 from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SaleBookingsPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();
  const { data: _bookings } = await sb
    .from('bookings')
    .select('*, villas(name, emoji)')
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const bookings: any[] = _bookings ?? [];

  const active    = bookings.filter((b: any) => b.status !== 'cancelled').length;
  const holds     = bookings.filter((b: any) => b.status === 'hold').length;

  return (
    <>
      <div className="page-header">
        <h1>📋 Booking của tôi</h1>
        <p>{active} booking đang hoạt động · {holds} hold đang chờ</p>
      </div>

      {bookings.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 24px' }}>
          <span style={{ fontSize:56, display:'block', marginBottom:16 }}>📋</span>
          <h3>Chưa có booking nào</h3>
          <p style={{ marginTop:8 }}>Tạo booking đầu tiên từ trang lịch villa</p>
          <Link href="/sale/calendar" className="btn-primary" style={{ marginTop:16, display:'inline-flex' }}>
            📅 Vào lịch villa
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Khách</th>
                  <th>Villa</th>
                  <th>Ngày</th>
                  <th>Đêm</th>
                  <th>Tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b: any) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{b.customer}</div>
                      {b.phone && <div style={{ fontSize:'0.78rem', color:'var(--ink-muted)' }}>📞 {b.phone}</div>}
                    </td>
                    <td style={{ fontSize:'0.875rem' }}>
                      {b.villas?.emoji} {b.villas?.name ?? '—'}
                    </td>
                    <td style={{ fontSize:'0.82rem', color:'var(--ink-light)' }}>
                      {formatDate(b.checkin)}<br />→ {formatDate(b.checkout)}
                    </td>
                    <td style={{ fontSize:'0.875rem', textAlign:'center' }}>
                      {calcNights(b.checkin, b.checkout)}
                    </td>
                    <td style={{ fontWeight:600, color:'var(--forest)', fontSize:'0.875rem' }}>
                      {fmtMoney(b.total)}
                    </td>
                    <td>
                      <span className={`badge badge-${b.status}`}>
                        {b.status === 'confirmed' ? '✅ Confirmed'
                          : b.status === 'hold'   ? '⏳ Hold'
                          : '❌ Cancelled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
