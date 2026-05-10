// VillaOS v7 — app/owner/villas/page.tsx
import { getServerSession }       from '@/lib/supabase/server';
import { getVillas }              from '@/lib/services/villa.service';
import { redirect }               from 'next/navigation';
import { amenityLabel }           from '@/lib/utils';
import VillaActions               from './VillaActions';
import Link                       from 'next/link';

export const dynamic = 'force-dynamic';

function fmtShort(n: number): string {
  if (!n) return '0đ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'k';
  return n.toLocaleString('vi-VN') + 'đ';
}

export default async function OwnerVillasPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { data: _villas, error } = await getVillas();
  const villas = _villas ?? [];

  return (
    <>
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1>Villa của tôi</h1>
          <p style={{ fontSize:'0.72rem', color:'var(--gold,#C9A84C)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:500 }}>
            {villas.length} villa · {session.profile.brand || 'Portfolio của bạn'}
          </p>
        </div>
        <Link href="/owner/villas/new" className="btn-primary">+ Thêm villa mới</Link>
      </div>

      <div style={{ height:'0.5px', background:'linear-gradient(90deg,rgba(201,168,76,.6) 0%,rgba(201,168,76,.08) 100%)', marginBottom:'20px' }} />

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

              {/* ── Thumbnail ── */}
              <div className="villa-row-thumb">
                {villa.images[0]
                  ? <img src={villa.images[0]} alt={villa.name} />
                  : <span className="villa-row-emoji">{villa.emoji}</span>}
              </div>

              {/* ── Info ── */}
              <div className="villa-row-info">
                <div className="villa-row-header">
                  <span className="villa-row-name">{villa.name}</span>
                  <span className={`villa-status-pill villa-status-${villa.status}`}>
                    <span className="villa-status-dot" />
                    {villa.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                  </span>
                </div>

                <div className="villa-row-meta">
                  <span>📍 {villa.district}, {villa.province}</span>
                  <span className="meta-sep">·</span>
                  <span>🛏 {villa.bedrooms} phòng</span>
                  <span className="meta-sep">·</span>
                  <span>👥 {villa.adults} người</span>
                  <span className="meta-sep">·</span>
                  <span className="villa-row-price">{fmtShort(villa.price)}<span className="price-unit">/đêm</span></span>
                </div>

                {villa.amenities.length > 0 && (
                  <div className="villa-row-amenities">
                    {villa.amenities.slice(0,4).map(a => (
                      <span key={a} className="villa-amenity-chip">{amenityLabel(a)}</span>
                    ))}
                    {villa.amenities.length > 4 && (
                      <span className="villa-amenity-chip">+{villa.amenities.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Actions inline on desktop */}
                <div className="villa-row-actions-desktop">
                  <VillaActions villa={villa} />
                </div>
              </div>

              {/* Actions below on mobile */}
              <div className="villa-row-actions-mobile">
                <VillaActions villa={villa} />
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .villa-list { display:flex; flex-direction:column; gap:14px; }

        .villa-row {
          display:       flex;
          align-items:   flex-start;
          gap:           16px;
          background:    var(--white);
          border-radius: var(--radius-lg);
          border:        1px solid rgba(28,43,74,.08);
          box-shadow:    0 1px 6px rgba(28,43,74,.05);
          padding:       16px;
          transition:    box-shadow .2s, transform .2s;
          animation:     slideUp .25s ease both;
        }
        .villa-row:hover {
          box-shadow: 0 4px 20px rgba(28,43,74,.10);
          transform:  translateY(-1px);
        }

        /* Thumbnail */
        .villa-row-thumb {
          width:         90px;
          height:        90px;
          border-radius: var(--radius-md);
          overflow:      hidden;
          flex-shrink:   0;
          background:    var(--ivory-dark, #F0EDE6);
          display:       flex;
          align-items:   center;
          justify-content: center;
        }
        .villa-row-thumb img  { width:100%; height:100%; object-fit:cover; display:block; }
        .villa-row-emoji      { font-size: 2.2rem; }

        /* Info */
        .villa-row-info {
          flex:           1;
          min-width:      0;
          display:        flex;
          flex-direction: column;
          gap:            6px;
        }
        .villa-row-header {
          display:     flex;
          align-items: center;
          gap:         10px;
          flex-wrap:   wrap;
        }
        .villa-row-name {
          font-family: var(--font-display, Georgia, serif);
          font-size:   1.05rem;
          font-style:  italic;
          font-weight: 400;
          color:       var(--navy, #1C2B4A);
        }

        /* Status pill */
        .villa-status-pill {
          display:        inline-flex;
          align-items:    center;
          gap:            5px;
          border-radius:  99px;
          padding:        3px 10px;
          font-size:      0.68rem;
          font-weight:    600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .villa-status-active   { background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.35); color:#8B6914; }
        .villa-status-inactive { background:rgba(28,43,74,.06);   border:1px solid rgba(28,43,74,.15);   color:var(--ink-muted,#8A8F9A); }
        .villa-status-dot {
          width:5px; height:5px; border-radius:50%; background:currentColor; flex-shrink:0;
        }
        .villa-status-active .villa-status-dot   { background: #C9A84C; }
        .villa-status-inactive .villa-status-dot { background: #8A8F9A; }

        /* Meta */
        .villa-row-meta {
          display:     flex;
          align-items: center;
          flex-wrap:   wrap;
          gap:         4px;
          font-size:   0.78rem;
          color:       var(--ink-muted, #8A8F9A);
        }
        .meta-sep { opacity: .4; }
        .villa-row-price {
          font-family: var(--font-display, Georgia, serif);
          font-style:  italic;
          color:       var(--navy, #1C2B4A);
          font-size:   0.88rem;
        }
        .price-unit { font-family: var(--font-body); font-style:normal; font-size:0.72rem; color:var(--ink-muted); }

        /* Amenity chips */
        .villa-row-amenities { display:flex; flex-wrap:wrap; gap:4px; }
        .villa-amenity-chip {
          font-size:      0.68rem;
          padding:        2px 8px;
          background:     rgba(201,168,76,.08);
          border:         1px solid rgba(201,168,76,.22);
          border-radius:  99px;
          color:          #8B6914;
          font-weight:    500;
        }

        /* Actions */
        .villa-row-actions-desktop { margin-top:4px; }
        .villa-row-actions-mobile  { display:none; }

        @media (max-width: 640px) {
          .villa-row { flex-direction:column; gap:12px; }
          .villa-row-thumb { width:100%; height:160px; border-radius:var(--radius-md); }
          .villa-row-thumb img { border-radius:var(--radius-md); }
          .villa-row-actions-desktop { display:none; }
          .villa-row-actions-mobile  {
            display:    block;
            border-top: 0.5px solid rgba(28,43,74,.08);
            padding-top:12px;
          }
        }
      `}</style>
    </>
  );
}
