'use client';
// VillaOS v7 — app/sale/SaleBottomNav.tsx

import Link                        from 'next/link';
import { usePathname }             from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { logoutAction }            from '@/lib/services/auth.service';

interface Props { userName: string; }

const TABS = [
  {
    href:  '/sale/calendar',
    label: 'Lịch villa',
    icon:  (a: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href:  '/sale/bookings',
    label: 'Booking',
    icon:  (a: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    href:  '/sale/customers',
    label: 'Khách hàng',
    icon:  (a: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.2:1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

export default function SaleBottomNav({ userName }: Props) {
  const pathname  = usePathname();
  const [menu, setMenu]         = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setNavHidden(y > lastYRef.current && y > 60);
      lastYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="mob-topbar">
        <div className="mob-topbar__brand">
          <span className="mob-topbar__logo">🏡</span>
          <div>
            <div className="mob-topbar__name">VillaOS</div>
            <div className="mob-topbar__sub">{userName}</div>
          </div>
        </div>
        <button className="mob-topbar__more" onClick={() => setMenu(v => !v)} aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5"  cy="12" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="19" cy="12" r="2"/>
          </svg>
        </button>

        {menu && (
          <>
            <div className="mob-menu-backdrop" onClick={() => setMenu(false)} />
            <div className="mob-menu">
              <div className="mob-menu__user">
                <div className="mob-menu__avatar">{userName.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--navy,#1C2B4A)' }}>{userName}</div>
                  <div style={{ fontSize:'0.7rem', color:'var(--ink-muted)', letterSpacing:'0.04em', textTransform:'uppercase' }}>Sale</div>
                </div>
              </div>
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
          </>
        )}
      </header>

      {/* ── Bottom Navigation ── */}
      <nav className={`mob-bottom-nav${navHidden ? ' mob-bottom-nav--hidden' : ''}`}>
        {TABS.map(tab => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={'mob-tab' + (active ? ' mob-tab--active' : '')}>
              <span className="mob-tab__icon">{tab.icon(active)}</span>
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
          .mob-topbar__brand {
            display:     flex;
            align-items: center;
            gap:         10px;
          }
          .mob-topbar__logo { font-size: 1.4rem; line-height: 1; }
          .mob-topbar__name {
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

          /* ── Dropdown menu ── */
          .mob-menu-backdrop { position:fixed; inset:0; z-index:290; }
          .mob-menu {
            position:      fixed;
            top:           calc(56px + env(safe-area-inset-top) + 6px);
            right:         12px;
            min-width:     210px;
            background:    rgba(247,245,240,0.95);
            backdrop-filter: blur(16px);
            border-radius: 16px;
            box-shadow:    0 8px 32px rgba(28,43,74,.14);
            border:        1px solid rgba(201,168,76,.15);
            z-index:       310;
            overflow:      hidden;
            animation:     mobMenuIn .15s ease;
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
            font-weight:     400;
            flex-shrink:     0;
          }
          .mob-menu__user {
            display:     flex;
            align-items: center;
            gap:         10px;
            padding:     14px 16px;
          }
          .mob-menu__divider {
            height:     0.5px;
            background: rgba(28,43,74,.08);
            margin:     0;
          }
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
          .mob-menu__item:hover { background: rgba(201,168,76,.08); }
          .mob-menu__item--danger { color: #c0392b; }
          .mob-menu__item--danger:hover { background: rgba(192,57,43,.06); }

          /* ── Bottom Nav ── */
          .mob-bottom-nav {
            position:       fixed;
            bottom:         0; left: 0; right: 0;
            height:         calc(60px + env(safe-area-inset-bottom));
            padding-bottom: env(safe-area-inset-bottom);
            background:     rgba(247,245,240,0.92);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            border-top:     0.5px solid rgba(201,168,76,.15);
            box-shadow:     0 -2px 16px rgba(28,43,74,.07);
            z-index:        200;
            display:        flex;
            justify-content:space-around;
            align-items:    stretch;
            transform:      translateY(0);
            transition:     transform .3s cubic-bezier(.4,0,.2,1);
          }
          .mob-bottom-nav--hidden {
            transform: translateY(100%);
          }

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

          /* Gold indicator bar on top */
          .mob-tab--active::before {
            content:       '';
            position:      absolute;
            top:           0;
            left:          25%; right: 25%;
            height:        2px;
            background:    linear-gradient(90deg, transparent, #C9A84C, transparent);
            border-radius: 0 0 2px 2px;
          }

          .mob-tab__icon  { display:flex; align-items:center; justify-content:center; }
          .mob-tab__label {
            font-size:      0.58rem;
            font-weight:    600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          /* Main content offset */
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
