// VillaOS v7 — app/owner/villas/page.tsx
import { getServerSession }  from '@/lib/supabase/server';
import { getVillas }         from '@/lib/services/villa.service';
import { redirect }          from 'next/navigation';
import { fmtMoney, amenityLabel } from '@/lib/utils';
import VillaActions          from './VillaActions';
import Link                  from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OwnerVillasPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { data: _villas, error } = await getVillas();
  const villas = _villas ?? [];

  return (
    <>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1>🏠 Villa của tôi</h1>
          <p>{villas.length} villa · {session.profile.brand || 'Portfolio của bạn'}</p>
        </div>
        <Link href="/owner/villas/new" className="btn-primary">+ Thêm villa mới</Link>
      </div>

      {error && <div className="auth-alert error" style={{marginBottom:20}}>❌ {error}</div>}

      {villas.length === 0 ? (
        <div className="card" style={{textAlign:'center', padding:'48px 24px'}}>
          <span style={{fontSize:56, display:'block', marginBottom:16}}>🏡</span>
          <h3 style={{marginBottom:8}}>Chưa có villa nào</h3>
          <p style={{marginBottom:24}}>Bắt đầu bằng cách thêm villa đầu tiên của bạn</p>
          <Link href="/owner/villas/new" className="btn-primary">+ Thêm villa đầu tiên</Link>
        </div>
      ) : (
        <div className="villa-list">
          {villas.map((villa, i) => (
            <div key={villa.id} className="villa-row" style={{animationDelay:`${i*60}ms`}}>
              <div className="villa-row-thumb">
                {villa.images[0]
                  ? <img src={villa.images[0]} alt={villa.name} />
                  : <span className="villa-row-emoji">{villa.emoji}</span>}
              </div>
              <div className="villa-row-info">
                <div className="villa-row-name">
                  {villa.name}
                  <span className={`badge badge-${villa.status}`} style={{marginLeft:8}}>
                    {villa.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                  </span>
                </div>
                <div className="villa-row-meta">
                  📍 {villa.district}, {villa.province} · 🛏 {villa.bedrooms} phòng · 👥 {villa.adults} người · 💰 {fmtMoney(villa.price)}/đêm
                </div>
                {villa.amenities.length > 0 && (
                  <div className="villa-row-amenities">
                    {villa.amenities.slice(0,4).map(a => (
                      <span key={a} className="villa-amenity-chip">{amenityLabel(a)}</span>
                    ))}
                    {villa.amenities.length > 4 && <span className="villa-amenity-chip">+{villa.amenities.length-4}</span>}
                  </div>
                )}
              </div>
              <VillaActions villa={villa} />
            </div>
          ))}
        </div>
      )}

      <style>{`
        .villa-list { display:flex; flex-direction:column; gap:12px; }
        .villa-row {
          display:flex; align-items:center; gap:16px;
          background:var(--white); border-radius:var(--radius-lg);
          border:1px solid rgba(180,212,195,.3); box-shadow:var(--shadow-sm);
          padding:16px; transition:box-shadow .15s, transform .15s;
          animation:slideUp .25s ease both;
        }
        .villa-row:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); }
        .villa-row-thumb {
          width:72px; height:72px; border-radius:var(--radius-md);
          overflow:hidden; flex-shrink:0; background:var(--sage-pale);
          display:flex; align-items:center; justify-content:center;
        }
        .villa-row-thumb img { width:100%; height:100%; object-fit:cover; }
        .villa-row-emoji { font-size:2.2rem; }
        .villa-row-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
        .villa-row-name { font-family:var(--font-display); font-size:1.05rem; color:var(--forest-deep); display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
        .villa-row-meta { font-size:0.82rem; color:var(--ink-light); }
        .villa-row-amenities { display:flex; flex-wrap:wrap; gap:4px; margin-top:2px; }
        .villa-amenity-chip { font-size:0.72rem; padding:2px 8px; background:var(--sage-pale); border:1px solid var(--sage-light); border-radius:99px; color:var(--forest); }
      `}</style>
    </>
  );
}
