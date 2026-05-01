'use client';
// VillaOS v7 — app/admin/users/AdminUserActions.tsx
import { useState, useTransition } from 'react';
import { useRouter }   from 'next/navigation';
import { useToast }    from '@/components/Toast';
import { adminCreateUserAction } from '@/lib/services/auth.service';
import type { UserRole } from '@/types/database';

type Props =
  | { mode: 'create' }
  | { mode: 'delete'; profileId: string; profileName: string };

export default function AdminUserActions(props: Props) {
  const [open, setOpen]       = useState(false);
  const [isPending, start]    = useTransition();
  const { show } = useToast();
  const router   = useRouter();

  // Create form state
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<UserRole>('owner');
  const [brand,    setBrand]    = useState('');
  const [error,    setError]    = useState<string | null>(null);

  if (props.mode === 'delete') {
    const handleDelete = () => {
      if (!confirm(`Xóa tài khoản "${props.profileName}"? Không thể hoàn tác.`)) return;
      start(async () => {
        // TODO: Thay bằng Server Action khi tính năng xóa user hoàn thiện
        show('info', 'Tính năng đang phát triển', 'Xóa user sẽ được hoàn thiện.');
      });
    }
    return (
      <button onClick={handleDelete} disabled={isPending}
        className="btn-secondary"
        style={{ fontSize:'0.78rem', padding:'4px 10px', color:'var(--red)', borderColor:'rgba(192,57,43,.3)' }}>
        🗑️
      </button>
    );
  }

  // mode === 'create'
  function handleCreate() {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Vui lòng điền đầy đủ thông tin.'); return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.'); return;
    }
    start(async () => {
      const result = await adminCreateUserAction({ email, password, name, role, brand });
      if (!result.success) { setError(result.error ?? 'Tạo thất bại'); return; }
      show('success', '✅ Đã tạo tài khoản', `${name} (${role})`);
      setOpen(false);
      setName(''); setEmail(''); setPassword(''); setBrand('');
      router.refresh();
    });
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)} style={{ fontSize:'0.875rem' }}>
        + Tạo tài khoản
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚡ Tạo tài khoản mới</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="field-group">
                <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--forest)', textTransform:'uppercase' }}>Vai trò</label>
                <select value={role} onChange={e => setRole(e.target.value as UserRole)}
                  style={{ padding:'9px 12px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)' }}>
                  <option value="owner">👑 Owner</option>
                  <option value="sale">🏷️ Sale</option>
                  <option value="customer">👥 Customer</option>
                  <option value="admin">⚡ Admin</option>
                </select>
              </div>
              {[
                { label:'Họ và tên', value:name, set:setName, placeholder:'Nguyễn Văn A' },
                { label:'Email',     value:email, set:setEmail, placeholder:'email@example.com', type:'email' },
                { label:'Mật khẩu', value:password, set:setPassword, placeholder:'Tối thiểu 6 ký tự', type:'password' },
              ].map(f => (
                <div key={f.label} className="field-group">
                  <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--forest)', textTransform:'uppercase' }}>{f.label}</label>
                  <input type={f.type ?? 'text'} value={f.value}
                    onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    style={{ padding:'9px 12px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)' }} />
                </div>
              ))}
              {role === 'owner' && (
                <div className="field-group">
                  <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--forest)', textTransform:'uppercase' }}>Tên thương hiệu</label>
                  <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="VillaOS Đà Nẵng"
                    style={{ padding:'9px 12px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)' }} />
                </div>
              )}
              {error && <div className="auth-alert error">❌ {error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setOpen(false)}>Hủy</button>
              <button className="btn-primary" onClick={handleCreate} disabled={isPending}>
                {isPending ? 'Đang tạo...' : '+ Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
