import Link from 'next/link';
import { getServerSession } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/services/auth.service';

export default async function SaleLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>🏡 VillaOS</h2>
          <p>🏷️ Sale / CTV</p>
        </div>
        <nav className="sidebar-nav">
          <Link href="/sale/calendar" className="nav-item"><span className="nav-icon">📅</span> Lịch villa</Link>
          <Link href="/sale/bookings" className="nav-item"><span className="nav-icon">📋</span> Booking của tôi</Link>
          <Link href="/sale/customers" className="nav-item"><span className="nav-icon">👥</span> Khách hàng</Link>
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
