// VillaOS v7 — app/customer/villas/page.tsx
import { getServerSession }       from '@/lib/supabase/server';
import { getCachedPublicVillas }  from '@/lib/cache/query-cache';
import { redirect }               from 'next/navigation';
import { fmtMoney, amenityLabel } from '@/lib/utils';
import VillaGallery               from '@/components/VillaGallery';
import CustomerBookingButton      from './CustomerBookingButton';

export const dynamic = 'force-dynamic';

export default async function CustomerVillasPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const villas = await getCachedPublicVillas();

  return (
    <>
      <div className="page-header">
        <h1>Khám phá villa</h1>
        <p>Chào mừng trở lại, {session.profile.name}</p>
      </div>

      {villas.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 24px' }}>
          <span style={{ fontSize:56, display:'block', marginBottom:16 }}>🏡</span>
          <h3>Chưa có villa nào</h3>
          <p>Quay lại sau nhé!</p>
        </div>
      ) : (
        <div className="customer-villa-grid">
          {villas.map(villa => (
            <div key={villa.id} className="customer-villa-card">
              <VillaGallery images={villa.images} emoji={villa.emoji} name={villa.name} />

              <div className="customer-villa-body">
                <div className="customer-villa-header">
                  <h3 className="customer-villa-name">{villa.name}</h3>
                  <div className="customer-villa-price">
                    <span className="price-amount">{fmtMoney(villa.price)}</span>
                    <span className="price-unit">/đêm</span>
                  </div>
                </div>

                <div className="customer-villa-meta">
                  📍 {villa.district}, {villa.province}
                  &nbsp;·&nbsp;
                  🛏 {villa.bedrooms} phòng ngủ
                  &nbsp;·&nbsp;
                  👥 {villa.adults} người lớn{villa.children > 0 ? ` + ${villa.children} trẻ em` : ''}
                </div>

                {villa.description && (
                  <p className="customer-villa-desc">{villa.description}</p>
                )}

                {villa.amenities.length > 0 && (
                  <div className="customer-villa-amenities">
                    {villa.amenities.map(a => (
                      <span key={a} className="villa-amenity-chip">{amenityLabel(a)}</span>
                    ))}
                  </div>
                )}

                <CustomerBookingButton
                  villa={{ id: villa.id, name: villa.name, price: villa.price, lockedDates: villa.lockedDates }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .customer-villa-grid {
          display:               grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap:                   24px;
        }

        .customer-villa-card {
          background:    var(--white);
          border-radius: var(--radius-xl);
          border:        1px solid rgba(28,43,74,.08);
          box-shadow:    0 2px 12px rgba(28,43,74,.06);
          overflow:      hidden;
          transition:    box-shadow .25s, transform .25s;
          animation:     slideUp .3s ease both;
        }

        .customer-villa-card:hover {
          box-shadow: 0 8px 32px rgba(28,43,74,.13);
          transform:  translateY(-3px);
        }

        .customer-villa-body {
          padding: 16px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .customer-villa-header {
          display:         flex;
          justify-content: space-between;
          align-items:     flex-start;
          gap:             8px;
        }

        .customer-villa-name {
          font-family: var(--font-display);
          font-size:   1.1rem;
          font-style:  italic;
          font-weight: 400;
          color:       var(--navy);
          flex:        1;
        }

        .customer-villa-price {
          display:     flex;
          align-items: baseline;
          gap:         2px;
          flex-shrink: 0;
        }

        .price-amount {
          font-family: var(--font-display);
          font-size:   1.1rem;
          font-style:  italic;
          color:       var(--navy);
          font-weight: 400;
        }

        .price-unit {
          font-family: var(--font-body);
          font-size:   0.72rem;
          color:       var(--ink-muted);
          font-style:  normal;
        }

        .customer-villa-meta {
          font-size:      0.75rem;
          color:          var(--ink-muted);
          letter-spacing: 0.01em;
        }

        .customer-villa-desc {
          font-size:   0.83rem;
          color:       var(--ink-light);
          line-height: 1.55;
          display:     -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow:    hidden;
        }

        .customer-villa-amenities {
          display:   flex;
          flex-wrap: wrap;
          gap:       4px;
        }

        /* Luxury amenity chip */
        .villa-amenity-chip {
          display:        inline-flex;
          align-items:    center;
          padding:        3px 9px;
          border-radius:  99px;
          background:     rgba(201,168,76,.08);
          border:         1px solid rgba(201,168,76,.25);
          font-size:      0.72rem;
          color:          #8B6914;
          font-weight:    500;
          letter-spacing: 0.02em;
        }
      `}</style>
    </>
  );
}
