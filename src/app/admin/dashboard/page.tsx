// VillaOS v7 — app/admin/dashboard/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { redirect }         from 'next/navigation';
import { fmtMoney, formatDate } from '@/lib/utils';
import Link                 from 'next/link';
import AuditLogViewer       from '@/components/AuditLogViewer';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  if (session.profile.role !== 'admin') redirect('/auth/login');

  const adminSb = (await import('@/lib/supabase/server')).createSupabaseAdminClient();

  // Parallel queries
  const [
    { count: totalUsers  },
    { count: totalVillas },
    { count: totalBk     },
    { data:  recentBk    },
    { data:  byRole      },
  ] = await Promise.all([
    adminSb.from('profiles').select('*', { count:'exact', head:true }),
    adminSb.from('villas').select('*', { count:'exact', head:true }).eq('status','active'),
    adminSb.from('bookings').select('*', { count:'exact', head:true }).neq('status','cancelled'),
    adminSb.from('bookings').select('*, villas(name,emoji), profiles(name)').neq('status','cancelled').order('created_at',{ascending:false}).limit(8),
    adminSb.from('profiles').select('role'),
  ]);

  const roleCounts = (byRole ?? []).reduce((acc: Record<string,number>, r: any) => {
    acc[r.role] = (acc[r.role] ?? 0) + 1; return acc;
  }, {} as Record<string,number>);

  return (
    <>
      <div className="page-header">
        <h1>⚡ Admin Dashboard</h1>
        <p>Tổng quan hệ thống VillaOS</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
        {[
          { icon:'👥', value: totalUsers  ?? 0, label:'Tổng users'      },
          { icon:'🏠', value: totalVillas ?? 0, label:'Villa hoạt động' },
          { icon:'📅', value: totalBk     ?? 0, label:'Booking đang có' },
          { icon:'👑', value: roleCounts['owner'] ?? 0, label:'Chủ villa' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Role breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div className="card">
          <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3>👥 Phân bổ vai trò</h3>
            <Link href="/admin/users" style={{ fontSize:'0.82rem', color:'var(--forest)' }}>Quản lý →</Link>
          </div>
          <div className="card-body">
            {[
              { role:'admin',    label:'⚡ Admin',    color:'var(--forest)' },
              { role:'owner',    label:'👑 Owner',    color:'var(--sage)' },
              { role:'sale',     label:'🏷️ Sale',     color:'var(--amber)' },
              { role:'customer', label:'👥 Customer', color:'var(--ink-muted)' },
            ].map(r => (
              <div key={r.role} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--sage-pale)' }}>
                <span style={{ fontSize:'0.875rem', color: r.color, fontWeight:600 }}>{r.label}</span>
                <span style={{ fontSize:'1rem', fontWeight:700, color:'var(--ink)' }}>{roleCounts[r.role] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent bookings */}
        <div className="card">
          <div className="card-header"><h3>📋 Booking gần nhất</h3></div>
          <div style={{ padding:0 }}>
            {(recentBk ?? []).slice(0,6).map((b: any) => (
              <div key={b.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 16px', borderBottom:'1px solid var(--sage-pale)' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.82rem' }}>{b.customer}</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--ink-muted)' }}>
                    {b.villas?.emoji} {b.villas?.name} · {formatDate(b.checkin)}
                  </div>
                </div>
                <span className={`badge badge-${b.status}`} style={{ alignSelf:'center', fontSize:'0.7rem' }}>
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="card">
        <div className="card-header"><h3>📋 Hoạt động gần đây</h3></div>
        <div className="card-body">
          <AuditLogViewer maxItems={20} />
        </div>
      </div>
    </>
  );
}
