// VillaOS — app/admin/kyc/AdminKycActions.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter }               from 'next/navigation';

interface Props {
  ownerId:   string;
  ownerName: string;
  mode?:     'approve' | 'revert';
}

export default function AdminKycActions({ ownerId, ownerName, mode = 'approve' }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError]           = useState<string | null>(null);
  const router = useRouter();

  async function updateKyc(status: 'verified' | 'rejected' | 'pending', note?: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, status, note: note ?? null }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Có lỗi xảy ra');
        return;
      }
      setShowReject(false);
      setRejectNote('');
      router.refresh();
    });
  }

  if (mode === 'revert') {
    return (
      <button
        className="kyc-btn kyc-btn--ghost"
        disabled={isPending}
        onClick={() => updateKyc('pending')}
      >
        🔄 Đặt lại thành Chờ duyệt
      </button>
    );
  }

  return (
    <div className="kyc-actions">
      {error && <div className="kyc-err">❌ {error}</div>}

      {!showReject ? (
        <div className="kyc-btns">
          <button
            className="kyc-btn kyc-btn--approve"
            disabled={isPending}
            onClick={() => updateKyc('verified')}
          >
            ✅ Duyệt — Xác minh {ownerName}
          </button>
          <button
            className="kyc-btn kyc-btn--reject"
            disabled={isPending}
            onClick={() => setShowReject(true)}
          >
            ❌ Từ chối
          </button>
        </div>
      ) : (
        <div className="kyc-reject-form">
          <label className="kyc-reject-label">Lý do từ chối (bắt buộc):</label>
          <textarea
            className="kyc-reject-textarea"
            rows={3}
            placeholder="VD: Ảnh bị mờ, không rõ thông tin. Vui lòng chụp lại..."
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
          />
          <div className="kyc-btns">
            <button
              className="kyc-btn kyc-btn--reject"
              disabled={isPending || !rejectNote.trim()}
              onClick={() => updateKyc('rejected', rejectNote.trim())}
            >
              {isPending ? '⏳ Đang xử lý...' : '❌ Xác nhận từ chối'}
            </button>
            <button
              className="kyc-btn kyc-btn--ghost"
              disabled={isPending}
              onClick={() => { setShowReject(false); setRejectNote(''); }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      <style>{`
        .kyc-actions      { display:flex; flex-direction:column; gap:10px; }
        .kyc-btns         { display:flex; gap:10px; flex-wrap:wrap; }
        .kyc-btn          { padding:9px 20px; border-radius:8px; border:none; cursor:pointer; font-size:0.84rem; font-weight:600; transition:opacity .12s, transform .1s; }
        .kyc-btn:hover:not(:disabled) { opacity:.85; transform:translateY(-1px); }
        .kyc-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .kyc-btn--approve { background:#16a34a; color:#fff; }
        .kyc-btn--reject  { background:#dc2626; color:#fff; }
        .kyc-btn--ghost   { background:var(--parchment); color:var(--forest); border:1px solid var(--sage-pale); }
        .kyc-reject-form  { display:flex; flex-direction:column; gap:8px; }
        .kyc-reject-label { font-size:0.8rem; font-weight:600; color:var(--ink-muted); }
        .kyc-reject-textarea {
          width:100%; padding:10px 12px; border-radius:8px;
          border:1px solid var(--sage-pale); font-size:0.84rem;
          resize:vertical; font-family:inherit; outline:none;
        }
        .kyc-reject-textarea:focus { border-color:var(--forest); }
        .kyc-err { padding:8px 12px; border-radius:8px; background:#fee2e2; color:#991b1b; font-size:0.78rem; }
      `}</style>
    </div>
  );
}
