// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/owner/layout.tsx                          ║
// ║  Mobile: Bottom Nav + Minimal Header                        ║
// ║  Desktop: Sidebar (giữ nguyên)                              ║
// ╚══════════════════════════════════════════════════════════════╝

import Link            from 'next/link';
import { getServerSession } from '@/lib/supabase/server';
import { redirect }    from 'next/navigation';
import { logoutAction } from '@/lib/services/auth.service';
import OwnerBottomNav  from './OwnerBottomNav';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const { profile } = session;
  const isAdmin = profile.role === 'admin';

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>🏡 VillaOS</h2>
          <p>{isAdmin ? '⚡ Super Admin' : `👑 ${profile.brand || 'Chủ Villa'}`}</p>
        </div>

        <nav className="sidebar-nav">
          <Link href="/owner/calendar" className="nav-item">
            <span className="nav-icon">📅</span> Lịch đặt phòng
          </Link>
          <Link href="/owner/villas" className="nav-item">
            <span className="nav-icon">🏠</span> Villa của tôi
          </Link>
          <Link href="/owner/dashboard" className="nav-item">
            <span className="nav-icon">📊</span> Dashboard
          </Link>

          {isAdmin && (
            <>
              <div style={{ height:1, background:'rgba(255,255,255,.08)', margin:'8px 0' }} />
              <Link href="/admin/dashboard" className="nav-item">
                <span className="nav-icon">⚡</span> Admin Panel
              </Link>
              <Link href="/admin/users" className="nav-item">
                <span className="nav-icon">👥</span> Quản lý Users
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding:'8px 14px', fontSize:'0.82rem', color:'rgba(255,255,255,.5)', marginBottom:8 }}>
            {profile.name}
          </div>
          <form action={logoutAction}>
            <button type="submit" className="nav-item" style={{ width:'100%', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
              <span className="nav-icon">👋</span> Đăng xuất
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile Header ────────────────────────────────────────── */}
      <header className="mobile-header">
        <div className="mobile-header__left">
          <span className="mobile-header__logo">🏡</span>
          <div>
            <div className="mobile-header__title">VillaOS</div>
            <div className="mobile-header__sub">{profile.brand || profile.name}</div>
          </div>
        </div>
        <div className="mobile-header__right">
          <Link href="/owner/dashboard" className="mobile-header__notif">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="main-content">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ─────────────────────────────── */}
      <OwnerBottomNav isAdmin={isAdmin} userName={profile.name} />
    </div>
  );
}
