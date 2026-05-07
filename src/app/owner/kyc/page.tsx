// VillaOS — app/owner/kyc/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

type DocType = 'id_front' | 'id_back' | 'selfie';
type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface KycDoc {
  type:       DocType;
  image_url:  string;
  created_at: string;
}

interface KycState {
  status:       KycStatus;
  note:         string | null;
  submittedAt:  string | null;
  docs:         KycDoc[];
}

const DOC_LABELS: Record<DocType, { label: string; desc: string; icon: string }> = {
  id_front: { label: 'Mặt trước CMND/CCCD', desc: 'Ảnh rõ nét, đủ 4 góc, không bị lóa', icon: '🪪' },
  id_back:  { label: 'Mặt sau CMND/CCCD',   desc: 'Ảnh rõ nét, hiện đầy đủ thông tin',  icon: '🪪' },
  selfie:   { label: 'Ảnh chân dung (Selfie)', desc: 'Mặt nhìn thẳng, rõ ràng, đủ ánh sáng', icon: '🤳' },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OwnerKycPage() {
  const [kyc, setKyc]           = useState<KycState | null>(null);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [preview, setPreview]   = useState<Record<DocType, string | null>>({ id_front: null, id_back: null, selfie: null });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileRefs = {
    id_front: useRef<HTMLInputElement>(null),
    id_back:  useRef<HTMLInputElement>(null),
    selfie:   useRef<HTMLInputElement>(null),
  };

  useEffect(() => { loadKyc(); }, []);

  async function loadKyc() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, docsRes] = await Promise.all([
      supabase.from('profiles').select('kyc_status, kyc_note, kyc_submitted_at').eq('id', user.id).single(),
      supabase.from('kyc_documents').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    ]);

    const p = profileRes.data as any;
    const docs = (docsRes.data ?? []) as KycDoc[];

    // Lấy doc mới nhất của mỗi loại
    const latestDocs: KycDoc[] = [];
    const seen = new Set<DocType>();
    for (const d of docs) {
      if (!seen.has(d.type)) { seen.add(d.type); latestDocs.push(d); }
    }

    setKyc({
      status:      p?.kyc_status ?? 'none',
      note:        p?.kyc_note ?? null,
      submittedAt: p?.kyc_submitted_at ?? null,
      docs:        latestDocs,
    });
    setLoading(false);
  }

  async function handleUpload(type: DocType, file: File) {
    setError(null);
    setUploading(type);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Preview
      const reader = new FileReader();
      reader.onload = e => setPreview(p => ({ ...p, [type]: e.target?.result as string }));
      reader.readAsDataURL(file);

      // Upload to storage
      const ext  = file.name.split('.').pop();
      const path = `${user.id}/${type}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('kyc-documents').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(path);

      // Upsert vào kyc_documents
      const { error: dbErr } = await supabase.from('kyc_documents').insert({
        owner_id:  user.id,
        type,
        image_url: publicUrl,
      });
      if (dbErr) throw dbErr;

      await loadKyc();
    } catch (e: any) {
      setError(e.message ?? 'Upload thất bại');
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const types: DocType[] = ['id_front', 'id_back', 'selfie'];
    const missing = types.filter(t => !kyc?.docs.find(d => d.type === t));
    if (missing.length > 0) {
      setError('Vui lòng upload đủ cả 3 loại ảnh trước khi gửi xác minh.');
      return;
    }

    const { error: e } = await supabase.from('profiles').update({
      kyc_status:       'pending',
      kyc_submitted_at: new Date().toISOString(),
      kyc_note:         null,
    }).eq('id', user.id);

    if (e) { setError(e.message); return; }
    setSubmitted(true);
    await loadKyc();
  }

  if (loading) return (
    <div className="kyc-page">
      <div className="kyc-loading">⏳ Đang tải thông tin KYC...</div>
    </div>
  );

  const docTypes: DocType[] = ['id_front', 'id_back', 'selfie'];
  const allUploaded = docTypes.every(t => kyc?.docs.find(d => d.type === t));
  const isLocked = kyc?.status === 'pending' || kyc?.status === 'verified';

  const statusInfo: Record<KycStatus, { label: string; color: string; icon: string; desc: string }> = {
    none:     { label: 'Chưa xác minh',  color: '#6b7280', icon: '📋', desc: 'Upload ảnh CMND và selfie để bắt đầu xác minh danh tính.' },
    pending:  { label: 'Đang xét duyệt', color: '#d97706', icon: '⏳', desc: 'Hồ sơ của bạn đang được admin xem xét. Thường mất 1-2 ngày làm việc.' },
    verified: { label: 'Đã xác minh',    color: '#16a34a', icon: '✅', desc: 'Danh tính của bạn đã được xác minh thành công.' },
    rejected: { label: 'Bị từ chối',     color: '#dc2626', icon: '❌', desc: 'Hồ sơ bị từ chối. Vui lòng upload lại ảnh theo hướng dẫn.' },
  };

  const si = statusInfo[kyc?.status ?? 'none'];

  return (
    <div className="kyc-page">
      {/* Header */}
      <div className="kyc-header">
        <div>
          <h1>🪪 Xác minh danh tính (KYC)</h1>
          <p>Upload ảnh CMND/CCCD và ảnh selfie để xác minh tài khoản</p>
        </div>
      </div>

      {/* Status banner */}
      <div className="kyc-status-banner" style={{ borderColor: si.color, background: si.color + '12' }}>
        <span className="kyc-status-icon">{si.icon}</span>
        <div>
          <div className="kyc-status-label" style={{ color: si.color }}>{si.label}</div>
          <div className="kyc-status-desc">{si.desc}</div>
          {kyc?.status === 'rejected' && kyc.note && (
            <div className="kyc-reject-note">💬 Lý do: {kyc.note}</div>
          )}
          {kyc?.submittedAt && kyc.status === 'pending' && (
            <div className="kyc-submitted-at">
              Gửi lúc: {new Date(kyc.submittedAt).toLocaleString('vi-VN')}
            </div>
          )}
        </div>
      </div>

      {/* Upload cards */}
      <div className="kyc-docs-grid">
        {docTypes.map(type => {
          const meta    = DOC_LABELS[type];
          const existing = kyc?.docs.find(d => d.type === type);
          const previewUrl = preview[type] ?? existing?.image_url;
          const isUp    = uploading === type;

          return (
            <div key={type} className={`kyc-doc-card${existing ? ' kyc-doc-card--done' : ''}`}>
              <div className="kyc-doc-header">
                <span className="kyc-doc-icon">{meta.icon}</span>
                <div>
                  <div className="kyc-doc-label">{meta.label}</div>
                  <div className="kyc-doc-desc">{meta.desc}</div>
                </div>
                {existing && <span className="kyc-doc-check">✅</span>}
              </div>

              {/* Preview */}
              {previewUrl ? (
                <div className="kyc-preview-wrap">
                  <img src={previewUrl} alt={meta.label} className="kyc-preview-img" />
                </div>
              ) : (
                <div className="kyc-preview-empty">
                  <span>{meta.icon}</span>
                  <span>Chưa có ảnh</span>
                </div>
              )}

              {/* Upload button */}
              {!isLocked && (
                <>
                  <input
                    ref={fileRefs[type]}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(type, f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    className="kyc-upload-btn"
                    disabled={isUp}
                    onClick={() => fileRefs[type].current?.click()}
                  >
                    {isUp ? '⏳ Đang upload...' : existing ? '🔄 Upload lại' : '📤 Upload ảnh'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="kyc-error">❌ {error}</div>
      )}

      {/* Submit */}
      {!isLocked && (
        <div className="kyc-submit-wrap">
          <button
            className="kyc-submit-btn"
            disabled={!allUploaded || !!uploading}
            onClick={handleSubmit}
          >
            {allUploaded ? '📨 Gửi hồ sơ xác minh' : `📋 Cần upload đủ 3 ảnh (${kyc?.docs.length ?? 0}/3)`}
          </button>
          {!allUploaded && (
            <p className="kyc-submit-hint">Upload đủ ảnh mặt trước, mặt sau CMND và selfie để gửi xác minh.</p>
          )}
        </div>
      )}

      {submitted && (
        <div className="kyc-success">✅ Hồ sơ đã được gửi thành công! Admin sẽ xét duyệt trong 1-2 ngày làm việc.</div>
      )}

      <style>{`
        .kyc-page { display:flex; flex-direction:column; gap:20px; }

        .kyc-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .kyc-header h1 { font-size:1.4rem; font-weight:700; color:var(--forest-deep); margin:0 0 4px; }
        .kyc-header p  { font-size:0.82rem; color:var(--ink-muted); margin:0; }

        .kyc-loading { text-align:center; padding:48px; font-size:0.9rem; color:var(--ink-muted); }

        /* Status banner */
        .kyc-status-banner {
          display:flex; align-items:flex-start; gap:14px;
          padding:16px 20px; border-radius:14px; border:1.5px solid;
        }
        .kyc-status-icon  { font-size:1.8rem; flex-shrink:0; margin-top:2px; }
        .kyc-status-label { font-size:1rem; font-weight:700; margin-bottom:4px; }
        .kyc-status-desc  { font-size:0.82rem; color:var(--ink-secondary); line-height:1.5; }
        .kyc-reject-note  { margin-top:8px; font-size:0.82rem; color:#dc2626; font-weight:500; }
        .kyc-submitted-at { margin-top:6px; font-size:0.75rem; color:var(--ink-muted); }

        /* Doc grid */
        .kyc-docs-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        @media(max-width:700px){ .kyc-docs-grid{ grid-template-columns:1fr; } }

        .kyc-doc-card {
          background:var(--white); border:1.5px solid var(--sage-pale);
          border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:12px;
          transition:box-shadow .15s;
        }
        .kyc-doc-card--done { border-color:#86efac; }
        .kyc-doc-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.06); }

        .kyc-doc-header { display:flex; align-items:flex-start; gap:10px; }
        .kyc-doc-icon   { font-size:1.5rem; flex-shrink:0; }
        .kyc-doc-label  { font-size:0.85rem; font-weight:700; color:var(--forest-deep); }
        .kyc-doc-desc   { font-size:0.72rem; color:var(--ink-muted); margin-top:2px; line-height:1.4; }
        .kyc-doc-check  { margin-left:auto; font-size:1.2rem; flex-shrink:0; }

        /* Preview */
        .kyc-preview-wrap { border-radius:10px; overflow:hidden; border:1px solid var(--sage-pale); }
        .kyc-preview-img  { width:100%; height:160px; object-fit:cover; display:block; }
        .kyc-preview-empty {
          height:160px; border-radius:10px; border:2px dashed var(--sage-pale);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:8px; font-size:0.78rem; color:var(--ink-muted);
        }
        .kyc-preview-empty span:first-child { font-size:2rem; }

        /* Upload btn */
        .kyc-upload-btn {
          width:100%; padding:9px; border-radius:8px; border:none; cursor:pointer;
          font-size:0.82rem; font-weight:600;
          background:var(--parchment); color:var(--forest);
          border:1px solid var(--sage-pale);
          transition:background .12s;
        }
        .kyc-upload-btn:hover:not(:disabled) { background:var(--sage-pale); }
        .kyc-upload-btn:disabled { opacity:.5; cursor:not-allowed; }

        /* Submit */
        .kyc-submit-wrap { display:flex; flex-direction:column; align-items:center; gap:8px; }
        .kyc-submit-btn {
          padding:12px 32px; border-radius:10px; border:none; cursor:pointer;
          font-size:0.95rem; font-weight:700;
          background:var(--forest); color:#fff;
          transition:background .12s, transform .1s; min-width:280px;
        }
        .kyc-submit-btn:hover:not(:disabled) { background:var(--forest-deep); transform:translateY(-1px); }
        .kyc-submit-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .kyc-submit-hint { font-size:0.75rem; color:var(--ink-muted); margin:0; }

        /* Alerts */
        .kyc-error   { padding:12px 16px; border-radius:10px; background:#fee2e2; color:#991b1b; font-size:0.82rem; font-weight:500; }
        .kyc-success { padding:12px 16px; border-radius:10px; background:#dcfce7; color:#166534; font-size:0.82rem; font-weight:600; }
      `}</style>
    </div>
  );
}
