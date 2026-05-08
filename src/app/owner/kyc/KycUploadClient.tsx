// VillaOS — app/owner/kyc/KycUploadClient.tsx
'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type DocType   = 'id_front' | 'id_back' | 'selfie';
type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface Props {
  userId:         string;
  kycStatus:      KycStatus;
  kycNote:        string | null;
  kycSubmittedAt: string | null;
  existingDocs:   Record<string, { image_url: string; created_at: string }>;
}

const DOC_META: Record<DocType, { label: string; desc: string; icon: string }> = {
  id_front: { label: 'Mặt trước CMND/CCCD', desc: 'Ảnh rõ nét, đủ 4 góc, không bị lóa',      icon: '🪪' },
  id_back:  { label: 'Mặt sau CMND/CCCD',   desc: 'Ảnh rõ nét, hiện đầy đủ thông tin',        icon: '🪪' },
  selfie:   { label: 'Ảnh chân dung (Selfie)', desc: 'Mặt nhìn thẳng, rõ ràng, đủ ánh sáng', icon: '🤳' },
};

const STATUS_INFO: Record<KycStatus, { label: string; color: string; icon: string; desc: string }> = {
  none:     { label: 'Chưa xác minh',  color: '#6b7280', icon: '📋', desc: 'Upload ảnh CMND và selfie để bắt đầu xác minh danh tính.' },
  pending:  { label: 'Đang xét duyệt', color: '#d97706', icon: '⏳', desc: 'Hồ sơ đang được admin xem xét. Thường mất 1-2 ngày làm việc.' },
  verified: { label: 'Đã xác minh',    color: '#16a34a', icon: '✅', desc: 'Danh tính của bạn đã được xác minh thành công.' },
  rejected: { label: 'Bị từ chối',     color: '#dc2626', icon: '❌', desc: 'Hồ sơ bị từ chối. Vui lòng upload lại ảnh theo hướng dẫn.' },
};

const DOC_TYPES: DocType[] = ['id_front', 'id_back', 'selfie'];

