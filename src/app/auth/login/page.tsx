'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/auth/login/page.tsx                       ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginAction } from '@/lib/services/auth.service';

// ── Inner component — dùng useSearchParams (phải wrap trong Suspense) ──
function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const redirectParam = searchParams.get('redirect');
  const errorParam    = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginAction({ email, password });

      if (!result.success) {
        setError(result.error ?? 'Đăng nhập thất bại.');
        return;
      }

      // Redirect về đúng dashboard theo role
      const role = result.code;
      const destination = redirectParam ??
        (role === 'admin'    ? '/admin/dashboard'  :
         role === 'owner'    ? '/owner/dashboard'  :
         role === 'sale'     ? '/sale/calendar'    :
                               '/customer/villas');

      router.push(destination);
      router.refresh(); // cập nhật Server Component
    });
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <span className="auth-logo">🏡</span>
          <h1>VillaOS</h1>
          <p>Quản lý villa chuyên nghiệp</p>
        </div>

        {/* URL error (unauthorized redirect) */}
        {errorParam === 'unauthorized' && (
          <div className="auth-alert warning">
            ⚠️ Bạn không có quyền truy cập trang đó.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Email */}
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@villa.com"
              required
              autoComplete="email"
              disabled={isPending}
            />
          </div>

          {/* Password */}
          <div className="field-group">
            <label htmlFor="password">Mật khẩu</label>
            <div className="input-with-action">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isPending}
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="auth-alert error">❌ {error}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary full-width"
            disabled={isPending}
          >
            {isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          {/* Links */}
          <div className="auth-links">
            <Link href="/auth/forgot-password">Quên mật khẩu?</Link>
            <span>·</span>
            <Link href="/auth/register">Tạo tài khoản mới</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page export — bắt buộc wrap Suspense khi dùng useSearchParams ──
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="auth-logo">🏡</span>
          <p>Đang tải...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
