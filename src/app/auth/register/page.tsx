'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/auth/register/page.tsx                    ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerAction } from '@/lib/services/auth.service';
import type { UserRole } from '@/types/database';

type RegisterRole = Extract<UserRole, 'owner' | 'sale' | 'customer'>;

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [role,      setRole]      = useState<RegisterRole | ''>('');
  const [brand,     setBrand]     = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) { setError('Mật khẩu cần ít nhất 6 ký tự.'); return; }
    if (password !== password2) { setError('Mật khẩu xác nhận không khớp.'); return; }
    if (!role) { setError('Vui lòng chọn vai trò.'); return; }

    startTransition(async () => {
      const result = await registerAction({
        email, password, name: name.trim(),
        role: role as RegisterRole,
        brand: brand.trim() || undefined,
      });

      if (!result.success) { setError(result.error ?? 'Đăng ký thất bại.'); return; }
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2000);
    });
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>✅</span>
          <h2>Đăng ký thành công!</h2>
          <p style={{ marginTop: 8 }}>Kiểm tra email để xác nhận tài khoản.</p>
          <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--ink-muted)' }}>Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">🏡</span>
          <h1>VillaOS</h1>
          <p>Tạo tài khoản mới</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-group">
            <label>Vai trò</label>
            <select value={role} onChange={e => setRole(e.target.value as RegisterRole)} required disabled={isPending}>
              <option value="">-- Vui lòng chọn --</option>
              <option value="owner">👑 Chủ Villa — Quản lý villa, xem doanh thu</option>
              <option value="sale">🏷️ Sale / CTV — Xem lịch, tạo hold</option>
              <option value="customer">👥 Khách — Đặt phòng, xem villa</option>
            </select>
          </div>

          <div className="field-group">
            <label>Họ và tên</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nguyễn Văn A" required disabled={isPending} />
          </div>

          {role === 'owner' && (
            <div className="field-group">
              <label>Tên thương hiệu</label>
              <input type="text" value={brand} onChange={e => setBrand(e.target.value)}
                placeholder="VillaOS Đà Nẵng" disabled={isPending} />
            </div>
          )}

          <div className="field-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" required autoComplete="email" disabled={isPending} />
          </div>

          <div className="field-group">
            <label>Mật khẩu</label>
            <div className="input-with-action">
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự" required autoComplete="new-password" disabled={isPending} />
              <button type="button" className="input-action-btn" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div className="field-group">
            <label>Xác nhận mật khẩu</label>
            <input type={showPass ? 'text' : 'password'} value={password2}
              onChange={e => setPassword2(e.target.value)}
              placeholder="Nhập lại mật khẩu" required disabled={isPending} />
          </div>

          {error && <div className="auth-alert error">❌ {error}</div>}

          <button type="submit" className="btn-primary full-width" disabled={isPending}>
            {isPending ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </button>

          <div className="auth-links">
            <span>Đã có tài khoản?</span>
            <Link href="/auth/login">Đăng nhập</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
