// VillaOS — app/admin/kyc/page.tsx
import { getServerSession }        from '@/lib/supabase/server';
import { redirect }                from 'next/navigation';
import AdminKycActions             from './AdminKycActions';

export const dynamic = 'force-dynamic';

export default async function AdminKycPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  if (session.profile.role !== 'admin') redirect('/auth/login');

  const adminSb = (await import('@/lib/supabase/server')).createSupabaseAdminClient();

  // Lấy tất cả owner có kyc_status != null
  const { data: _profiles } = await adminSb
    .from('profiles')
    .select('id, name, kyc_status, kyc_note, kyc_submitted_at, kyc_reviewed_at')
    .eq('role', 'owner')
    .not('kyc_status', 'eq', 'none')
    .order('kyc_submitted_at', { ascending: false });

  const profiles: any[] = _profiles ?? [];

  // Lấy tất cả kyc_documents cho các owner này
  const ownerIds = profiles.map((p: any) => p.id);
  const { data: _docs } = ownerIds.length > 0
    ? await adminSb.from('kyc_documents').select('*').in('owner_id', ownerIds).order('created_at', { ascending: false })
    : { data: [] };
  const docs: any[] = _docs ?? [];

  // Đếm thống kê
  const stats = {
    pending:  profiles.filter(p => p.kyc_status === 'pending').length,
    verified: profiles.filter(p => p.kyc_status === 'verified').length,
    rejected: profiles.filter(p => p.kyc_status === 'rejected').length,
  };

  const statusLabel: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending:  { label: 'Chờ duyệt',    color: '#92400e', bg: '#fef3c7', icon: '⏳' },
    verified: { label: 'Đã xác minh',  color: '#166534', bg: '#dcfce7', icon: '✅' },
    rejected: { label: 'Bị từ chối',   color: '#991b1b', bg: '#fee2e2', icon: '❌' },
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🪪 Duyệt KYC</h1>
          <p>{stats.pending} chờ duyệt · {stats.verified} đã xác minh · {stats.rejected} từ chối</p>
        </div>
      </div>

      {/* Stats */}
      <div className="kyc-admin-stats">
        {[
          { label: 'Chờ duyệt',   value: stats.pending,  color: '#d97706', bg: '#fef3c7' },
          { label: 'Đã xác minh', value: stats.verified, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Từ chối',     value: stats.rejected, color: '#dc2626', bg: '#fee2e2' },
        ].map(s => (
          <div key={s.label} className="kyc-stat-card" style={{ borderColor: s.color, background: s.bg }}>
            <div className="kyc-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="kyc-stat-label" style={{ color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      {profiles.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 24px' }}>
          <span style={{ fontSize:48, display:'block', marginBottom:12 }}>📋</span>
          <h3>Chưa có hồ sơ KYC nào</h3>
          <p style={{ color:'var(--ink-muted)', marginTop:8 }}>Các owner sẽ xuất hiện ở đây sau khi gửi hồ sơ xác minh.</p>
        </div>
      ) : (
        <div className="kyc-list">
          {profiles.map((p: any) => {
            const ownerDocs = docs.filter((d: any) => d.owner_id === p.id);
            const latestDocs: Record<string, any> = {};
            for (const d of ownerDocs) {
              if (!latestDocs[d.type]) latestDocs[d.type] = d;
            }
            const si = statusLabel[p.kyc_status] ?? statusLabel['pending'];

            return (
              <div key={p.id} className="kyc-card">
                {/* Header */}
                <div className="kyc-card-header">
                  <div className="kyc-card-avatar">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="kyc-card-info">
                    <div className="kyc-card-name">{p.name}</div>
                    <div className="kyc-card-meta">
                      {p.kyc_submitted_at && (
                        <span>📅 Gửi: {new Date(p.kyc_submitted_at).toLocaleString('vi-VN')}</span>
                      )}
                      {p.kyc_reviewed_at && (
                        <span>🔍 Duyệt: {new Date(p.kyc_reviewed_at).toLocaleString('vi-VN')}</span>
                      )}
                    </div>
                  </div>
                  <span className="kyc-status-tag" style={{ background: si.bg, color: si.color }}>
                    {si.icon} {si.label}
                  </span>
                </div>

                {/* Ảnh */}
                <div className="kyc-imgs-grid">
                  {[
                    { type: 'id_front', label: 'Mặt trước CMND' },
                    { type: 'id_back',  label: 'Mặt sau CMND' },
                    { type: 'selfie',   label: 'Ảnh Selfie' },
                  ].map(({ type, label }) => {
                    const doc = latestDocs[type];
                    return (
                      <div key={type} className="kyc-img-slot">
                        <div className="kyc-img-label">{label}</div>
                        {doc ? (
                          <a href={doc.image_url} target="_blank" rel="noopener noreferrer">
                            <img src={doc.image_url} alt={label} className="kyc-img" />
                            <div className="kyc-img-hint">🔍 Bấm để xem full</div>
                          </a>
                        ) : (
                          <div className="kyc-img-missing">❌ Chưa có ảnh</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Note nếu bị từ chối */}
                {p.kyc_status === 'rejected' && p.kyc_note && (
                  <div className="kyc-reject-note">
                    💬 Lý do từ chối: <strong>{p.kyc_note}</strong>
                  </div>
                )}

                {/* Actions */}
                {p.kyc_status === 'pending' && (
                  <AdminKycActions ownerId={p.id} ownerName={p.name} />
                )}
                {p.kyc_status === 'verified' && (
                  <div className="kyc-action-done">✅ Đã xác minh — <AdminKycActions ownerId={p.id} ownerName={p.name} mode="revert" /></div>
                )}
                {p.kyc_status === 'rejected' && (
                  <div className="kyc-action-done">❌ Đã từ chối — <AdminKycActions ownerId={p.id} ownerName={p.name} mode="revert" /></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .kyc-admin-stats {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 4px;
        }
        @media(max-width:600px){ .kyc-admin-stats{ grid-template-columns:1fr; } }
        .kyc-stat-card {
          border:1.5px solid; border-radius:12px; padding:16px 20px;
          display:flex; flex-direction:column; gap:4px; align-items:center;
        }
        .kyc-stat-value { font-size:2rem; font-weight:800; line-height:1; }
        .kyc-stat-label { font-size:0.78rem; font-weight:600; }

        .kyc-list { display:flex; flex-direction:column; gap:16px; }

        .kyc-card {
          background:var(--white); border:1px solid var(--sage-pale);
          border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:16px;
        }
        .kyc-card-header { display:flex; align-items:center; gap:14px; }
        .kyc-card-avatar {
          width:44px; height:44px; border-radius:50%; background:var(--forest);
          color:#fff; font-size:1.2rem; font-weight:700;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .kyc-card-info  { flex:1; min-width:0; }
        .kyc-card-name  { font-weight:700; font-size:1rem; color:var(--forest-deep); }
        .kyc-card-meta  { display:flex; gap:12px; flex-wrap:wrap; font-size:0.75rem; color:var(--ink-muted); margin-top:3px; }
        .kyc-status-tag { padding:4px 12px; border-radius:99px; font-size:0.78rem; font-weight:700; flex-shrink:0; }

        .kyc-imgs-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        @media(max-width:600px){ .kyc-imgs-grid{ grid-template-columns:1fr; } }
        .kyc-img-slot   { display:flex; flex-direction:column; gap:6px; }
        .kyc-img-label  { font-size:0.75rem; font-weight:600; color:var(--ink-muted); }
        .kyc-img        { width:100%; height:180px; object-fit:cover; border-radius:10px; border:1px solid var(--sage-pale); display:block; transition:opacity .15s; }
        .kyc-img:hover  { opacity:.85; }
        .kyc-img-hint   { font-size:0.68rem; color:var(--ink-muted); text-align:center; margin-top:3px; }
        .kyc-img-missing {
          height:180px; border-radius:10px; border:2px dashed var(--sage-pale);
          display:flex; align-items:center; justify-content:center;
          font-size:0.78rem; color:var(--ink-muted);
        }

        .kyc-reject-note {
          padding:10px 14px; border-radius:8px; background:#fee2e2; color:#991b1b; font-size:0.82rem;
        }
        .kyc-action-done {
          display:flex; align-items:center; gap:8px; font-size:0.82rem; color:var(--ink-muted);
        }
      `}</style>
    </>
  );
}
