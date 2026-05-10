'use client';
// VillaOS v7 — app/owner/dashboard/DashboardAccordion.tsx
// 5 accordion sections — chỉ mở khi bấm vào

import { useState } from 'react';
import Link from 'next/link';

export interface UpcomingBooking {
  id: string; customer: string; phone: string;
  villaName: string; villaEmoji: string;
  checkin: string; checkout: string;
  nights: number; total: number;
  isToday: boolean; isTomorrow: boolean;
}

export interface HoldBooking {
  id: string; customer: string; phone: string;
  villaName: string; status: string;
  checkin: string; checkout: string;
  total: number; createdAt: string;
  holdExpiresAt?: string;
}

export interface RevenueData {
  thisMonth: number; lastMonth: number; thisYear: number;
  byVilla: { name: string; emoji: string; thisMonth: number; total: number }[];
  monthly: { label: string; value: number }[];
}

export interface KycData {
  status: string; submittedAt?: string;
}

export interface VillaItem {
  id: string; name: string; emoji: string;
  district: string; province: string;
  bedrooms: number; adults: number; price: number;
  status: string; images: string[];
}

interface Props {
  upcoming:    UpcomingBooking[];
  holdHistory: HoldBooking[];
  revenue:     RevenueData;
  kyc:         KycData;
  villas:      VillaItem[];
}

const SECTIONS = [
  { key: 'checkin',  icon: '📆', label: 'Check-in sắp tới' },
  { key: 'history',  icon: '📋', label: 'Lịch sử hold & booking' },
  { key: 'revenue',  icon: '💰', label: 'Doanh thu' },
  { key: 'villas',   icon: '🏠', label: 'Villa của tôi' },
  { key: 'kyc',      icon: '🪪', label: 'Xác minh KYC' },
  { key: 'guide',    icon: '📖', label: 'Hướng dẫn sử dụng' },
];

