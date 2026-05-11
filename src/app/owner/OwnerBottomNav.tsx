'use client';
// VillaOS v7 — app/owner/OwnerBottomNav.tsx
// Mobile: Top bar (logo + 3 dots menu) + Bottom Nav (3 tabs)

import Link                             from 'next/link';
import { usePathname }                  from 'next/navigation';
import { useState, useEffect, useRef }  from 'react';
import { logoutAction }                 from '@/lib/services/auth.service';
interface Props {
  isAdmin:  boolean;
  userName: string;
  brand:    string;
}

export default function OwnerBottomNav({ isAdmin, userName, brand }: Props) {
  const pathname  = usePathname();
  const [menu, setMenu]           = useState(false);
  const [guide, setGuide]         = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [holdCount, setHoldCount] = useState(0);
  const [prevCount, setPrevCount] = useState(0);
  const lastYRef  = useRef(0);
  const menuRef   = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);

  // Poll hold count mỗi 30s, phát âm khi có mới
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/owner/hold-count');
        if (!res.ok) return;
        const { count } = await res.json();
        setHoldCount(count);
        setPrevCount(prev => {
          if (count > prev && prev > 0) {
            // Phát âm thông báo
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
            } catch {}
          }
          return count;
        });
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setNavHidden(y > lastYRef.current && y > 60);
      lastYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Đóng menu khi chạm ra ngoài
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) { setMenu(false); setGuide(false); }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menu]);

  const tabs = [
    {
      href:  '/owner/dashboard',
      label: 'Tổng quan',
      icon:  (a: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3"  y="3"  width="7" height="7" rx="1"/>
          <rect x="14" y="3"  width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
          <rect x="3"  y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      href:  '/owner/calendar',
      label: 'Home',
      icon:  (a: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a?0:1.8} strokeLinecap="round" strokeLinejoin="round">
          {a
            ? <path d="M3 12L12 3l9 9v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V12zm6 9v-6h6v6"/>
            : <><path d="M3 12L12 3l9 9v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V12z"/><polyline points="9 22 9 16 15 16 15 22"/></>
          }
        </svg>
      ),
    },
    {
      href:  '/owner/calendar?view=holds',
      label: 'Hold',
      icon:  (a: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="1" x2="6" y2="4"/>
          <line x1="10" y1="1" x2="10" y2="4"/>
          <line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="mob-topbar">
        <div className="mob-topbar__brand">
          <span className="mob-topbar__logo">🏡</span>
          <div>
            <div className="mob-topbar__name">VillaOS</div>
            <div className="mob-topbar__sub">{brand || userName}</div>
          </div>
        </div>
        <button ref={btnRef} className="mob-topbar__more" onClick={() => { setMenu(v => !v); setGuide(false); }} aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5"  cy="12" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="19" cy="12" r="2"/>
          </svg>
        </button>

        {menu && (
          <div ref={menuRef} className="mob-menu">
            {isAdmin && (
              <>
                <Link href="/admin/dashboard" className="mob-menu__item" onClick={() => setMenu(false)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Admin Panel
                </Link>
                <Link href="/admin/users" className="mob-menu__item" onClick={() => setMenu(false)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Quản lý Users
                </Link>
                <div className="mob-menu__divider" />
              </>
            )}
            <div className="mob-menu__user">
              <div className="mob-menu__avatar">{userName.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight:600, fontSize:'0.85rem', color:'#1C2B4A' }}>{userName}</div>
                <div style={{ fontSize:'0.7rem', color:'var(--ink-muted)', letterSpacing:'0.04em', textTransform:'uppercase' }}>{brand || 'Chủ Villa'}</div>
              </div>
            </div>
            <div className="mob-menu__divider" />

            {/* Hướng dẫn */}
            <button className="mob-menu__item" onClick={() => setGuide(v => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Hướng dẫn sử dụng
              <svg style={{ marginLeft:'auto', transition:'transform .2s', transform: guide ? 'rotate(180deg)' : 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {guide && (
              <div className="mob-guide">
                {[
                  { num:'1', title:'Thêm villa', desc:'Tab "Villa" → "+ Thêm villa mới". Điền tên, địa chỉ, số phòng, giá/đêm, ảnh, tiện ích và số hotline. Nhấn Lưu.' },
                  { num:'2', title:'Cài hotline', desc:'Điền số hotline trong trang chỉnh sửa villa. Sale sẽ thấy số này sau khi tạo hold để chủ động liên hệ với bạn.' },
                  { num:'3', title:'Đọc lịch', desc:'Ô trắng: còn trống. Xanh đậm: đã có booking (tên khách + giá). Vàng: đang hold chờ xác nhận. Đỏ: ngày bạn khóa.' },
                  { num:'4', title:'Khóa ngày', desc:'Bấm vào ô ngày trống → "Khóa phòng". Dùng khi villa đang bảo trì hoặc bạn muốn nghỉ. Bấm lại để mở khóa.' },
                  { num:'5', title:'Xác nhận hold', desc:'Khi sale tạo hold, ô vàng xuất hiện. Bấm vào → "Xác nhận" để chuyển thành Đã đặt, hoặc "Hủy" nếu không phù hợp.' },
                  { num:'6', title:'Doanh thu', desc:'"Tổng quan" → mở mục Doanh thu. Xem tháng này, tháng trước, năm nay và biểu đồ 6 tháng theo từng villa.' },
                  { num:'7', title:'KYC', desc:'Hoàn thành xác minh danh tính để mở tính năng thanh toán và tăng độ tin cậy với sale và khách hàng.' },
                ].map(s => (
                  <div key={s.num} className="mob-guide__step">
                    <div className="mob-guide__num">{s.num}</div>
                    <div>
                      <div className="mob-guide__title">{s.title}</div>
                      <div className="mob-guide__desc">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mob-menu__divider" />
            <form action={logoutAction}>
              <button type="submit" className="mob-menu__item mob-menu__item--danger">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Đăng xuất
              </button>
            </form>
          </div>
        )}
      </header>

      {/* ── Bottom Navigation ── */}
      <nav className={`mob-bottom-nav${navHidden ? ' mob-bottom-nav--hidden' : ''}`}>
        {tabs.map(tab => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={'mob-tab' + (active ? ' mob-tab--active' : '')}>
              <span className="mob-tab__icon" style={{ position:'relative' }}>
                {tab.icon(active)}
                {tab.label === 'Hold' && holdCount > 0 && (
                  <span className="mob-tab__badge">{holdCount}</span>
                )}
              </span>
              <span className="mob-tab__label">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {

          /* ── Top Bar ── */
          .mob-topbar {
            position:        fixed;
            top: 0; left: 0; right: 0;
            height:          calc(56px + env(safe-area-inset-top));
            padding-top:     env(safe-area-inset-top);
            background:      rgba(247,245,240,0.82);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            border-bottom:   0.5px solid rgba(201,168,76,.2);
            box-shadow:      0 1px 12px rgba(28,43,74,.07);
            z-index:         300;
            display:         flex;
            align-items:     center;
            justify-content: space-between;
            padding-left:    16px;
            padding-right:   16px;
          }
          .mob-topbar__brand { display:flex; align-items:center; gap:10px; }
          .mob-topbar__logo  { font-size: 1.4rem; line-height: 1; }
          .mob-topbar__name  {
            font-family: Georgia, 'Times New Roman', serif;
            font-size:   1rem;
            font-style:  italic;
            font-weight: 400;
            color:       #1C2B4A;
            line-height: 1.2;
          }
          .mob-topbar__sub {
            display:        inline-flex;
            align-items:    center;
            gap:            4px;
            font-size:      0.62rem;
            font-weight:    600;
            color:          #8B6914;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            background:     rgba(201,168,76,.12);
            border:         1px solid rgba(201,168,76,.3);
            border-radius:  99px;
            padding:        1px 7px;
            margin-top:     2px;
          }
          .mob-topbar__sub::before {
            content:       '';
            width:         5px; height: 5px;
            border-radius: 50%;
            background:    #C9A84C;
          }
          .mob-topbar__more {
            display:         flex;
            align-items:     center;
            justify-content: center;
            width:  36px; height: 36px;
            border-radius:   50%;
            border:          1px solid rgba(28,43,74,.12);
            background:      rgba(28,43,74,.04);
            color:           #1C2B4A;
            cursor:          pointer;
            transition:      background .15s;
          }
          .mob-topbar__more:hover { background: rgba(201,168,76,.1); border-color: rgba(201,168,76,.3); }

          /* ── Dropdown ── */
          .mob-menu {
            position:        fixed;
            top:             calc(56px + env(safe-area-inset-top) + 6px);
            right:           12px;
            min-width:       260px;
            max-width:       calc(100vw - 24px);
            max-height:      75vh;
            overflow-y:      auto;
            background:      rgba(247,245,240,0.97);
            backdrop-filter: blur(16px);
            border-radius:   16px;
            box-shadow:      0 8px 32px rgba(28,43,74,.16);
            border:          1px solid rgba(201,168,76,.15);
            z-index:         310;
            animation:       mobMenuIn .15s ease;
          }
          @keyframes mobMenuIn {
            from { opacity:0; transform:translateY(-8px) scale(.97); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
          .mob-menu__avatar {
            width:           34px; height: 34px;
            border-radius:   50%;
            background:      linear-gradient(135deg, #1C2B4A, #2E4270);
            color:           #C9A84C;
            display:         flex;
            align-items:     center;
            justify-content: center;
            font-family:     Georgia, serif;
            font-size:       1rem;
            font-style:      italic;
            flex-shrink:     0;
          }
          .mob-menu__user    { display:flex; align-items:center; gap:10px; padding:14px 16px; }
          .mob-menu__divider { height:0.5px; background:rgba(28,43,74,.08); }
          .mob-menu__item {
            display:     flex;
            align-items: center;
            gap:         10px;
            padding:     12px 16px;
            font-size:   0.85rem;
            font-weight: 500;
            color:       #1C2B4A;
            text-decoration: none;
            background:  none;
            border:      none;
            width:       100%;
            cursor:      pointer;
            transition:  background .1s;
            letter-spacing: 0.01em;
          }
          .mob-menu__item:hover        { background: rgba(201,168,76,.08); }
          .mob-menu__item--danger      { color: #c0392b; }
          .mob-menu__item--danger:hover{ background: rgba(192,57,43,.06); }

          /* Guide steps */
          .mob-guide {
            padding:       8px 14px 12px;
            border-bottom: 0.5px solid rgba(28,43,74,.06);
            display:       flex;
            flex-direction:column;
            gap:           10px;
          }
          .mob-guide__step {
            display:     flex;
            align-items: flex-start;
            gap:         10px;
          }
          .mob-guide__num {
            width:           22px; height: 22px;
            border-radius:   50%;
            background:      #1C2B4A;
            color:           #C9A84C;
            font-size:       0.68rem;
            font-weight:     600;
            display:         flex;
            align-items:     center;
            justify-content: center;
            flex-shrink:     0;
            margin-top:      1px;
          }
          .mob-guide__title {
            font-size:   0.82rem;
            font-weight: 600;
            color:       #1C2B4A;
            margin-bottom: 2px;
          }
          .mob-guide__desc {
            font-size:   0.73rem;
            color:       #8A8F9A;
            line-height: 1.5;
          }

          /* ── Bottom Nav ── */
          .mob-bottom-nav {
            position:        fixed;
            bottom: 0; left: 0; right: 0;
            height:          calc(60px + env(safe-area-inset-bottom));
            padding-bottom:  env(safe-area-inset-bottom);
            background:      rgba(247,245,240,0.92);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            border-top:      0.5px solid rgba(201,168,76,.15);
            box-shadow:      0 -2px 16px rgba(28,43,74,.07);
            z-index:         200;
            display:         flex;
            justify-content: space-around;
            align-items:     stretch;
            transform:       translateY(0);
            transition:      transform .3s cubic-bezier(.4,0,.2,1);
          }
          .mob-bottom-nav--hidden { transform: translateY(100%); }

          .mob-tab {
            display:         flex;
            flex-direction:  column;
            align-items:     center;
            justify-content: center;
            flex:            1;
            gap:             3px;
            text-decoration: none;
            color:           #8A8F9A;
            transition:      color .15s;
            padding-top:     6px;
            position:        relative;
          }
          .mob-tab--active { color: #1C2B4A; }
          .mob-tab--active::before {
            content:       '';
            position:      absolute;
            top:           0;
            left:          25%; right: 25%;
            height:        2px;
            background:    linear-gradient(90deg, transparent, #C9A84C, transparent);
            border-radius: 0 0 2px 2px;
          }
          .mob-tab__icon  { display:flex; align-items:center; justify-content:center; position:relative; }
          .mob-tab__label {
            font-size:      0.58rem;
            font-weight:    600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .mob-tab__badge {
            position:   absolute;
            top:        -4px; right: -6px;
            background: #78303F;
            color:      white;
            border-radius: 99px;
            min-width:  16px; height: 16px;
            font-size:  0.55rem;
            font-weight:700;
            display:    flex;
            align-items:center;
            justify-content:center;
            padding:    0 3px;
            border:     1.5px solid rgba(247,245,240,.9);
            animation:  badgePop .3s ease;
          }
          @keyframes badgePop {
            0%   { transform: scale(0); }
            70%  { transform: scale(1.2); }
            100% { transform: scale(1); }
          }

          .main-content {
            margin-top:     calc(56px + env(safe-area-inset-top)) !important;
            padding-bottom: calc(72px + env(safe-area-inset-bottom)) !important;
            padding-top:    16px !important;
          }
        }

        @media (min-width: 769px) {
          .mob-topbar     { display: none !important; }
          .mob-bottom-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