export default function KycUploadClient({ userId, kycStatus, kycNote, kycSubmittedAt, existingDocs }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading]    = useState<DocType | null>(null);
  const [previews,  setPreviews]     = useState<Record<string, string>>({});
  const [uploaded,  setUploaded]     = useState<Record<string, string>>( // type → image_url
    Object.fromEntries(Object.entries(existingDocs).map(([t, d]) => [t, d.image_url]))
  );
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRefs = {
    id_front: useRef<HTMLInputElement>(null),
    id_back:  useRef<HTMLInputElement>(null),
    selfie:   useRef<HTMLInputElement>(null),
  } as Record<DocType, React.RefObject<HTMLInputElement>>;

  const isLocked   = kycStatus === 'pending' || kycStatus === 'verified';
  const allUploaded = DOC_TYPES.every(t => uploaded[t]);
  const si         = STATUS_INFO[kycStatus];

  async function handleUpload(type: DocType, file: File) {
    setError(null);
    setUploading(type);
    try {
      // Preview ngay lập tức
      const reader = new FileReader();
      reader.onload = e => setPreviews(p => ({ ...p, [type]: e.target?.result as string }));
      reader.readAsDataURL(file);

      // Gọi API upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('userId', userId);

      const res = await fetch('/api/owner/kyc/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Upload thất bại');
      }
      const { imageUrl } = await res.json();
      setUploaded(u => ({ ...u, [type]: imageUrl }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    const missing = DOC_TYPES.filter(t => !uploaded[t]);
    if (missing.length > 0) { setError('Vui lòng upload đủ cả 3 ảnh.'); return; }

    startTransition(async () => {
      const res = await fetch('/api/owner/kyc/submit', { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Có lỗi xảy ra');
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <div className="kyc-page">
      {/* Header */}
      <div className="kyc-header">
        <h1>🪪 Xác minh danh tính (KYC)</h1>
        <p>Upload ảnh CMND/CCCD và ảnh selfie để xác minh tài khoản</p>
      </div>

      {/* Status banner */}
      <div className="kyc-banner" style={{ borderColor: si.color, background: si.color + '15' }}>
        <span className="kyc-banner-icon">{si.icon}</span>
        <div>
          <div className="kyc-banner-label" style={{ color: si.color }}>{si.label}</div>
          <div className="kyc-banner-desc">{si.desc}</div>
          {kycStatus === 'rejected' && kycNote && (
            <div className="kyc-banner-note">💬 Lý do: {kycNote}</div>
          )}
          {kycSubmittedAt && kycStatus === 'pending' && (
            <div className="kyc-banner-time">Gửi lúc: {new Date(kycSubmittedAt).toLocaleString('vi-VN')}</div>
          )}
        </div>
      </div>

      {/* Doc cards */}
      <div className="kyc-grid">
        {DOC_TYPES.map(type => {
          const meta      = DOC_META[type];
          const previewUrl = previews[type] ?? uploaded[type];
          const isDone    = !!uploaded[type];
          const isUp      = uploading === type;

          return (
            <div key={type} className={`kyc-card${isDone ? ' kyc-card--done' : ''}`}>
              <div className="kyc-card-top">
                <span>{meta.icon}</span>
                <div>
                  <div className="kyc-card-label">{meta.label}</div>
                  <div className="kyc-card-desc">{meta.desc}</div>
                </div>
                {isDone && <span className="kyc-check">✅</span>}
              </div>

              {previewUrl ? (
                <img src={previewUrl} alt={meta.label} className="kyc-img" />
              ) : (
                <div className="kyc-empty">
                  <span style={{ fontSize:'2rem' }}>{meta.icon}</span>
                  <span>Chưa có ảnh</span>
                </div>
              )}

              {!isLocked && (
                <>
                  <input
                    ref={fileRefs[type]}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display:'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(type, f); e.target.value = ''; }}
                  />
                  <button
                    className="kyc-upload-btn"
                    disabled={isUp || !!uploading}
                    onClick={() => fileRefs[type].current?.click()}
                  >
                    {isUp ? '⏳ Đang upload...' : isDone ? '🔄 Upload lại' : '📤 Chọn ảnh'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {error   && <div className="kyc-error">❌ {error}</div>}
      {success && <div className="kyc-success">✅ Hồ sơ đã gửi! Admin sẽ duyệt trong 1-2 ngày làm việc.</div>}

      {!isLocked && (
        <div className="kyc-footer">
          <button
            className="kyc-submit"
            disabled={!allUploaded || isPending || !!uploading}
            onClick={handleSubmit}
          >
            {isPending ? '⏳ Đang gửi...' : allUploaded ? '📨 Gửi hồ sơ xác minh' : `Cần upload đủ 3 ảnh (${Object.keys(uploaded).length}/3)`}
          </button>
          {!allUploaded && <p className="kyc-hint">Upload đủ ảnh mặt trước, mặt sau CMND và selfie để gửi xác minh.</p>}
        </div>
      )}

      <style>{`
        .kyc-page   { display:flex; flex-direction:column; gap:20px; }
        .kyc-header h1 { font-size:1.4rem; font-weight:700; color:var(--forest-deep); margin:0 0 4px; }
        .kyc-header p  { font-size:0.82rem; color:var(--ink-muted); margin:0; }

        .kyc-banner { display:flex; gap:14px; padding:16px 20px; border-radius:14px; border:1.5px solid; align-items:flex-start; }
        .kyc-banner-icon  { font-size:1.8rem; flex-shrink:0; }
        .kyc-banner-label { font-size:1rem; font-weight:700; margin-bottom:4px; }
        .kyc-banner-desc  { font-size:0.82rem; color:var(--ink-secondary); line-height:1.5; }
        .kyc-banner-note  { margin-top:6px; font-size:0.82rem; color:#dc2626; font-weight:500; }
        .kyc-banner-time  { margin-top:4px; font-size:0.72rem; color:var(--ink-muted); }

        .kyc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        @media(max-width:700px){ .kyc-grid{ grid-template-columns:1fr; } }

        .kyc-card { background:var(--white); border:1.5px solid var(--sage-pale); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:12px; }
        .kyc-card--done { border-color:#86efac; }
        .kyc-card-top { display:flex; align-items:flex-start; gap:10px; }
        .kyc-card-label { font-size:0.85rem; font-weight:700; color:var(--forest-deep); }
        .kyc-card-desc  { font-size:0.72rem; color:var(--ink-muted); margin-top:2px; line-height:1.4; }
        .kyc-check { margin-left:auto; font-size:1.2rem; }

        .kyc-img   { width:100%; height:160px; object-fit:cover; border-radius:10px; border:1px solid var(--sage-pale); }
        .kyc-empty { height:160px; border-radius:10px; border:2px dashed var(--sage-pale); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; font-size:0.78rem; color:var(--ink-muted); }

        .kyc-upload-btn { width:100%; padding:9px; border-radius:8px; background:var(--parchment); color:var(--forest); border:1px solid var(--sage-pale); font-size:0.82rem; font-weight:600; cursor:pointer; transition:background .12s; }
        .kyc-upload-btn:hover:not(:disabled) { background:var(--sage-pale); }
        .kyc-upload-btn:disabled { opacity:.5; cursor:not-allowed; }

        .kyc-footer { display:flex; flex-direction:column; align-items:center; gap:8px; }
        .kyc-submit { padding:12px 32px; border-radius:10px; background:var(--forest); color:#fff; border:none; cursor:pointer; font-size:0.95rem; font-weight:700; min-width:280px; transition:background .12s, transform .1s; }
        .kyc-submit:hover:not(:disabled) { background:var(--forest-deep); transform:translateY(-1px); }
        .kyc-submit:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .kyc-hint   { font-size:0.75rem; color:var(--ink-muted); margin:0; }
        .kyc-error  { padding:12px 16px; border-radius:10px; background:#fee2e2; color:#991b1b; font-size:0.82rem; font-weight:500; }
        .kyc-success{ padding:12px 16px; border-radius:10px; background:#dcfce7; color:#166534; font-size:0.82rem; font-weight:600; }
      `}</style>
    </div>
  );
}
