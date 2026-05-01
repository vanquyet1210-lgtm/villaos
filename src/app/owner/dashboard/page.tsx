// VillaOS v7 — app/owner/dashboard/page.tsx
import { getServerSession }  from '@/lib/supabase/server';
import { getVillas }         from '@/lib/services/villa.service';
import { redirect }          from 'next/navigation';
import { fmtMoney, formatDate, calcNights } from '@/lib/utils';
import Link                  from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OwnerDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;
  const { data: _villas } = await getVillas();
  const villas = _villas ?? [];

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();
  const { data: _allBookings } = await sb
    .from('bookings').select('*')
    .eq('owner_id', profile.id)
    .neq('status', 'cancelled')
    .order('checkin', { ascending: false });

  const allBookings: any[] = _allBookings ?? [];

  const today     = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);
  const activeB   = allBookings.filter((b: any) => b.status === 'confirmed');
  const holdB     = allBookings.filter((b: any) => b.status === 'hold');
  const monthB    = activeB.filter((b: any) => b.checkin.startsWith(thisMonth));
  const revenue   = monthB.reduce((s: number, b: any) => s + (b.total ?? 0), 0);
  const upcoming  = activeB.filter((b: any) => b.checkin >= today).slice(0, 6);

  return (
    <>
      <div className="page-header">
        <h1>Xin chào, {profile.name} 👋</h1>
        <p>{profile.brand || 'Villa Manager'} · {new Date().toLocaleDateString('vi-VN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>

      <div className="stat-grid">
        {[
          { icon:'🏠', value: villas.length,     label:'Villa hoạt động' },
          { icon:'📅', value: monthB.length,     label:'Booking tháng này' },
          { icon:'💰', value: fmtMoney(revenue), label:'Doanh thu tháng này', big: true },
          { icon:'⏳', value: holdB.length,      label:'Hold chờ xác nhận' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value" style={s.big ? { fontSize:'1.3rem' } : {}}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Upcoming */}
        <div className="card">
          <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3>📋 Check-in sắp tới</h3>
            <Link href="/owner/calendar" style={{ fontSize:'0.82rem', color:'var(--forest)' }}>Xem lịch →</Link>
          </div>
          <div style={{ padding: 0 }}>
            {upcoming.length === 0
              ? <p style={{ padding:'20px', textAlign:'center', color:'var(--ink-muted)' }}>Không có lịch sắp tới</p>
              : upcoming.map((b: any) => (
                <div key={b.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--sage-pale)' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{b.customer}</div>
                    <div style={{ fontSize:'0.78rem', color:'var(--ink-muted)' }}>
                      {formatDate(b.checkin)} → {formatDate(b.checkout)} · {calcNights(b.checkin, b.checkout)} đêm
                    </div>
                  </div>
                  <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--forest)', alignSelf:'center' }}>
                    {fmtMoney(b.total)}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Villas */}
        <div className="card">
          <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3>🏠 Villa của tôi</h3>
            <Link href="/owner/villas" style={{ fontSize:'0.82rem', color:'var(--forest)' }}>Quản lý →</Link>
          </div>
          <div style={{ padding:0 }}>
            {villas.length === 0
              ? <div style={{ padding:'20px', textAlign:'center' }}>
                  <p style={{ color:'var(--ink-muted)', marginBottom:12 }}>Chưa có villa</p>
                  <Link href="/owner/villas/new" className="btn-primary" style={{ fontSize:'0.85rem' }}>+ Thêm villa</Link>
                </div>
              : villas.map(v => {
                  const cnt = allBookings.filter((b: any) => b.villa_id === v.id && b.checkin >= today).length;
                  return (
                    <div key={v.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'1px solid var(--sage-pale)' }}>
                      <span style={{ fontSize:'1.6rem' }}>{v.emoji}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{v.name}</div>
                        <div style={{ fontSize:'0.78rem', color:'var(--ink-muted)' }}>{v.district} · {fmtMoney(v.price)}/đêm</div>
                      </div>
                      <span style={{ fontSize:'0.78rem', background:'var(--sage-pale)', color:'var(--forest)', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>
                        {cnt} sắp tới
                      </span>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      {/* Holds alert */}
      {holdB.length > 0 && (
        <div className="card" style={{ borderLeft:'4px solid var(--amber)' }}>
          <div className="card-header"><h3>⏳ Hold cần xác nhận ({holdB.length})</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Khách</th><th>Ngày</th><th>Villa</th><th>Tiền</th><th></th></tr></thead>
              <tbody>
                {holdB.slice(0, 5).map((b: any) => {
                  const v = villas.find(vl => vl.id === b.villa_id);
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight:600 }}>{b.customer}</td>
                      <td style={{ fontSize:'0.82rem', color:'var(--ink-light)' }}>{formatDate(b.checkin)} → {formatDate(b.checkout)}</td>
                      <td style={{ fontSize:'0.82rem' }}>{v?.name ?? '—'}</td>
                      <td style={{ fontWeight:600, color:'var(--forest)' }}>{fmtMoney(b.total)}</td>
                      <td><Link href={`/owner/calendar?villa=${b.villa_id}`} style={{ fontSize:'0.8rem', color:'var(--forest)', fontWeight:600 }}>Xem lịch →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
