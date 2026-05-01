import Link from 'next/link';
import { getServerSession } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/services/auth.service';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;
  if (profile.role !== 'admin') redirect('/auth/login');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>🏡 VillaOS</h2>
          <p>⚡ Super Admin</p>
        </div>
        <nav className="sidebar-nav">
          <Link href="/admin/dashboard" className="nav-item"><span className="nav-icon">📊</span> Dashboard</Link>
          <Link href="/admin/users"     className="nav-item"><span className="nav-icon">👥</span> Quản lý Users</Link>
          <Link href="/owner/dashboard" className="nav-item"><span className="nav-icon">👑</span> Chế độ Owner</Link>
        </nav>
        <div className="sidebar-footer">
          <div style={{ padding: '8px 14px', fontSize: '0.82rem', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>{profile.name}</div>
          <form action={logoutAction}>
            <button type="submit" className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span className="nav-icon">👋</span> Đăng xuất
            </button>
          </form>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
