// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/owner/layout.tsx                          ║
// ╚══════════════════════════════════════════════════════════════╝

import Link from 'next/link';
import { getServerSession } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/services/auth.service';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const { profile } = session;
  const isAdmin = profile.role === 'admin';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>🏡 VillaOS</h2>
          <p>{isAdmin ? '⚡ Super Admin' : `👑 ${profile.brand || 'Chủ Villa'}`}</p>
        </div>

        <nav className="sidebar-nav">
          <Link href="/owner/dashboard" className="nav-item">
            <span className="nav-icon">📊</span> Dashboard
          </Link>
          <Link href="/owner/villas" className="nav-item">
            <span className="nav-icon">🏠</span> Villa của tôi
          </Link>
          <Link href="/owner/calendar" className="nav-item">
            <span className="nav-icon">📅</span> Lịch đặt phòng
          </Link>

          {isAdmin && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '8px 0' }} />
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
          <div style={{ padding: '8px 14px', fontSize: '0.82rem', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
            {profile.name}
          </div>
          <form action={logoutAction}>
            <button type="submit" className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span className="nav-icon">👋</span> Đăng xuất
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
