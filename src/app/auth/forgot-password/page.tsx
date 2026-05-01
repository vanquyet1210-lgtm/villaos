'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/auth/forgot-password/page.tsx             ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { forgotPasswordAction } from '@/lib/services/auth.service';

export default function ForgotPasswordPage() {
  const [email,     setEmail]   = useState('');
  const [sent,      setSent]    = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await forgotPasswordAction(email.trim().toLowerCase());
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📬</span>
          <h2>Kiểm tra email</h2>
          <p style={{ marginTop: 8 }}>
            Nếu <strong>{email}</strong> tồn tại trong hệ thống, bạn sẽ nhận được link đặt lại mật khẩu.
          </p>
          <div className="auth-links" style={{ marginTop: 24, justifyContent: 'center' }}>
            <Link href="/auth/login">← Quay lại đăng nhập</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">🔑</span>
          <h1>Quên mật khẩu</h1>
          <p>Nhập email để nhận link đặt lại</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" required autoComplete="email" disabled={isPending} />
          </div>

          <button type="submit" className="btn-primary full-width" disabled={isPending}>
            {isPending ? 'Đang gửi...' : 'Gửi link đặt lại'}
          </button>

          <div className="auth-links">
            <Link href="/auth/login">← Quay lại đăng nhập</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
