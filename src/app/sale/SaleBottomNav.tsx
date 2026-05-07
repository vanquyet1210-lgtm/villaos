'use client';
// VillaOS v7 — app/sale/SaleBottomNav.tsx

import Link             from 'next/link';
import { usePathname }  from 'next/navigation';
import { useState }     from 'react';
import { logoutAction } from '@/lib/services/auth.service';

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
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  return (
    <>
      {/* Top Bar */}
      <header className="mob-topbar">
        <div className="mob-topbar__brand">
          <span className="mob-topbar__logo">🏡</span>
          <div>
            <div className="mob-topbar__name">VillaOS</div>
            <div className="mob-topbar__sub">🏷️ {userName}</div>
          </div>
        </div>
        <button className="mob-topbar__more" onClick={() => setMenu(v => !v)} aria-label="Menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
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
                <span>🏷️</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{userName}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--ink-muted)' }}>Sale / CTV</div>
                </div>
              </div>
              <div className="mob-menu__divider" />
              <form action={logoutAction}>
                <button type="submit" className="mob-menu__item mob-menu__item--danger">
                  <span>👋</span> Đăng xuất
                </button>
              </form>
            </div>
          </>
        )}
      </header>

      {/* Bottom Navigation */}
      <nav className="mob-bottom-nav">
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
          .mob-topbar {
            position:       fixed;
            top: 0; left: 0; right: 0;
            height:         calc(56px + env(safe-area-inset-top));
            padding-top:    env(safe-area-inset-top);
            background:     var(--white);
            border-bottom:  1px solid rgba(180,212,195,.25);
            box-shadow:     0 2px 12px rgba(46,125,82,.06);
            z-index:        300;
            display:        flex;
            align-items:    center;
            justify-content:space-between;
            padding-left:   16px;
            padding-right:  16px;
          }
          .mob-topbar__brand { display:flex; align-items:center; gap:10px; }
          .mob-topbar__logo  { font-size:1.5rem; line-height:1; }
          .mob-topbar__name  { font-family:var(--font-display); font-size:1rem; font-weight:700; color:var(--forest-deep); line-height:1.2; }
          .mob-topbar__sub   { font-size:0.68rem; color:var(--ink-muted); line-height:1.2; }
          .mob-topbar__more  {
            display:flex; align-items:center; justify-content:center;
            width:38px; height:38px; border-radius:50%;
            border:none; background:var(--sage-pale);
            color:var(--forest); cursor:pointer; transition:background .12s;
          }
          .mob-topbar__more:hover { background:rgba(180,212,195,.45); }

          .mob-menu-backdrop { position:fixed; inset:0; z-index:290; }
          .mob-menu {
            position:fixed;
            top:calc(56px + env(safe-area-inset-top) + 6px);
            right:12px;
            min-width:200px;
            background:var(--white);
            border-radius:var(--radius-lg);
            box-shadow:0 8px 32px rgba(0,0,0,.14);
            border:1px solid rgba(180,212,195,.25);
            z-index:310; overflow:hidden;
            animation:mobMenuIn .15s ease;
          }
          @keyframes mobMenuIn {
            from { opacity:0; transform:translateY(-8px) scale(.97); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
          .mob-menu__item {
            display:flex; align-items:center; gap:10px;
            padding:12px 16px; font-size:0.875rem; font-weight:500;
            color:var(--ink); text-decoration:none;
            background:none; border:none; width:100%;
            cursor:pointer; transition:background .1s;
          }
          .mob-menu__item:hover { background:var(--sage-pale); }
          .mob-menu__item--danger { color:var(--red); }
          .mob-menu__item--danger:hover { background:rgba(192,57,43,.06); }
          .mob-menu__user { display:flex; align-items:center; gap:10px; padding:12px 16px; font-size:1.2rem; }
          .mob-menu__divider { height:1px; background:rgba(180,212,195,.25); margin:2px 0; }

          .mob-bottom-nav {
            position:fixed; bottom:0; left:0; right:0;
            height:calc(60px + env(safe-area-inset-bottom));
            padding-bottom:env(safe-area-inset-bottom);
            background:var(--white);
            border-top:1px solid rgba(180,212,195,.25);
            box-shadow:0 -4px 20px rgba(46,125,82,.07);
            z-index:200;
            display:flex; justify-content:space-around; align-items:stretch;
          }
          .mob-tab {
            display:flex; flex-direction:column; align-items:center;
            justify-content:center; flex:1; gap:3px;
            text-decoration:none; color:var(--ink-muted);
            transition:color .15s; padding-top:6px; position:relative;
          }
          .mob-tab--active { color:var(--forest); }
          .mob-tab--active::before {
            content:''; position:absolute; top:0;
            left:20%; right:20%; height:2.5px;
            background:var(--forest); border-radius:0 0 3px 3px;
          }
          .mob-tab__icon { display:flex; align-items:center; justify-content:center; }
          .mob-tab__label { font-size:0.62rem; font-weight:600; letter-spacing:0.02em; }

          .main-content {
            margin-top:     calc(56px + env(safe-area-inset-top)) !important;
            padding-bottom: calc(72px + env(safe-area-inset-bottom)) !important;
            padding-top:    16px !important;
          }
        }
        @media (min-width: 769px) {
          .mob-topbar     { display:none !important; }
          .mob-bottom-nav { display:none !important; }
        }
      `}</style>
    </>
  );
}
