// VillaOS v7 — app/admin/users/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { redirect }         from 'next/navigation';
import { formatDate }       from '@/lib/utils';
import AdminUserActions     from './AdminUserActions';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  if (session.profile.role !== 'admin') redirect('/auth/login');

  const adminSb = (await import('@/lib/supabase/server')).createSupabaseAdminClient();
  const { data: _profiles } = await adminSb
    .from('profiles')
    .select('*')
    .order('joined_at', { ascending: false });
  const profiles: any[] = _profiles ?? [];

  const roleLabel: Record<string,string> = {
    admin: '⚡ Admin', owner: '👑 Owner',
    sale:  '🏷️ Sale',  customer: '👥 Customer',
  };

  return (
    <>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1>👥 Quản lý Users</h1>
          <p>{profiles.length} tài khoản trong hệ thống</p>
        </div>
        <AdminUserActions mode="create" />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email / Brand</th>
                <th>Vai trò</th>
                <th>Ngày tham gia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{p.name}</div>
                  </td>
                  <td style={{ fontSize:'0.82rem', color:'var(--ink-light)' }}>
                    {p.brand && <div>{p.brand}</div>}
                  </td>
                  <td>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:4,
                      padding:'3px 10px', borderRadius:99, fontSize:'0.78rem', fontWeight:600,
                      background: p.role==='admin'?'var(--forest-deep)':p.role==='owner'?'var(--sage-pale)':p.role==='sale'?'var(--amber-light)':'var(--parchment)',
                      color: p.role==='admin'?'white':p.role==='owner'?'var(--forest)':p.role==='sale'?'var(--amber)':'var(--ink-muted)',
                    }}>
                      {roleLabel[p.role] ?? p.role}
                    </span>
                  </td>
                  <td style={{ fontSize:'0.82rem', color:'var(--ink-muted)' }}>
                    {formatDate(p.joined_at?.split('T')[0])}
                  </td>
                  <td>
                    <AdminUserActions mode="delete" profileId={p.id} profileName={p.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
