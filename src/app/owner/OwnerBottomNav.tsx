'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/owner/OwnerBottomNav.tsx                  ║
// ║  Mobile bottom navigation cho chủ nhà                       ║
// ╚══════════════════════════════════════════════════════════════╝

import Link                  from 'next/link';
import { usePathname }       from 'next/navigation';
import { useTransition }     from 'react';
import { logoutAction }      from '@/lib/services/auth.service';

interface Props {
  isAdmin:  boolean;
  userName: string;
}

const NAV_ITEMS = [
  {
    href:  '/owner/calendar',
    label: 'Lịch phòng',
    icon:  (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href:  '/owner/villas',
    label: 'Villa',
    icon:  (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href:  '/owner/dashboard',
    label: 'Dashboard',
    icon:  (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3"  y="3"  width="7" height="7"/>
        <rect x="14" y="3"  width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3"  y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href:  '/owner/more',
    label: 'Thêm',
    icon:  (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
      </svg>
    ),
  },
];

export default function OwnerBottomNav({ isAdmin, userName }: Props) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`bottom-nav__item${active ? ' bottom-nav__item--active' : ''}`}>
              <span className="bottom-nav__icon">{item.icon(active)}</span>
              <span className="bottom-nav__label">{item.label}</span>
              {active && <span className="bottom-nav__dot" />}
            </Link>
          );
        })}
      </nav>

      <style>{`
        /* ── Bottom Nav — chỉ hiện trên mobile ── */
        .bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .bottom-nav {
            display:          flex;
            position:         fixed;
            bottom:           0;
            left:             0;
            right:            0;
            height:           calc(60px + env(safe-area-inset-bottom));
            padding-bottom:   env(safe-area-inset-bottom);
            background:       var(--white);
            border-top:       1px solid rgba(180,212,195,.3);
            box-shadow:       0 -4px 24px rgba(46,125,82,.08);
            z-index:          200;
            justify-content:  space-around;
            align-items:      center;
          }

          .bottom-nav__item {
            display:        flex;
            flex-direction: column;
            align-items:    center;
            justify-content:center;
            gap:            3px;
            flex:           1;
            height:         100%;
            text-decoration:none;
            color:          var(--ink-muted);
            position:       relative;
            transition:     color .15s;
            padding-bottom: 4px;
          }

          .bottom-nav__item--active {
            color: var(--forest);
          }

          .bottom-nav__icon {
            display:     flex;
            align-items: center;
            justify-content: center;
            width:       40px;
            height:      32px;
          }

          .bottom-nav__label {
            font-size:   0.62rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            line-height: 1;
          }

          .bottom-nav__dot {
            position:     absolute;
            top:          8px;
            width:        4px;
            height:       4px;
            border-radius:50%;
            background:   var(--forest);
          }

          /* Mobile header */
          .mobile-header {
            display:         flex;
            align-items:     center;
            justify-content: space-between;
            padding:         12px 16px;
            padding-top:     calc(12px + env(safe-area-inset-top));
            background:      var(--white);
            border-bottom:   1px solid rgba(180,212,195,.2);
            position:        sticky;
            top:             0;
            z-index:         150;
            box-shadow:      0 2px 12px rgba(46,125,82,.06);
          }

          .mobile-header__left {
            display:     flex;
            align-items: center;
            gap:         10px;
          }

          .mobile-header__logo {
            font-size:   1.5rem;
            line-height: 1;
          }

          .mobile-header__title {
            font-family: var(--font-display);
            font-size:   1rem;
            font-weight: 700;
            color:       var(--forest-deep);
            line-height: 1.2;
          }

          .mobile-header__sub {
            font-size:  0.7rem;
            color:      var(--ink-muted);
            line-height:1.2;
          }

          .mobile-header__right {
            display:     flex;
            align-items: center;
            gap:         8px;
          }

          .mobile-header__notif {
            display:         flex;
            align-items:     center;
            justify-content: center;
            width:           38px;
            height:          38px;
            border-radius:   50%;
            background:      var(--sage-pale);
            color:           var(--forest);
            text-decoration: none;
            transition:      background .15s;
          }
          .mobile-header__notif:hover { background: rgba(180,212,195,.4); }

          /* Main content padding cho bottom nav */
          .main-content {
            padding-bottom: calc(72px + env(safe-area-inset-bottom)) !important;
            padding-top:    8px;
          }
        }

        /* Desktop: ẩn mobile header */
        @media (min-width: 769px) {
          .mobile-header { display: none; }
          .bottom-nav    { display: none; }
        }
      `}</style>
    </>
  );
}