function fmtShort(n: number) {
  if (!n) return '0đ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  return n.toLocaleString('vi-VN') + 'đ';
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function DashboardAccordion({ upcoming, holdHistory, revenue, kyc, villas }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen(o => o === key ? null : key);

  const maxRev = Math.max(...revenue.monthly.map(m => m.value), 1);

  return (
    <div className="accordion-wrap">
      {SECTIONS.map(s => (
        <div key={s.key} className={`acc-item${open === s.key ? ' acc-item--open' : ''}`}>
          {/* ── Header ── */}
          <button className="acc-header" onClick={() => toggle(s.key)}>
            <span className="acc-icon">{s.icon}</span>
            <span className="acc-label">{s.label}</span>
            {s.key === 'checkin' && upcoming.length > 0 && (
              <span className="acc-badge">{upcoming.length}</span>
            )}
            {s.key === 'history' && holdHistory.length > 0 && (
              <span className="acc-badge">{holdHistory.length}</span>
            )}
            {s.key === 'kyc' && kyc.status !== 'approved' && (
              <span className="acc-badge acc-badge--warn">!</span>
            )}
            <svg className="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* ── Body ── */}
          {open === s.key && (
            <div className="acc-body">

              {/* CHECK-IN SẮP TỚI */}
              {s.key === 'checkin' && (
                upcoming.length === 0
                  ? <p className="acc-empty">Không có check-in nào trong 14 ngày tới.</p>
                  : upcoming.map(b => (
                    <div key={b.id} className={`acc-row${b.isToday ? ' acc-row--today' : ''}`}>
                      <span className="acc-row-emoji">{b.villaEmoji}</span>
                      <div className="acc-row-info">
                        <div className="acc-row-name">{b.customer}</div>
                        <div className="acc-row-meta">{b.villaName} · {b.phone}</div>
                        <div className="acc-row-meta">{fmtDate(b.checkin)} → {fmtDate(b.checkout)} · {b.nights} đêm</div>
                      </div>
                      <div className="acc-row-right">
                        <div className="acc-row-total">{fmtShort(b.total)}</div>
                        {b.isToday   && <span className="acc-tag acc-tag--today">Hôm nay</span>}
                        {b.isTomorrow && !b.isToday && <span className="acc-tag acc-tag--tmr">Ngày mai</span>}
                      </div>
                    </div>
                  ))
              )}

              {/* LỊCH SỬ HOLD & BOOKING */}
              {s.key === 'history' && (
                holdHistory.length === 0
                  ? <p className="acc-empty">Chưa có lịch sử.</p>
                  : holdHistory.slice(0, 15).map(b => (
                    <div key={b.id} className="acc-row">
                      <div className={`acc-status-dot acc-status--${b.status}`} />
                      <div className="acc-row-info">
                        <div className="acc-row-name">{b.customer || '—'}</div>
                        <div className="acc-row-meta">{b.villaName} · {fmtDate(b.checkin)} → {fmtDate(b.checkout)}</div>
                      </div>
                      <div className="acc-row-right">
                        <div className="acc-row-total">{fmtShort(b.total)}</div>
                        <span className={`acc-tag acc-status-tag--${b.status}`}>
                          {b.status === 'confirmed' ? 'Đã đặt' : b.status === 'hold' ? 'Hold' : b.status === 'cancelled' ? 'Huỷ' : b.status}
                        </span>
                      </div>
                    </div>
                  ))
              )}

              {/* DOANH THU */}
              {s.key === 'revenue' && (
                <>
                  <div className="rev-grid">
                    <div className="rev-card">
                      <div className="rev-label">Tháng này</div>
                      <div className="rev-val">{fmtShort(revenue.thisMonth)}</div>
                    </div>
                    <div className="rev-card">
                      <div className="rev-label">Tháng trước</div>
                      <div className="rev-val">{fmtShort(revenue.lastMonth)}</div>
                    </div>
                    <div className="rev-card rev-card--full">
                      <div className="rev-label">Năm nay (tích lũy)</div>
                      <div className="rev-val">{fmtShort(revenue.thisYear)}</div>
                    </div>
                  </div>
                  {/* Biểu đồ cột mini */}
                  <div className="mini-chart">
                    {revenue.monthly.map(m => (
                      <div key={m.label} className="mini-bar-wrap">
                        <div className="mini-bar" style={{ height: `${Math.round((m.value / maxRev) * 60)}px` }} />
                        <div className="mini-bar-label">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Theo villa */}
                  {revenue.byVilla.map(v => (
                    <div key={v.name} className="acc-row">
                      <span className="acc-row-emoji">{v.emoji}</span>
                      <div className="acc-row-info">
                        <div className="acc-row-name">{v.name}</div>
                        <div className="acc-row-meta">Tổng cộng: {fmtShort(v.total)}</div>
                      </div>
                      <div className="acc-row-right">
                        <div className="acc-row-total">{fmtShort(v.thisMonth)}</div>
                        <div className="acc-row-meta">tháng này</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* VILLA CỦA TÔI */}
              {s.key === 'villas' && (
                <>
                  <div style={{ display:'flex', justifyContent:'flex-end', padding:'8px 0 4px' }}>
                    <Link href="/owner/villas/new" style={{ fontSize:'0.72rem', color:'#1C2B4A', textDecoration:'none', fontWeight:600, border:'1px solid rgba(28,43,74,.15)', borderRadius:'99px', padding:'4px 12px' }}>
                      + Thêm villa
                    </Link>
                  </div>
                  {villas.length === 0
                    ? <p className="acc-empty">Chưa có villa nào.</p>
                    : villas.map(v => (
                      <div key={v.id} className="acc-row">
                        <div className="villa-acc-thumb">
                          {v.images[0]
                            ? <img src={v.images[0]} alt={v.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} />
                            : <span style={{ fontSize:'1.4rem' }}>{v.emoji}</span>}
                        </div>
                        <div className="acc-row-info">
                          <div className="acc-row-name">{v.name}</div>
                          <div className="acc-row-meta">📍 {v.district}, {v.province}</div>
                          <div className="acc-row-meta">🛏 {v.bedrooms} phòng · 👥 {v.adults} người · {fmtShort(v.price)}/đêm</div>
                        </div>
                        <div className="acc-row-right">
                          <span className={`villa-acc-badge ${v.status === 'active' ? 'villa-acc-badge--active' : 'villa-acc-badge--off'}`}>
                            {v.status === 'active' ? 'Hoạt động' : 'Dừng'}
                          </span>
                          <Link href={`/owner/villas/${v.id}/edit`} style={{ fontSize:'0.68rem', color:'#8A8F9A', textDecoration:'none', marginTop:4 }}>Sửa →</Link>
                        </div>
                      </div>
                    ))
                  }
                </>
              )}

              {/* KYC */}
              {s.key === 'kyc' && (
                <div className="kyc-wrap">
                  <div className={`kyc-status kyc-status--${kyc.status}`}>
                    {kyc.status === 'approved' && '✅ Đã xác minh — tài khoản đầy đủ quyền'}
                    {kyc.status === 'pending'  && '⏳ Đang chờ xét duyệt'}
                    {kyc.status === 'rejected' && '❌ Xác minh thất bại — vui lòng nộp lại'}
                    {!['approved','pending','rejected'].includes(kyc.status) && '⚠️ Chưa xác minh — cần hoàn thành để sử dụng đầy đủ'}
                  </div>
                  {kyc.submittedAt && (
                    <p className="acc-row-meta" style={{ marginTop: 6 }}>
                      Nộp lúc: {new Date(kyc.submittedAt).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                  <Link href="/owner/kyc" className="kyc-btn">
                    {kyc.status === 'approved' ? 'Xem thông tin KYC' : 'Hoàn thành xác minh KYC →'}
                  </Link>
                </div>
              )}

              {/* HƯỚNG DẪN */}
              {s.key === 'guide' && (
                <div className="guide-list">
                  {[
                    { step: '1', title: 'Thêm villa',         desc: 'Vào Villa → Thêm villa mới, điền đầy đủ thông tin.' },
                    { step: '2', title: 'Quản lý lịch',       desc: 'Vào Lịch phòng để xem booking, tạo hold, khoá ngày.' },
                    { step: '3', title: 'Theo dõi doanh thu', desc: 'Mục Doanh thu cho thấy số liệu tháng này và từng villa.' },
                    { step: '4', title: 'Xác minh KYC',       desc: 'Hoàn thành KYC để mở khoá tính năng thanh toán.' },
                    { step: '5', title: 'Hỗ trợ',             desc: 'Liên hệ admin qua Zalo/Hotline nếu cần trợ giúp.' },
                  ].map(g => (
                    <div key={g.step} className="guide-row">
                      <div className="guide-step">{g.step}</div>
                      <div>
                        <div className="acc-row-name">{g.title}</div>
                        <div className="acc-row-meta">{g.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <style>{`
        .accordion-wrap { display:flex; flex-direction:column; gap:10px; }

        /* Item */
        .acc-item {
          background:    #fff;
          border:        1px solid rgba(28,43,74,.08);
          border-radius: 14px;
          overflow:      hidden;
          transition:    box-shadow .2s;
        }
        .acc-item--open { box-shadow: 0 4px 20px rgba(28,43,74,.08); }

        /* Header */
        .acc-header {
          display:         flex;
          align-items:     center;
          gap:             10px;
          width:           100%;
          padding:         14px 16px;
          background:      none;
          border:          none;
          cursor:          pointer;
          text-align:      left;
          transition:      background .12s;
        }
        .acc-header:hover { background: rgba(201,168,76,.04); }
        .acc-item--open .acc-header { background: rgba(201,168,76,.06); }
        .acc-icon  { font-size: 1.1rem; flex-shrink: 0; }
        .acc-label {
          flex:           1;
          font-family:    Georgia, serif;
          font-style:     italic;
          font-size:      0.95rem;
          font-weight:    400;
          color:          #1C2B4A;
        }
        .acc-badge {
          background:     rgba(28,43,74,.08);
          color:          #1C2B4A;
          border-radius:  99px;
          padding:        1px 8px;
          font-size:      0.68rem;
          font-weight:    600;
          flex-shrink:    0;
        }
        .acc-badge--warn {
          background: rgba(120,48,63,.1);
          color:      #78303F;
        }
        .acc-chevron {
          flex-shrink:  0;
          color:        #8A8F9A;
          transition:   transform .2s;
        }
        .acc-item--open .acc-chevron { transform: rotate(180deg); }

        /* Body */
        .acc-body {
          padding:     0 14px 14px;
          border-top:  0.5px solid rgba(28,43,74,.06);
          animation:   accOpen .15s ease;
        }
        @keyframes accOpen {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .acc-empty { font-size:0.82rem; color:#8A8F9A; padding:12px 0; margin:0; }

        /* Row */
        .acc-row {
          display:       flex;
          align-items:   center;
          gap:           10px;
          padding:       10px 0;
          border-bottom: 0.5px solid rgba(28,43,74,.06);
        }
        .acc-row:last-child { border-bottom: none; }
        .acc-row--today { background: rgba(201,168,76,.06); border-radius:8px; padding:10px 8px; margin:2px 0; }
        .acc-row-emoji  { font-size:1.3rem; flex-shrink:0; }
        .acc-status-dot {
          width:10px; height:10px; border-radius:50%; flex-shrink:0;
        }
        .acc-status--confirmed { background:#1C2B4A; }
        .acc-status--hold      { background:#C9A84C; }
        .acc-status--cancelled { background:#8A8F9A; }
        .acc-row-info  { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
        .acc-row-name  { font-size:0.85rem; font-weight:500; color:#1C2B4A; }
        .acc-row-meta  { font-size:0.72rem; color:#8A8F9A; }
        .acc-row-right { display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; }
        .acc-row-total { font-family:Georgia,serif; font-style:italic; font-size:0.88rem; color:#1C2B4A; }
        .acc-tag {
          font-size:0.6rem; font-weight:600; padding:1px 6px;
          border-radius:99px; letter-spacing:0.04em; text-transform:uppercase;
        }
        .acc-tag--today  { background:rgba(201,168,76,.15); color:#8B6914; border:1px solid rgba(201,168,76,.3); }
        .acc-tag--tmr    { background:rgba(28,43,74,.08);   color:#1C2B4A;  border:1px solid rgba(28,43,74,.15); }
        .acc-status-tag--confirmed { background:rgba(28,43,74,.08);  color:#1C2B4A;  border:1px solid rgba(28,43,74,.15); font-size:0.6rem; padding:1px 6px; border-radius:99px; }
        .acc-status-tag--hold      { background:rgba(201,168,76,.12);color:#8B6914;  border:1px solid rgba(201,168,76,.3); font-size:0.6rem; padding:1px 6px; border-radius:99px; }
        .acc-status-tag--cancelled { background:rgba(90,90,90,.08);  color:#666;     border:1px solid rgba(90,90,90,.15); font-size:0.6rem; padding:1px 6px; border-radius:99px; }

        /* Revenue */
        .rev-grid {
          display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:10px 0;
        }
        .rev-card {
          background:#F7F5F0; border-radius:10px; padding:10px 12px;
        }
        .rev-card--full { grid-column:span 2; }
        .rev-label { font-size:0.68rem; color:#8A8F9A; margin-bottom:2px; }
        .rev-val   { font-family:Georgia,serif; font-style:italic; font-size:1.1rem; color:#1C2B4A; }

        /* Mini chart */
        .mini-chart {
          display:     flex;
          align-items: flex-end;
          gap:         6px;
          height:      80px;
          padding:     8px 0 4px;
          border-bottom: 0.5px solid rgba(28,43,74,.06);
          margin-bottom: 8px;
        }
        .mini-bar-wrap {
          flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
        }
        .mini-bar {
          width:100%; background:#1C2B4A; border-radius:3px 3px 0 0;
          min-height:3px; transition:height .3s;
        }
        .mini-bar-label { font-size:0.58rem; color:#8A8F9A; white-space:nowrap; }

        /* KYC */
        .kyc-wrap { padding: 10px 0; }
        .kyc-status {
          font-size:0.83rem; padding:10px 12px;
          border-radius:10px; margin-bottom:10px;
          line-height:1.5;
        }
        .kyc-status--approved { background:rgba(28,43,74,.06);  color:#1C2B4A; }
        .kyc-status--pending  { background:rgba(201,168,76,.1); color:#8B6914; }
        .kyc-status--rejected { background:rgba(120,48,63,.08); color:#78303F; }
        .kyc-btn {
          display:inline-flex; align-items:center;
          padding:8px 16px; border-radius:99px;
          background:#1C2B4A; color:#fff;
          font-size:0.78rem; font-weight:500;
          text-decoration:none; transition:opacity .15s;
        }
        .kyc-btn:hover { opacity:.85; }

        /* Guide */
        .villa-acc-thumb {
          width:56px; height:56px; border-radius:8px;
          overflow:hidden; flex-shrink:0;
          background:#F0EDE6;
          display:flex; align-items:center; justify-content:center;
        }
        .villa-acc-badge {
          font-size:0.6rem; font-weight:600; padding:2px 8px;
          border-radius:99px; letter-spacing:0.04em;
          text-transform:uppercase; white-space:nowrap;
        }
        .villa-acc-badge--active { background:rgba(201,168,76,.12); color:#8B6914; border:1px solid rgba(201,168,76,.3); }
        .villa-acc-badge--off    { background:rgba(90,90,90,.08);   color:#666;    border:1px solid rgba(90,90,90,.15); }

        .guide-list { display:flex; flex-direction:column; gap:0; }
        .guide-row {
          display:flex; align-items:flex-start; gap:12px;
          padding:10px 0; border-bottom:0.5px solid rgba(28,43,74,.06);
        }
        .guide-row:last-child { border-bottom:none; }
        .guide-step {
          width:24px; height:24px; border-radius:50%;
          background:#1C2B4A; color:#C9A84C;
          display:flex; align-items:center; justify-content:center;
          font-size:0.72rem; font-weight:600; flex-shrink:0; margin-top:1px;
        }
      `}</style>
    </div>
  );
}
