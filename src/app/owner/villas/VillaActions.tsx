'use client';
// VillaOS v7 — app/owner/villas/VillaActions.tsx
import { useState, useTransition } from 'react';
import { useRouter }     from 'next/navigation';
import { useToast }      from '@/components/Toast';
import { deleteVilla }   from '@/lib/services/villa.service';
import Link              from 'next/link';
import type { Villa }    from '@/types/database';
import { fmtMoney }      from '@/lib/utils';

const AMENITY_ICONS: Record<string, string> = {
  pool: '🏊', bbq: '🔥', garden: '🌿', gym: '💪',
  jacuzzi: '🛁', karaoke: '🎤', parking: '🅿️',
  billiard: '🎱', 'xe đạp': '🚲', wifi: '📶',
};

export default function VillaActions({ villa }: { villa: Villa }) {
  const [isPending, startTransition] = useTransition();
  const [showDetail, setShowDetail]  = useState(false);
  const { show } = useToast();
  const router   = useRouter();

  function handleDelete() {
    if (!confirm(`Xóa villa "${villa.name}"? Hành động này không thể hoàn tác.`)) return;
    startTransition(async () => {
      const result = await deleteVilla(villa.id);
      if (result.error) {
        show('error', 'Xóa thất bại', result.error);
      } else {
        show('success', 'Đã xóa villa', villa.name);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="villa-row-actions">
        {/* Xem detail */}
        <button
          onClick={() => setShowDetail(true)}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', padding: '7px 12px' }}
          title="Xem chi tiết villa"
        >
          🏠 Xem
        </button>
        <Link
          href={`/owner/calendar?villa=${villa.id}`}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', padding: '7px 12px' }}
          title="Xem lịch"
        >
          📅
        </Link>
        <Link
          href={`/owner/villas/${villa.id}/edit`}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', padding: '7px 12px' }}
        >
          ✏️ Sửa
        </Link>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', padding: '7px 12px', color: 'var(--red)', borderColor: 'rgba(192,57,43,.3)' }}
        >
          {isPending ? '...' : '🗑️'}
        </button>
      </div>

      {/* ── VILLA DETAIL MODAL ── */}
      {showDetail && (
        <div className="vd-overlay" onClick={() => setShowDetail(false)}>
          <div className="vd-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="vd-header">
              <h3>{villa.emoji} {villa.name}</h3>
              <button className="vd-close" onClick={() => setShowDetail(false)}>×</button>
            </div>

            <div className="vd-body">
              {/* Album ảnh */}
              {villa.images && villa.images.length > 0 && (
                <div className="vd-gallery">
                  {villa.images.map((src, i) => (
                    <div key={i} className="vd-gallery-cell">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`${villa.name} ${i + 1}`} />
                      <a
                        className="vd-img-dl"
                        href={src}
                        download={`${villa.name}-${i + 1}.jpg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        title="Tải ảnh"
                      >⬇</a>
                    </div>
                  ))}
                </div>
              )}

              <div className="vd-content">
                {/* Trạng thái + giá */}
                <div className="vd-status-row">
                  <span className="vd-status-badge">
                    <span className="vd-status-dot" />
                    {villa.status === 'active' ? 'Đang hoạt động' : villa.status}
                  </span>
                  <span className="vd-price">
                    {fmtMoney(villa.price)}
                    <span className="vd-price-unit">/đêm</span>
                  </span>
                </div>

                {/* Meta grid */}
                <div className="vd-meta-grid">
                  <div className="vd-meta-item">
                    <span className="vd-meta-icon">📍</span>
                    <div>
                      <div className="vd-meta-label">Địa chỉ</div>
                      <div className="vd-meta-val">
                        {[villa.street, villa.ward, villa.district, villa.province].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="vd-meta-item">
                    <span className="vd-meta-icon">🛏</span>
                    <div>
                      <div className="vd-meta-label">Phòng ngủ</div>
                      <div className="vd-meta-val">{villa.bedrooms} phòng</div>
                    </div>
                  </div>
                  <div className="vd-meta-item">
                    <span className="vd-meta-icon">👥</span>
                    <div>
                      <div className="vd-meta-label">Sức chứa</div>
                      <div className="vd-meta-val">
                        {villa.adults} người lớn{(villa.children ?? 0) > 0 ? ` · ${villa.children} trẻ em` : ''}
                      </div>
                    </div>
                  </div>
                  {villa.phone && (
                    <div className="vd-meta-item">
                      <span className="vd-meta-icon">📞</span>
                      <div>
                        <div className="vd-meta-label">Hotline</div>
                        <div className="vd-meta-val">
                          <a href={`tel:${villa.phone}`} style={{ color: 'var(--forest)', fontWeight: 600 }}>
                            {villa.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tiện ích */}
                {villa.amenities && villa.amenities.length > 0 && (
                  <div className="vd-section">
                    <div className="vd-section-title">✨ Tiện ích</div>
                    <div className="vd-amenities">
                      {villa.amenities.map(a => (
                        <div key={a} className="vd-amenity-chip">
                          <span>{AMENITY_ICONS[a] ?? '✅'}</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mô tả */}
                {villa.description && (
                  <div className="vd-section">
                    <div className="vd-section-title">📝 Giới thiệu</div>
                    <p className="vd-desc">{villa.description}</p>
                  </div>
                )}

                {/* Tải ảnh */}
                {villa.images && villa.images.length > 0 && (
                  <div className="vd-section">
                    <div className="vd-section-title">📸 Tải ảnh gửi khách</div>
                    <div className="vd-downloads">
                      {villa.images.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          download={`${villa.name}-anh-${i + 1}.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vd-dl-btn"
                        >
                          ⬇ Ảnh {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .villa-row-actions {
          display:    flex;
          gap:        6px;
          flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .villa-row-actions { width: 100%; justify-content: flex-end; }
        }

        /* ── Detail modal ── */
        .vd-overlay {
          position:        fixed;
          inset:           0;
          background:      rgba(0,0,0,.55);
          z-index:         9999;
          display:         flex;
          align-items:     center;
          justify-content: center;
          animation:       fadeIn .15s ease;
        }
        .vd-modal {
          background:    var(--white);
          border-radius: var(--radius-xl);
          box-shadow:    0 20px 60px rgba(0,0,0,.25);
          width:         90vw;
          max-width:     820px;
          max-height:    88vh;
          overflow-y:    auto;
          display:       flex;
          flex-direction: column;
        }
        .vd-header {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         18px 24px;
          border-bottom:   1px solid var(--sage-pale);
          position:        sticky;
          top:             0;
          background:      var(--white);
          z-index:         1;
        }
        .vd-header h3 { font-size: 1.1rem; color: var(--forest-deep); }
        .vd-close {
          background: none; border: none; font-size: 1.8rem;
          cursor: pointer; color: var(--ink-muted); line-height: 1;
          transition: color .15s;
        }
        .vd-close:hover { color: var(--ink); }
        .vd-body { flex: 1; }

        /* Gallery */
        .vd-gallery {
          display:               grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap:                   6px;
          padding:               16px;
        }
        .vd-gallery-cell {
          position: relative; height: 130px;
          border-radius: var(--radius-md); overflow: hidden;
          background: var(--sage-pale);
        }
        .vd-gallery-cell img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .25s; }
        .vd-gallery-cell:hover img { transform: scale(1.05); }
        .vd-img-dl {
          position:absolute; bottom:6px; right:6px;
          background:rgba(0,0,0,.55); color:white;
          border-radius:99px; width:26px; height:26px;
          display:flex; align-items:center; justify-content:center;
          font-size:0.78rem; text-decoration:none;
          opacity:0; transition:opacity .15s;
        }
        .vd-gallery-cell:hover .vd-img-dl { opacity:1; }

        /* Content */
        .vd-content { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 20px; }
        .vd-status-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .vd-status-badge {
          display:flex; align-items:center; gap:6px;
          font-size:0.82rem; font-weight:600; color:#2e7d52;
          background:#e8f5ee; padding:5px 12px; border-radius:99px;
        }
        .vd-status-dot { width:8px; height:8px; border-radius:50%; background:#4caf7d; }
        .vd-price { font-size:1.3rem; font-weight:700; color:var(--forest); font-family:var(--font-display); }
        .vd-price-unit { font-size:0.8rem; font-weight:400; color:var(--ink-muted); }
        .vd-meta-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:12px; }
        .vd-meta-item { display:flex; align-items:flex-start; gap:10px; }
        .vd-meta-icon { font-size:1.2rem; flex-shrink:0; margin-top:1px; }
        .vd-meta-label { font-size:0.7rem; color:var(--ink-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
        .vd-meta-val { font-size:0.88rem; color:var(--ink); font-weight:500; margin-top:2px; }
        .vd-section { display:flex; flex-direction:column; gap:10px; }
        .vd-section-title {
          font-size:0.78rem; font-weight:700; text-transform:uppercase;
          letter-spacing:0.05em; color:var(--ink-muted);
          padding-bottom:8px; border-bottom:1px solid var(--sage-pale);
        }
        .vd-amenities { display:flex; flex-wrap:wrap; gap:8px; }
        .vd-amenity-chip {
          display:flex; align-items:center; gap:6px; padding:7px 14px;
          background:var(--sage-pale); border:1px solid rgba(180,212,195,.4);
          border-radius:var(--radius-md); font-size:0.82rem;
          color:var(--forest-deep); font-weight:500;
        }
        .vd-desc { font-size:0.9rem; color:var(--ink); line-height:1.7; white-space:pre-wrap; }
        .vd-downloads { display:flex; gap:8px; flex-wrap:wrap; }
        .vd-dl-btn {
          padding:7px 14px; background:var(--forest); color:white;
          border-radius:var(--radius-md); font-size:0.8rem; font-weight:600;
          text-decoration:none; display:inline-flex; align-items:center; gap:5px;
          transition:background .15s;
        }
        .vd-dl-btn:hover { background:var(--forest-deep); }
      `}</style>
    </>
  );
}

