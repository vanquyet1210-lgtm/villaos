// VillaOS v7 — app/customer/bookings/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { redirect }         from 'next/navigation';
import { fmtMoney, formatDate, calcNights } from '@/lib/utils';
import Link                 from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CustomerBookingsPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();
  const { data } = await sb
    .from('bookings')
    .select('*, villas(name, emoji, province, district)')
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false });

  const bookings: any[] = data ?? [];

  const today     = new Date().toISOString().split('T')[0];
  const upcoming  = bookings.filter((b: any) => b.checkin >= today && b.status !== 'cancelled');
  const past      = bookings.filter((b: any) => b.checkin  < today  || b.status === 'cancelled');

  function BookingCard({ b }: { b: any }) {
    const nights = calcNights(b.checkin, b.checkout);
    return (
      <div style={{
        background:'var(--white)', borderRadius:'var(--radius-lg)',
        border:`1px solid ${b.status==='cancelled'?'rgba(192,57,43,.2)':'rgba(180,212,195,.3)'}`,
        boxShadow:'var(--shadow-sm)', padding:'16px 20px',
        display:'flex', gap:16, alignItems:'center',
        opacity: b.status === 'cancelled' ? 0.65 : 1,
      }}>
        <span style={{ fontSize:'2.2rem', flexShrink:0 }}>{b.villas?.emoji ?? '🏡'}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1rem', color:'var(--forest-deep)', marginBottom:4 }}>
            {b.villas?.name ?? 'Villa'}
          </div>
          <div style={{ fontSize:'0.82rem', color:'var(--ink-muted)', marginBottom:6 }}>
            📍 {b.villas?.district}, {b.villas?.province}
          </div>
          <div style={{ fontSize:'0.85rem', color:'var(--ink-light)' }}>
            📅 {formatDate(b.checkin)} → {formatDate(b.checkout)} · 🌙 {nights} đêm
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', color:'var(--forest)', marginBottom:6 }}>
            {fmtMoney(b.total)}
          </div>
          <span className={`badge badge-${b.status}`}>
            {b.status === 'confirmed' ? '✅ Confirmed' : b.status === 'hold' ? '⏳ Hold' : '❌ Hủy'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>📋 Booking của tôi</h1>
        <p>{upcoming.length} sắp tới · {past.length} đã qua</p>
      </div>

      {bookings.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 24px' }}>
          <span style={{ fontSize:56, display:'block', marginBottom:16 }}>🏡</span>
          <h3>Chưa có booking nào</h3>
          <p style={{ marginBottom:20 }}>Khám phá các villa đẹp và đặt phòng ngay hôm nay!</p>
          <Link href="/customer/villas" className="btn-primary">🏠 Khám phá villa</Link>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {upcoming.length > 0 && (
            <div>
              <h3 style={{ marginBottom:12, color:'var(--forest)', fontSize:'0.9rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                📅 Sắp tới ({upcoming.length})
              </h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {upcoming.map((b: any) => <BookingCard key={b.id} b={b} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 style={{ marginBottom:12, color:'var(--ink-muted)', fontSize:'0.9rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                🕐 Đã qua / Đã hủy ({past.length})
              </h3>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {past.slice(0,10).map((b: any) => <BookingCard key={b.id} b={b} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
